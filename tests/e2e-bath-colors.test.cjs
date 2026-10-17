const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('E2E: bath color dots on onsen cards (hover, tap, keyboard, layout)', async (t) => {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (!fs.existsSync(edgePath)) { t.skip('Edge not installed at standard path'); return; }
  const server = require('node:http').createServer((req, res) => {
    const file = path.resolve('.' + new URL(req.url, 'http://localhost').pathname.replace(/^\/web-onsen-stamp-rally\//, '/'));
    if (!file.startsWith(process.cwd() + path.sep)) { res.writeHead(403).end(); return; }
    const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }[path.extname(file)];
    if (type) res.setHeader('Content-Type', type);
    fs.createReadStream(file).on('error', () => res.writeHead(404).end()).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const htmlUrl = `http://127.0.0.1:${server.address().port}/web-onsen-stamp-rally/index.html`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'onsen-bath-colors-'));
  const port = 9225;
  const edge = spawn(edgePath, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, '--remote-allow-origins=*', htmlUrl]);
  try {
    await new Promise(r => setTimeout(r, 1200));
    let res;
    for (let i = 0; i < 50; i++) { try { res = await fetch(`http://127.0.0.1:${port}/json`); break; } catch { await new Promise(r => setTimeout(r, 200)); } }
    assert.ok(res, 'Edge debugging endpoint must start');
    const page = (await res.json()).find(p => p.type === 'page' && p.url === htmlUrl);
    const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let idSeq = 0;
    const send = (method, params = {}) => new Promise(resolve => {
      const id = ++idSeq;
      const onMsg = event => { const msg = JSON.parse(event.data); if (msg.id === id) { ws.removeEventListener('message', onMsg); resolve(msg.result); } };
      ws.addEventListener('message', onMsg);
      ws.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.value;
    const waitFor = async expr => { for (let i = 0; i < 100; i++) { if (await evaluate(expr)) return; await new Promise(r => setTimeout(r, 100)); } assert.fail('Timed out: ' + expr); };
    const delay = ms => new Promise(r => setTimeout(r, ms));
    await send('Page.enable');
    await waitFor("document.querySelectorAll('#cards .card').length>0");
    await evaluate('localStorage.clear()');
    fs.mkdirSync('scratch/bath-color-qa', { recursive: true });

    const TIP = {
      'onsen-006': '湯の色: 乳白色（混浴露天風呂）。公式の表現「わずかに緑をふくんだ乳白色」。わずかに緑をふくみます。',
      'onsen-010': '湯の色: 緑（施設全体）。公式の表現「珍しい緑色(黄緑色)」。まれに青色に変わることがあります。',
      'onsen-012': '湯の色: 乳白色（混浴露天風呂・男女別内湯）。',
      'onsen-017': '湯の色: 茶褐色（施設全体）。公式の表現「茶褐色、緑、白色」。季節や気温で茶褐色・緑・白色に変わります。',
      'onsen-018': '湯の色: 灰白色（神経痛の湯）。公式の表現「灰白色の「にごり湯」」。',
      'onsen-021': '湯の色: 白（施設全体）。公式の表現「白濁の湯」。'
    };
    const NONE = ['onsen-007', 'onsen-013', 'onsen-014', 'onsen-015', 'onsen-016', 'onsen-019'];
    const entry = id => `document.querySelector('[data-facility-id="${id}"]')`;
    const rect = async expr => evaluate(`(()=>{const n=${expr};if(!n)return null;const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})()`);
    const center = async expr => { const r = await rect(expr); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; };
    const tipState = async id => evaluate(`(()=>{const e=${entry(id)},t=e.querySelector('.bath-color-tip'),s=getComputedStyle(t),r=t.getBoundingClientRect(),c=e.closest('.card').getBoundingClientRect();return{visible:s.visibility==='visible'&&+s.opacity>0,inside:r.left>=c.left-1&&r.right<=c.right+1&&r.top>=c.top-1}})()`);
    const key = async (name, code, vk, text) => {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: vk, ...(text ? { text } : {}) });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: vk });
    };
    // the dot sits right after the facility name (same line, ~8px gap, vertically centered), outside the official link
    const layoutProbe = id => `(()=>{const e=${entry(id)},f=e.querySelector('.facility'),link=f.querySelector('.facility-name-link,.facility-name'),wrap=f.querySelector('.bath-colors'),b=wrap.querySelector('.bath-color'),d=b.querySelector('.bath-color-dot'),
      dr=d.getBoundingClientRect(),br=b.getBoundingClientRect(),card=e.closest('.card'),cr=card.getBoundingClientRect(),lr=[...link.getClientRects()].pop(),
      meta=e.querySelector('.facility-meta'),others=[...meta.children].map(n=>n.getBoundingClientRect()),
      badge=f.querySelector('.conquered-badge'),
      hit=others.some(o=>br.left<o.right-1&&br.right>o.left+1&&br.top<o.bottom-1&&br.bottom>o.top+1);
      const h1=card.offsetHeight;wrap.style.display='none';const h2=card.offsetHeight;wrap.style.display='';
      return{size:dr.width+'x'+dr.height,hit,inside:br.right<=cr.right&&dr.left>=cr.left&&dr.right<=cr.right,delta:h1-h2,overflow:document.documentElement.scrollWidth>innerWidth,
        gap:Math.round((dr.left-lr.right)*10)/10,centerDiff:Math.abs((dr.top+dr.height/2)-(lr.top+lr.height/2)),insideLink:link.contains(wrap),prev:wrap.previousSibling===link,inFacilityRow:wrap.parentElement===f,inMeta:!!meta.querySelector('.bath-colors'),badgeAfter:!badge||(wrap.compareDocumentPosition(badge)&Node.DOCUMENT_POSITION_FOLLOWING)>0}})()`;

    for (const width of [1280, 390, 320]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 400 });
      await evaluate("while(!document.getElementById('showMore').classList.contains('hide'))document.getElementById('showMore').click()");
      await delay(150);
      // dots only for facilities with officially confirmed colors; one dot each (a changing color shows a single base color)
      for (const [id, tip] of Object.entries(TIP)) {
        assert.equal(await evaluate(`${entry(id)}.querySelectorAll('.bath-color').length`), 1, id);
        assert.equal(await evaluate(`${entry(id)}.querySelector('.bath-color').getAttribute('aria-label')`), tip, id);
        assert.equal(await evaluate(`${entry(id)}.querySelector('.bath-color-tip').textContent`), tip, id);
      }
      for (const id of NONE) assert.equal(await evaluate(`${entry(id)}.querySelectorAll('.bath-color').length`), 0, id + ' must have no dot');
      assert.equal(await evaluate("document.querySelectorAll('.bath-color').length"), 6);

      // layout: 16px dot, no overlap with the other meta items, no page overflow, no extra card height
      for (const id of Object.keys(TIP)) {
        const L = await evaluate(layoutProbe(id));
        assert.equal(L.size, '16x16', id);
        assert.equal(L.hit, false, `${id}@${width}: dot overlaps another control`);
        assert.ok(L.gap >= 7 && L.gap <= 9, `${id}@${width}: gap between name and dot is ${L.gap}px (expected about 8)`);
        assert.ok(L.centerDiff <= 3, `${id}@${width}: dot is not vertically centered on the name line (${L.centerDiff}px)`);
        assert.equal(L.insideLink, false, id);
        assert.ok(L.prev && L.inFacilityRow && !L.inMeta, id + ': dot directly follows the facility name, not in the meta row');
        assert.ok(L.badgeAfter, id);
        assert.ok(L.inside, id);
        assert.ok(L.delta <= 1, `${id}@${width}: card grew by ${L.delta}px`);
        assert.equal(L.overflow, false, id);
      }

      // milky white (filled) and colorless transparent (hollow ring) are visually distinct
      const look = await evaluate(`(()=>{const mk=(c)=>{const d=window.ONSEN_COLOR_DEFS[c],i=document.createElement('i');i.className='bath-color-dot'+(d.hollow?' is-hollow':'');i.style.setProperty('--dot',d.fill);i.style.setProperty('--ring',d.ring);document.body.appendChild(i);const s=getComputedStyle(i),o={bg:s.backgroundColor,bw:s.borderTopWidth};i.remove();return o};return{milky:mk('milky_white'),colorless:mk('colorless'),white:mk('white')}})()`);
      assert.equal(look.colorless.bg, 'rgba(0, 0, 0, 0)');
      assert.equal(look.colorless.bw, '2px');
      assert.notEqual(look.milky.bg, 'rgba(0, 0, 0, 0)');
      assert.equal(look.milky.bw, '1px');
      assert.notEqual(look.milky.bg, look.white.bg);

      // hover (PC)
      if (width === 1280) {
        await evaluate(`${entry('onsen-006')}.scrollIntoView({block:'center'})`);
        await delay(100);
        const p = await center(`${entry('onsen-006')}.querySelector('.bath-color')`);
        assert.equal((await tipState('onsen-006')).visible, false);
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
        await delay(100);
        const s = await tipState('onsen-006');
        assert.ok(s.visible && s.inside, 'hover shows the color name inside the card');
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(`scratch/bath-color-qa/hover-${width}.png`, Buffer.from(shot.data, 'base64'));
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
        await delay(100);
        assert.equal((await tipState('onsen-006')).visible, false);
      }

      // tap (touch): shows the name, does not open the detail view; tapping elsewhere closes it
      if (width < 400) {
        await evaluate(`${entry('onsen-010')}.scrollIntoView({block:'center'})`);
        await delay(100);
        const p = await center(`${entry('onsen-010')}.querySelector('.bath-color')`);
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await delay(150);
        const s = await tipState('onsen-010');
        assert.ok(s.visible && s.inside, 'tap shows the color name inside the card');
        assert.equal(await evaluate("document.getElementById('modalBg').style.display==='flex'"), false);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(`scratch/bath-color-qa/tap-${width}.png`, Buffer.from(shot.data, 'base64'));
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 3, y: 3 }] });
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await delay(150);
        assert.equal((await tipState('onsen-010')).visible, false);
      }

      // keyboard: focus + Enter opens, Escape closes; neither opens the detail view
      await evaluate(`${entry('onsen-017')}.scrollIntoView({block:'center'});${entry('onsen-017')}.querySelector('.bath-color').focus()`);
      await key('Enter', 'Enter', 13, '\r');
      await delay(100);
      assert.ok((await tipState('onsen-017')).visible, 'Enter shows the color name');
      await key('Escape', 'Escape', 27);
      await delay(100);
      assert.equal(await evaluate(`${entry('onsen-017')}.querySelector('.bath-color').classList.contains('is-open')`), false);
      assert.equal(await evaluate("document.getElementById('modalBg').style.display==='flex'"), false);

      // existing official/map links stay in place
      for (const id of Object.keys(TIP)) {
        assert.equal(await evaluate(`!!${entry(id)}.querySelector('.facility-name-link')`), true, id + ' official link');
        assert.equal(await evaluate(`!!${entry(id)}.querySelector('.map-link')`), true, id + ' map link');
      }
    }

    // the detail button still works after a dot was used, and card and detail agree on the color
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
    for (const [id, word] of [['onsen-006', '乳白色'], ['onsen-018', '灰白色'], ['onsen-012', '乳白色']]) {
      await evaluate(`${entry(id)}.querySelector('[data-detail]').click()`);
      await delay(100);
      assert.ok(await evaluate("document.getElementById('featureBathList').textContent.includes('湯の色 " + word + "')"), id);
      assert.ok((await evaluate(`${entry(id)}.querySelector('.bath-color').getAttribute('aria-label')`)).includes(word), id);
      await evaluate("document.getElementById('modalClose').click()");
    }
    await evaluate(`${entry('onsen-010')}.querySelector('[data-detail]').click()`);
    assert.ok(await evaluate("document.getElementById('featureBathNote').textContent.includes('緑色')"));
    await evaluate("document.getElementById('modalClose').click()");
    // the color dots never touch visit records or localStorage
    assert.equal(await evaluate('JSON.stringify(localStorage)'), '{}');
    ws.close();
  } finally { edge.kill(); server.closeAllConnections(); server.close(); }
});
