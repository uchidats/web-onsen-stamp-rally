const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('E2E: 源生の湯 gold wave next to the green wave on cards and in 代表的な湯 (order, gap, tooltips, links, no overflow)', async (t) => {
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'onsen-gensei-'));
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
    fs.mkdirSync('scratch/gensei-qa', { recursive: true });

    const GOLD = ['onsen-007', 'onsen-009', 'onsen-031'];
    // 深緑の波はあるが、源生の湯の根拠が足りない/非該当の施設には金色の波を付けない
    const GREEN_ONLY = ['onsen-003', 'onsen-004', 'onsen-006', 'onsen-010', 'onsen-012', 'onsen-017', 'onsen-018', 'onsen-019', 'onsen-032', 'onsen-030'];
    const DETAIL_GOLD = { 'onsen-007': ['白猿の湯', '桂の湯', '白糸の湯'], 'onsen-009': ['大湯', '滝の湯', '真湯'], 'onsen-031': ['岩風呂', '檜露天風呂', '混浴内風呂'] };
    const TIP_CARD = '源生の湯の浴槽あり', TIP_BATH = '源生の湯｜源泉かけ流し・加水なし・加温なし';
    const entry = id => `document.querySelector('[data-facility-id="${id}"]')`;
    const rect = async expr => evaluate(`(()=>{const n=${expr};if(!n)return null;const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})()`);
    const center = async expr => { const r = await rect(expr); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; };
    const tip = id => evaluate(`(()=>{const t=${entry(id)}.querySelector('.gensei-icon .bath-color-tip'),s=getComputedStyle(t),r=t.getBoundingClientRect(),c=${entry(id)}.closest('.card').getBoundingClientRect();return{visible:s.visibility==='visible'&&+s.opacity>0,inside:r.left>=c.left-1&&r.right<=c.right+1&&r.top>=c.top-1}})()`);
    const key = async (name, code, vk, text) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: vk, ...(text ? { text } : {}) }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: vk }); };
    const pagesNow = async () => (await send('Target.getTargets')).targetInfos.filter(x => x.type === 'page' && x.url.startsWith('http:')).map(x => x.url);
    const probe = id => `(()=>{const e=${entry(id)},f=e.querySelector('.facility'),link=f.querySelector('.facility-name-link,.facility-name'),k=f.querySelector('.kake-icon'),g=f.querySelector('.gensei-icon'),
      ks=k.querySelector('svg').getBoundingClientRect(),gs=g.querySelector('svg').getBoundingClientRect(),dots=[...f.querySelectorAll('.bath-color-dot')].map(d=>d.getBoundingClientRect()),
      lr=[...link.getClientRects()].pop(),card=e.closest('.card'),cr=card.getBoundingClientRect(),h1=card.offsetHeight,w=g.parentElement;w.style.display='none';const h2=card.offsetHeight;w.style.display='';
      return{n:f.querySelectorAll('.gensei-icon').length,order:k.parentElement.nextElementSibling===w,dotsBeforeKake:!dots.length||dots[dots.length-1].right<=ks.left,nameBefore:lr.right<=ks.left,
        size:gs.width+'x'+gs.height,gap:Math.round((gs.left-ks.right)*10)/10,sameRow:Math.abs((gs.top+gs.height/2)-(ks.top+ks.height/2))<=1,inside:gs.right<=cr.right&&gs.left>=cr.left,delta:h1-h2,
        overflow:document.documentElement.scrollWidth>innerWidth,inLink:!!g.closest('a'),color:getComputedStyle(g).color,kcolor:getComputedStyle(k).color,label:g.getAttribute('aria-label')}})()`;

    for (const width of [1280, 390, 320]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 400 });
      await evaluate("while(!document.getElementById('showMore').classList.contains('hide'))document.getElementById('showMore').click()");
      await delay(150);
      assert.equal(await evaluate("document.querySelectorAll('#cards .gensei-icon').length"), GOLD.length);
      for (const id of GREEN_ONLY) assert.equal(await evaluate(`${entry(id)}.querySelectorAll('.gensei-icon').length`), 0, id + ' must not get the gold wave');
      for (const id of GOLD) {
        const L = await evaluate(probe(id));
        assert.equal(L.n, 1, id);
        assert.ok(L.order, `${id}: the gold wave directly follows the green wave`);
        assert.ok(L.nameBefore && L.dotsBeforeKake, `${id}: name -> color dots -> green -> gold`);
        assert.equal(L.size, '16x16');
        assert.ok(L.gap >= 3.5 && L.gap <= 4.5, `${id}@${width}: gap between the waves ${L.gap}px (expected about 4)`);
        assert.ok(L.sameRow, `${id}@${width}: gold wave is on the green wave's line`);
        assert.ok(L.inside && !L.inLink, id);
        assert.ok(L.delta <= 1, `${id}@${width}: card grew by ${L.delta}px`);
        assert.equal(L.overflow, false);
        assert.equal(L.label, TIP_CARD);
        assert.notEqual(L.color, L.kcolor, 'gold differs from the green wave');
        assert.equal(L.color, 'rgb(165, 131, 47)');
        // the green wave stays as it was
        assert.equal(await evaluate(`${entry(id)}.querySelectorAll('.kake-icon').length`), 1);
        assert.equal(await evaluate(`${entry(id)}.querySelector('.kake-icon').getAttribute('aria-label')`), '源泉かけ流しの浴槽あり');
      }
      assert.ok(await evaluate("[...document.querySelectorAll('#cards .bath-color')].every(b=>!b.classList.contains('gensei-icon'))"));

      if (width === 1280) {
        await evaluate(`${entry('onsen-007')}.scrollIntoView({block:'center'})`);
        await delay(100);
        const p = await center(`${entry('onsen-007')}.querySelector('.gensei-icon')`);
        const before = await pagesNow();
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
        await delay(100);
        const s = await tip('onsen-007');
        assert.ok(s.visible && s.inside);
        assert.equal(await evaluate(`${entry('onsen-007')}.querySelector('.gensei-icon .bath-color-tip').textContent`), TIP_CARD);
        fs.writeFileSync('scratch/gensei-qa/hover-1280.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
        await delay(300);
        assert.deepEqual(await pagesNow(), before, 'clicking the gold wave must not open the official site');
        assert.equal(await evaluate("document.getElementById('modalBg').style.display==='flex'"), false);
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 5, y: 5, button: 'left', clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 5, y: 5, button: 'left', clickCount: 1 });
        await delay(100);
        assert.equal((await tip('onsen-007')).visible, false);
      }
      if (width < 400) {
        await evaluate(`${entry('onsen-031')}.scrollIntoView({block:'center'})`);
        await delay(100);
        const p = await center(`${entry('onsen-031')}.querySelector('.gensei-icon')`);
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await delay(150);
        const s = await tip('onsen-031');
        assert.ok(s.visible && s.inside, 'tap shows the tooltip inside the card');
        assert.equal(await evaluate("document.getElementById('modalBg').style.display==='flex'"), false);
        fs.writeFileSync(`scratch/gensei-qa/tap-${width}.png`, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 3, y: 3 }] });
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await delay(150);
        assert.equal((await tip('onsen-031')).visible, false);
      }
      // keyboard: the green wave, then the gold wave
      await evaluate(`${entry('onsen-009')}.scrollIntoView({block:'center'});${entry('onsen-009')}.querySelector('.kake-icon').focus()`);
      await key('Tab', 'Tab', 9);
      assert.equal(await evaluate("document.activeElement.classList.contains('gensei-icon')"), true, 'Tab moves from the green wave to the gold wave');
      await key('Enter', 'Enter', 13, '\r');
      await delay(100);
      assert.ok((await tip('onsen-009')).visible, 'Enter opens the explanation');
      await key('Escape', 'Escape', 27);
      await delay(100);
      assert.equal(await evaluate("document.querySelectorAll('.gensei-icon.is-open, .kake-icon.is-open, .bath-color.is-open').length"), 0);
    }

    // ---- detail view: only certified baths get the gold wave, right after the green wave ----
    for (const width of [1280, 390, 320]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 400 });
      const NONE = ['onsen-003', 'onsen-006', 'onsen-018', 'onsen-030'];
      for (const id of [...Object.keys(DETAIL_GOLD), ...NONE]) {
        await evaluate(`${entry(id)}.querySelector('[data-detail]').click()`);
        await delay(100);
        const D = await evaluate(`(()=>{const m=document.querySelector('.modal').getBoundingClientRect();return[...document.querySelectorAll('#featureBathList .feature-bath')].map(li=>{const h=li.querySelector('h4').getBoundingClientRect(),k=li.querySelector('.kake-icon'),g=li.querySelector('.gensei-icon'),
          ks=k&&k.querySelector('svg').getBoundingClientRect(),gs=g&&g.querySelector('svg').getBoundingClientRect();
          return{name:li.querySelector('h4').textContent,kake:!!k,gold:!!g,order:g?k.parentElement.nextElementSibling===g.parentElement:null,gap:g?Math.round((gs.left-ks.right)*10)/10:null,centered:g?Math.abs((gs.top+gs.height/2)-(h.top+h.height/2))<=4:null,inside:g?gs.right<=m.right&&gs.left>=m.left:true,label:g?g.getAttribute('aria-label'):null,tip:g?g.querySelector('.bath-color-tip').textContent:null}})})()`);
        const want = DETAIL_GOLD[id] || [];
        assert.deepEqual(D.filter(b => b.gold).map(b => b.name).sort(), [...want].sort(), `${id}@${width}`);
        for (const b of D.filter(x => x.gold)) {
          assert.ok(b.kake && b.order, `${id}/${b.name}: green then gold`);
          assert.ok(b.gap >= 3.5 && b.gap <= 4.5, `${id}/${b.name}@${width}: gap ${b.gap}`);
          assert.ok(b.centered && b.inside, `${id}/${b.name}@${width}`);
          assert.equal(b.label, TIP_BATH);
          assert.equal(b.tip, TIP_BATH);
        }
        // 認定されていない源泉かけ流しの浴槽は、従来どおり深緑の波だけ
        for (const b of D.filter(x => x.kake && !x.gold)) assert.ok(!want.includes(b.name), `${id}/${b.name}`);
        assert.equal(await evaluate("document.documentElement.scrollWidth>innerWidth || document.querySelector('.modal').scrollWidth>document.querySelector('.modal').clientWidth"), false, `${id}@${width}: horizontal scroll`);
        if (width === 390 && id === 'onsen-009') fs.writeFileSync('scratch/gensei-qa/detail-390.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
        await evaluate("document.getElementById('modalClose').click()");
        await delay(50);
      }
    }
    assert.equal(await evaluate('JSON.stringify(localStorage)'), '{}');
    ws.close();
  } finally { edge.kill(); server.closeAllConnections(); server.close(); }
});
