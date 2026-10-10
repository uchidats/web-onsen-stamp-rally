const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');

test('E2E: Edge browser map interaction, synchronization, and accessibility', async (t) => {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (!fs.existsSync(edgePath)) {
    t.skip('Edge not installed at standard path');
    return;
  }

  const htmlUrl = 'file:///c:/Users/uchid/Documents/GitHub/web-onsen-stamp-rally/index.html';
  const port = 9225;

  const edge = spawn(edgePath, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    htmlUrl
  ]);

  try {
    await new Promise(r => setTimeout(r, 1200));

    const res = await fetch(`http://localhost:${port}/json`);
    const pages = await res.json();
    const page = pages.find(p => p.type === 'page' || p.url.includes('index.html')) || pages[0];

    const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let idSeq = 0;
    function send(method, params = {}) {
      return new Promise((resolve) => {
        const id = ++idSeq;
        const onMsg = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id === id) {
            ws.removeEventListener('message', onMsg);
            resolve(msg.result);
          }
        };
        ws.addEventListener('message', onMsg);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    async function evaluate(expr) {
      const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
      return res.result?.value;
    }

    // 1. Initial 47 prefectures and empty states
    const initStats = await evaluate(`
      (() => {
        const prefs = document.querySelectorAll('.geolonia-svg-map .prefecture');
        const empty = document.querySelectorAll('.geolonia-svg-map .prefecture.status-empty');
        const zero = document.querySelectorAll('.geolonia-svg-map .prefecture.status-zero');
        return { total: prefs.length, empty: empty.length, zero: zero.length };
      })()
    `);
    assert.equal(initStats.total, 47, '47 prefectures must be present on SVG map');
    assert.equal(initStats.empty, 35, '35 prefectures without facilities must be status-empty');
    assert.equal(initStats.zero, 12, '12 prefectures with facilities must be status-zero initially');

    // 2. Click Aomori prefecture -> selects map and syncs card
    const selectAomori = await evaluate(`
      (() => {
        const aomori = document.querySelector('.prefecture[data-pref="青森県"]');
        aomori.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const isSelected = aomori.classList.contains('selected');
        const cardSelected = document.querySelector('.pref[data-pref="青森県"]')?.classList.contains('selected');
        return { isSelected, cardSelected };
      })()
    `);
    assert.equal(selectAomori.isSelected, true, 'Aomori must be selected on map');
    assert.equal(selectAomori.cardSelected, true, 'Aomori card must be selected');

    // 3. Click Okinawa (empty) -> does not crash, shows empty status
    const selectOkinawa = await evaluate(`
      (() => {
        const okinawa = document.querySelector('.prefecture[data-pref="沖縄県"]');
        okinawa.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const isSelected = okinawa.classList.contains('selected');
        const detail = document.getElementById('japanMapDetailBar').textContent;
        return { isSelected, detail };
      })()
    `);
    assert.equal(selectOkinawa.isSelected, true, 'Okinawa selected');
    assert.ok(selectOkinawa.detail.includes('登録施設なし'), 'Must show 登録施設なし for Okinawa');

    // 4. Keyboard Enter on Gunma
    const keyboardGunma = await evaluate(`
      (() => {
        document.getElementById('resetPref').click();
        const gunma = document.querySelector('.prefecture[data-pref="群馬県"]');
        gunma.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        return gunma.classList.contains('selected');
      })()
    `);
    assert.equal(keyboardGunma, true, 'Gunma should be selected via keyboard Enter');

    ws.close();
  } finally {
    edge.kill();
  }
});
