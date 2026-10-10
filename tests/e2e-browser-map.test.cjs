const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('E2E: Edge browser map interaction, synchronization, and accessibility', async (t) => {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (!fs.existsSync(edgePath)) {
    t.skip('Edge not installed at standard path');
    return;
  }

  const htmlUrl = pathToFileURL(path.resolve('index.html')).href;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'onsen-map-browser-'));
  const port = 9225;

  const edge = spawn(edgePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    htmlUrl
  ]);

  try {
    await new Promise(r => setTimeout(r, 1200));

    const res = await fetch(`http://localhost:${port}/json`);
    const pages = await res.json();
    const page = pages.find(p => p.type === 'page' && p.url === htmlUrl);
    assert.ok(page, 'Application browser page must be available');

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

    await send('Page.enable');

    for (let attempt = 0; attempt < 50; attempt++) {
      if (await evaluate(`!!document.querySelector('.geolonia-svg-map .prefecture')`)) break;
      await new Promise(r => setTimeout(r, 100));
    }

    // Measure actual painted geometry, not just the presence of SVG nodes.
    fs.mkdirSync('scratch/map-screenshots', { recursive: true });
    for (const width of [1440, 1280, 768, 390, 320]) {
      await send('Emulation.setDeviceMetricsOverride', {
        width, height: 1500, deviceScaleFactor: 1, mobile: width <= 390
      });
      await evaluate(`document.getElementById('regional-progress').scrollIntoView()`);
      await new Promise(r => setTimeout(r, 150));
      const layout = await evaluate(`(() => {
        const svg = document.querySelector('.geolonia-svg-map');
        const frame = svg.getBoundingClientRect();
        const prefs = [...svg.querySelectorAll('.prefecture')];
        const cards = document.getElementById('prefgrid').getBoundingClientRect();
        const panel = document.getElementById('japanMap').getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          stacked: cards.top >= panel.bottom,
          columns: getComputedStyle(document.getElementById('prefgrid')).gridTemplateColumns.split(' ').length,
          contained: prefs.every(p => {
            const r = p.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.left >= frame.left - 1 &&
              r.right <= frame.right + 1 && r.top >= frame.top - 1 && r.bottom <= frame.bottom + 1;
          }),
          separated: prefs.find(p => p.dataset.code === '1').getBoundingClientRect().left >
            prefs.find(p => p.dataset.code === '40').getBoundingClientRect().right
        };
      })()`);
      assert.equal(layout.overflow, false, `${width}px: no horizontal overflow`);
      assert.equal(layout.stacked, true, `${width}px: cards below map`);
      assert.equal(layout.contained, true, `${width}px: all 47 shapes visible within SVG`);
      assert.equal(layout.separated, true, `${width}px: Hokkaido and Kyushu must not overlap`);
      assert.equal(layout.columns, width === 320 ? 1 : width === 390 ? 2 : width === 768 ? 3 : 4);
      const screenshot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(`scratch/map-screenshots/map-${width}.png`, Buffer.from(screenshot.data, 'base64'));
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

    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280, height: 1500, deviceScaleFactor: 1, mobile: false
    });
    await evaluate(`document.getElementById('resetPref').click(); document.getElementById('regional-progress').scrollIntoView()`);
    await new Promise(r => setTimeout(r, 500));
    async function hitPoint(code) {
      return evaluate(`(() => {
        const node = document.querySelector('.prefecture[data-code="${code}"]');
        const r = node.getBoundingClientRect();
        for (let x = r.left + 1; x < r.right; x += 2) {
          for (let y = r.top + 1; y < r.bottom; y += 2) {
            if (document.elementFromPoint(x, y)?.closest('.prefecture') === node) return {x, y};
          }
        }
      })()`);
    }
    const point = await hitPoint(2);
    assert.ok(point, 'Aomori must have a painted, hit-testable surface');
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    const tooltip = await evaluate(`document.getElementById('japanMapTooltip').textContent`);
    assert.ok(tooltip.includes('青森県') && tooltip.includes('0 / 4') && tooltip.includes('0%'));
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    assert.equal(await evaluate(`document.getElementById('resultCount').textContent`), '4 件の温泉');

    await send('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 1500, deviceScaleFactor: 1, mobile: true
    });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true });
    await evaluate(`document.getElementById('resetPref').click(); document.getElementById('regional-progress').scrollIntoView()`);
    await new Promise(r => setTimeout(r, 500));
    const touchPoint = await hitPoint(1);
    assert.ok(touchPoint, 'Hokkaido must be tappable on mobile');
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await evaluate(`document.querySelector('.pref[data-pref="北海道"]').classList.contains('selected')`), true);
    assert.equal(await evaluate(`document.getElementById('resultCount').textContent`), '1 件の温泉');

    await evaluate(`document.querySelector('.prefecture[data-code="10"]').focus()`);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    assert.equal(await evaluate(`document.querySelector('.prefecture[data-code="10"]').getAttribute('aria-pressed')`), 'true');
    assert.equal(await evaluate(`document.getElementById('resultCount').textContent`), '8 件の温泉');

    // Hero copy: force each random bucket on a real reload, then test normal reloads.
    fs.mkdirSync('scratch/hero-screenshots', { recursive: true });
    const copies = await evaluate('OnsenHeroCopy.COPIES.ja');
    const visitStorageBefore = await evaluate('JSON.stringify(localStorage)');
    for (const width of [1440, 1280, 768, 390, 320]) {
      await send('Emulation.setDeviceMetricsOverride', {
        width, height: 1000, deviceScaleFactor: 1, mobile: width <= 390
      });
      let buttonTop;
      for (let i = 0; i < copies.length; i++) {
        const injection = await send('Page.addScriptToEvaluateOnNewDocument', {
          source: `Math.random = () => ${(i + .5) / 5}; try { sessionStorage.removeItem('onsen-hero-copy-ja'); } catch {}`
        });
        await send('Page.reload');
        for (let attempt = 0; attempt < 50; attempt++) {
          const loaded = await evaluate(`document.readyState === 'complete' && document.getElementById('heroCopy')?.textContent === ${JSON.stringify(copies[i])}`);
          if (loaded) break;
          await new Promise(r => setTimeout(r, 100));
        }
        await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection.identifier });
        await evaluate('scrollTo(0, 0)');
        const hero = await evaluate(`(() => {
          const copy = document.getElementById('heroCopy');
          const box = copy.getBoundingClientRect();
          return {
            text: copy.textContent,
            overflow: document.documentElement.scrollWidth > innerWidth,
            contained: [...copy.children].every(span => {
              const r = span.getBoundingClientRect();
              return r.left >= box.left && r.right <= box.right + 1 && r.bottom <= box.bottom + 1;
            }),
            buttonTop: document.querySelector('.hero-actions').getBoundingClientRect().top,
            heading: document.querySelector('.hero h1').textContent
          };
        })()`);
        assert.equal(hero.text, copies[i], `${width}px: copy ${i + 1}`);
        assert.equal(hero.overflow, false);
        assert.equal(hero.contained, true);
        assert.equal(hero.heading, 'そうだ、温泉に行こう。');
        if (buttonTop !== undefined) assert.ok(Math.abs(hero.buttonTop - buttonTop) < 1, 'Buttons must stay in place');
        buttonTop = hero.buttonTop;
        const screenshot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(`scratch/hero-screenshots/hero-${width}-${i + 1}.png`, Buffer.from(screenshot.data, 'base64'));
      }
    }
    let previous = await evaluate(`document.getElementById('heroCopy').textContent`);
    for (let i = 0; i < 8; i++) {
      await send('Page.reload');
      let next;
      for (let attempt = 0; attempt < 50; attempt++) {
        next = await evaluate(`document.readyState === 'complete' ? document.getElementById('heroCopy')?.textContent : null`);
        if (next && next !== previous) break;
        await new Promise(r => setTimeout(r, 100));
      }
      assert.ok(copies.includes(next));
      assert.notEqual(next, previous, 'Reload must exclude the previous copy');
      previous = next;
    }
    assert.equal(await evaluate('JSON.stringify(localStorage)'), visitStorageBefore, 'Hero must preserve visit storage');
    await evaluate(`document.getElementById('search').value = '青森'; document.getElementById('search').dispatchEvent(new Event('input'))`);
    assert.equal(await evaluate(`document.getElementById('resultCount').textContent`), '4 件の温泉');

    ws.close();
  } finally {
    edge.kill();
  }
});
