const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('E2E: 源泉かけ流し wave icon on cards and in 代表的な湯 (layout, tooltips, links, consistency)', async (t) => {
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
  let browser;
  t.after(async () => { await browser?.close(); server.closeAllConnections(); server.close(); });
  browser = await require('./helpers/browser.cjs').startBrowser(edgePath, htmlUrl);
  const { ws, send, evaluate } = browser;
  try {
    const waitFor = async expr => { for (let i = 0; i < 100; i++) { if (await evaluate(expr)) return; await new Promise(r => setTimeout(r, 100)); } assert.fail('Timed out: ' + expr); };
    const delay = ms => new Promise(r => setTimeout(r, ms));
    await send('Page.enable');
    await waitFor("document.querySelectorAll('#cards .card').length>0");
    await evaluate('localStorage.clear()');
    fs.mkdirSync('scratch/kakenagashi-qa', { recursive: true });

    const WITH = ['onsen-001', 'onsen-003', 'onsen-004', 'onsen-005', 'onsen-006', 'onsen-007', 'onsen-008', 'onsen-009', 'onsen-010', 'onsen-011', 'onsen-012', 'onsen-015', 'onsen-016', 'onsen-017', 'onsen-018', 'onsen-019', 'onsen-020', 'onsen-021', 'onsen-023', 'onsen-024', 'onsen-026', 'onsen-027', 'onsen-028', 'onsen-030', 'onsen-031', 'onsen-032', 'onsen-033', 'onsen-034', 'onsen-035', 'onsen-036', 'onsen-037', 'onsen-038', 'onsen-039', 'onsen-040', 'onsen-041', 'onsen-042', 'onsen-043', 'onsen-044', 'onsen-045', 'onsen-048', 'onsen-060', 'onsen-061', 'onsen-065', 'onsen-066', 'onsen-067', 'onsen-068', 'onsen-054', 'onsen-055', 'onsen-056', 'onsen-057', 'onsen-058'];
    const WITHOUT = ['onsen-059', 'onsen-002', 'onsen-013', 'onsen-014', 'onsen-022', 'onsen-025'];
    const DOTS = ['onsen-004', 'onsen-006', 'onsen-010', 'onsen-012', 'onsen-015', 'onsen-017', 'onsen-018', 'onsen-020', 'onsen-021', 'onsen-026', 'onsen-030', 'onsen-031', 'onsen-032', 'onsen-034', 'onsen-035', 'onsen-036', 'onsen-039', 'onsen-041', 'onsen-043', 'onsen-044', 'onsen-048', 'onsen-061', 'onsen-062', 'onsen-064', 'onsen-066', 'onsen-054', 'onsen-057', 'onsen-059', 'onsen-003', 'onsen-008', 'onsen-016', 'onsen-019', 'onsen-027', 'onsen-028', 'onsen-040', 'onsen-065', 'onsen-067']; // 湯色の丸もある施設
    const DETAIL = { 'onsen-016': 1, 'onsen-003': 3, 'onsen-006': 3, 'onsen-008': 1, 'onsen-011': 1, 'onsen-018': 2, 'onsen-031': 3, 'onsen-023': 1, 'onsen-024': 1, 'onsen-026': 1, 'onsen-027': 3, 'onsen-034': 3, 'onsen-035': 1, 'onsen-036': 3, 'onsen-037': 3, 'onsen-039': 3, 'onsen-040': 3, 'onsen-041': 3, 'onsen-042': 3, 'onsen-043': 1, 'onsen-045': 3, 'onsen-048': 3 };
    const TIP = '源泉かけ流しの浴槽あり';
    const entry = id => `document.querySelector('[data-facility-id="${id}"]')`;
    const rect = async expr => evaluate(`(()=>{const n=${expr};if(!n)return null;const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})()`);
    const center = async expr => { const r = await rect(expr); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; };
    const tipVisible = id => evaluate(`(()=>{const t=${entry(id)}.querySelector('.kake-icon .bath-color-tip'),s=getComputedStyle(t),r=t.getBoundingClientRect(),c=${entry(id)}.closest('.card').getBoundingClientRect();return{visible:s.visibility==='visible'&&+s.opacity>0,inside:r.left>=c.left-1&&r.right<=c.right+1&&r.top>=c.top-1}})()`);
    const key = async (name, code, vk, text) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: vk, ...(text ? { text } : {}) }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: vk }); };
    const probe = id => `(()=>{const e=${entry(id)},f=e.querySelector('.facility'),link=f.querySelector('.facility-name-link,.facility-name'),icon=f.querySelector('.kake-icon'),svg=icon.querySelector('svg').getBoundingClientRect(),dots=[...f.querySelectorAll('.bath-color-dot')].map(d=>d.getBoundingClientRect()),
      lr=[...link.getClientRects()].pop(),card=e.closest('.card'),cr=card.getBoundingClientRect(),prevOk=dots.length?icon.parentElement.previousElementSibling.classList.contains('bath-colors'):icon.parentElement.previousSibling===link,
      anchor=icon.closest('a'),wrap=icon.parentElement,h1=card.offsetHeight;wrap.style.display='none';const h2=card.offsetHeight;wrap.style.display='';
      const ref=dots.length?dots[dots.length-1]:lr;
      return{n:f.querySelectorAll('.kake-icon').length,size:svg.width+'x'+svg.height,gap:Math.round((svg.left-ref.right)*10)/10,sameRow:Math.abs((svg.top+svg.height/2)-(lr.top+lr.height/2))<=3,inside:svg.left>=cr.left&&svg.right<=cr.right,delta:h1-h2,overflow:document.documentElement.scrollWidth>innerWidth,inLink:!!anchor,prevOk,color:getComputedStyle(icon).color,label:icon.getAttribute('aria-label'),hasDots:dots.length}})()`;

    for (const width of [1280, 390, 320]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 400 });
      await evaluate("while(!document.getElementById('showMore').classList.contains('hide'))document.getElementById('showMore').click()");
      await delay(150);
      for (const id of WITH) assert.equal(await evaluate(`${entry(id)}.querySelectorAll('.kake-icon').length`), 1, id);
      for (const id of WITHOUT) assert.equal(await evaluate(`${entry(id)}.querySelectorAll('.kake-icon').length`), 0, id + ' must have no icon');
      assert.equal(await evaluate("document.querySelectorAll('#cards .kake-icon').length"), WITH.length);
      // layout: right after the color dots, or right after the name when there are none; 16px; same row; no extra card height
      for (const id of WITH) {
        const L = await evaluate(probe(id));
        assert.equal(L.n, 1, id);
        assert.equal(L.size, '16x16', id);
        assert.equal(L.hasDots > 0, DOTS.includes(id), `${id}: dots state`);
        if (L.hasDots) assert.ok(L.gap >= 3.5 && L.gap <= 5.5, `${id}@${width}: gap to the last color dot ${L.gap}px (expected 4-5)`);
        else assert.ok(L.gap >= 7 && L.gap <= 9, `${id}@${width}: gap to the name ${L.gap}px (expected about 8)`);
        assert.ok(L.sameRow, `${id}@${width}: not on the name line`);
        assert.ok(L.prevOk, `${id}: icon must directly follow the color dots / the name`);
        assert.equal(L.inLink, false, id + ': the icon is outside the official link');
        assert.ok(L.inside, `${id}@${width}: icon outside the card`);
        assert.ok(L.delta <= 1, `${id}@${width}: card grew by ${L.delta}px`);
        assert.equal(L.overflow, false, id);
        assert.equal(L.label, TIP);
        assert.notEqual(L.color, 'rgb(0, 0, 0)');
      }
      // the color dots keep their own count (the wave icon is not a color dot)
      assert.ok(await evaluate("[...document.querySelectorAll('#cards .bath-color')].every(b=>!b.classList.contains('kake-icon'))"));

      // hover (PC): tooltip text, inside the card; hovering the icon does not open the official link
      if (width === 1280) {
        await evaluate(`${entry('onsen-006')}.scrollIntoView({block:'center'})`);
        await delay(100);
        const p = await center(`${entry('onsen-006')}.querySelector('.kake-icon')`);
        const pagesNow = async () => (await send('Target.getTargets')).targetInfos.filter(t => t.type === 'page' && t.url.startsWith('http:')).map(t => t.url);
        const pagesBefore = await pagesNow();
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
        await delay(100);
        const s = await tipVisible('onsen-006');
        assert.ok(s.visible && s.inside);
        assert.equal(await evaluate(`${entry('onsen-006')}.querySelector('.kake-icon .bath-color-tip').textContent`), TIP);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(`scratch/kakenagashi-qa/hover-${width}.png`, Buffer.from(shot.data, 'base64'));
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
        await delay(300);
        assert.deepEqual(await pagesNow(), pagesBefore, 'clicking the icon must not open the official site (no new tab)');
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 5, y: 5, button: 'left', clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 5, y: 5, button: 'left', clickCount: 1 });
        await delay(100);
        assert.equal((await tipVisible('onsen-006')).visible, false);
      }
      // tap (touch)
      if (width < 400) {
        await evaluate(`${entry('onsen-003')}.scrollIntoView({block:'center'})`);
        await delay(100);
        const p = await center(`${entry('onsen-003')}.querySelector('.kake-icon')`);
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await delay(150);
        const s = await tipVisible('onsen-003');
        assert.ok(s.visible && s.inside, 'tap shows the tooltip inside the card');
        assert.equal(await evaluate("document.getElementById('modalBg').style.display==='flex'"), false);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(`scratch/kakenagashi-qa/tap-${width}.png`, Buffer.from(shot.data, 'base64'));
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 3, y: 3 }] });
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await delay(150);
        assert.equal((await tipVisible('onsen-003')).visible, false);
      }
      // keyboard: color dots and the wave icon are each reachable and operable
      await evaluate(`${entry('onsen-006')}.scrollIntoView({block:'center'});${entry('onsen-006')}.querySelector('.bath-color').focus()`);
      await key('Tab', 'Tab', 9);
      assert.equal(await evaluate("document.activeElement.classList.contains('kake-icon')"), true, 'Tab moves from the last color dot to the wave icon');
      await key('Enter', 'Enter', 13, '\r');
      await delay(100);
      assert.ok((await tipVisible('onsen-006')).visible, 'Enter opens the explanation');
      await key('Escape', 'Escape', 27);
      await delay(100);
      assert.equal(await evaluate("document.querySelectorAll('.kake-icon.is-open, .bath-color.is-open').length"), 0);
      assert.equal(await evaluate("document.getElementById('modalBg').style.display==='flex'"), false);
    }

    // ---- detail view: only baths with bath-level evidence; the icon follows the color dot (or the name) ----
    for (const width of [1280, 390, 320]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 400 });
      for (const [id, count] of Object.entries(DETAIL)) {
        await evaluate(`${entry(id)}.querySelector('[data-detail]').click()`);
        await delay(100);
        const D = await evaluate(`(()=>{const m=document.querySelector('.modal').getBoundingClientRect();return[...document.querySelectorAll('#featureBathList .feature-bath')].map(li=>{const h=li.querySelector('h4').getBoundingClientRect(),dots=[...li.querySelectorAll('.bath-color-dot')].map(d=>d.getBoundingClientRect()),k=li.querySelector('.kake-icon'),sv=k&&k.querySelector('svg').getBoundingClientRect(),ref=dots.length?dots[dots.length-1]:h;
          return{name:li.querySelector('h4').textContent,has:!!k,gap:k?Math.round((sv.left-ref.right)*10)/10:null,centered:k?Math.abs((sv.top+sv.height/2)-(h.top+h.height/2))<=4:null,inside:k?sv.right<=m.right&&sv.left>=m.left:true,label:k?k.getAttribute('aria-label'):null,after:k?k.parentElement.previousElementSibling.classList.contains(dots.length?'bath-colors':'x')||k.parentElement.previousElementSibling.tagName==='H4':null,dots:dots.length}})})()`);
        assert.equal(D.filter(b => b.has).length, count, `${id}@${width}`);
        for (const b of D.filter(x => x.has)) {
          assert.equal(b.label, '源泉かけ流し');
          assert.ok(b.centered && b.inside, `${id}/${b.name}@${width}`);
          assert.ok(b.after, `${id}/${b.name}: icon directly after the name or the color dot`);
          assert.ok(b.dots ? b.gap >= 3 && b.gap <= 6 : b.gap >= 6 && b.gap <= 10, `${id}/${b.name}@${width}: gap ${b.gap}`);
        }
        assert.equal(await evaluate("document.documentElement.scrollWidth>innerWidth || document.querySelector('.modal').scrollWidth>document.querySelector('.modal').clientWidth"), false);
        // card/detail consistency: a bath icon in the detail view implies the card icon, and vice versa the card icon never depends on it
        assert.equal(await evaluate(`${entry(id)}.querySelectorAll('.kake-icon').length`), 1, id);
        if (width === 390 && id === 'onsen-008') {
          // 山水閣: 大沢の湯 only (山水の湯・豊沢の湯は公式のかけ流しの列挙に無い)
          assert.deepEqual(D.map(b => [b.name, b.has]), [['大沢の湯', true], ['豊沢の湯', false], ['山水の湯', false]]);
        }
        if (width === 390 && id === 'onsen-006') { const shot = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`scratch/kakenagashi-qa/detail-${width}.png`, Buffer.from(shot.data, 'base64')); }
        await evaluate("document.getElementById('modalClose').click()");
        await delay(50);
      }
      // facilities without bath-level evidence show no icon in the detail view even though the card has one
      for (const id of ['onsen-010', 'onsen-021', 'onsen-028', 'onsen-004']) {
        await evaluate(`${entry(id)}.querySelector('[data-detail]').click()`);
        await delay(100);
        const n = await evaluate("document.querySelectorAll('#featureBathList .kake-icon').length");
        assert.equal(n, id === 'onsen-004' ? 1 : 0, `${id}: detail icons`);
        await evaluate("document.getElementById('modalClose').click()");
        await delay(50);
      }
    }
    assert.equal(await evaluate('JSON.stringify(localStorage)'), '{}');
    ws.close();
  } finally { await browser.close(); server.closeAllConnections(); server.close(); }
});
