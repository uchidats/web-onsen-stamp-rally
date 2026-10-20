const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// 県別地図の♨マーカー: タッチでは中心から22px以内のタップを受け付け、候補が複数なら選択リストを出す。
// マウス操作・マーカー以外の地図操作は従来どおり。凡例は県別だけ♨、全国地図は丸のまま。
test('E2E: spring marker touch tolerance (single facility, close facilities, mouse unchanged, legends)', async (t) => {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (!fs.existsSync(edgePath)) { t.skip('Edge not installed at standard path'); return; }
  const server = require('node:http').createServer((req, res) => {
    const file = path.resolve('.' + new URL(req.url, 'http://localhost').pathname.replace(/^\/web-onsen-stamp-rally\//, '/'));
    if (!file.startsWith(process.cwd() + path.sep)) { res.writeHead(403).end(); return; }
    const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' }[path.extname(file)];
    if (type) res.setHeader('Content-Type', type);
    fs.createReadStream(file).on('error', () => res.writeHead(404).end()).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const htmlUrl = `http://127.0.0.1:${server.address().port}/web-onsen-stamp-rally/index.html`;
  let browser;
  t.after(async () => { await browser?.close(); server.closeAllConnections(); server.close(); });
  browser = await require('./helpers/browser.cjs').startBrowser(edgePath, htmlUrl);
  const { send, evaluate } = browser;
  await send('Page.enable');
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function waitFor(expr) { for (let i = 0; i < 100; i++) { if (await evaluate(expr)) return; await wait(100); } assert.fail('Timed out: ' + expr); }
  for (let i = 0; i < 50; i++) { if (await evaluate("!!document.querySelector('.geolonia-svg-map .prefecture')")) break; await wait(100); }
  await evaluate("new Promise(resolve=>{const s=document.createElement('script');s.src='vendor/leaflet/leaflet.js';s.onload=resolve;document.head.append(s)})");
  await waitFor('!!window.L');
  await evaluate("const factory=L.map;L.map=function(...args){window.qaMap=factory.apply(this,args);return window.qaMap}");

  const tap = async (x, y, touch) => {
    if (touch) { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
    else { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); }
    await wait(450);
  };
  const state = () => evaluate(`(() => ({detailFacility: document.getElementById('modalBg').style.display==='flex'?document.querySelector('#modalSubtitle .facility-name').textContent:null, chooser: [...document.querySelectorAll('.map-choice-list button')].map(b => b.textContent), hasPopup: !!document.querySelector('.leaflet-popup')}))()`);
  const clear = async () => { await evaluate("document.getElementById('modalClose').click();document.getElementById('mapNearbyChoices')?.remove();void 0"); await wait(150); };
  // container point of a facility, in page coordinates
  const pagePoint = id => evaluate(`(() => {const x=ONSEN_DATA.find(v=>v.id==='${id}'),p=qaMap.latLngToContainerPoint([x.latitude,x.longitude]),b=document.getElementById('mapCanvas').getBoundingClientRect();return {x:b.left+p.x,y:b.top+p.y}})()`);

  const report = [];
  for (const width of [1280, 390, 320]) {
    const touch = width < 400;
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: touch });
    await send('Emulation.setTouchEmulationEnabled', { enabled: touch });
    await wait(400);
    await evaluate("document.getElementById('prefSelect').value='秋田県';document.getElementById('prefSelect').dispatchEvent(new Event('change'))");
    await waitFor("!!window.qaMap && !!document.querySelector('.onsen-map-marker--spring')");
    await evaluate("document.getElementById('mapCanvas').scrollIntoView()");
    await wait(500);

    // legends: prefecture map legend uses the spring glyph, the national map legend keeps the circle
    const legend = await evaluate(`(() => {const d=document.querySelector('.map-legend .legend-dot'),n=document.querySelector('.japan-map-legend .legend-marker');return {dotRadius:getComputedStyle(d).borderRadius,dotMask:(getComputedStyle(d).webkitMaskImage||getComputedStyle(d).maskImage||'').startsWith('url('),nationalRadius:n?getComputedStyle(n).borderRadius:null}})()`);
    assert.equal(legend.dotRadius, '0px'); assert.equal(legend.dotMask, true);
    assert.equal(legend.nationalRadius, '50%');

    // --- single facility: 秋田 onsen-019 area is isolated at the regional zoom; verify a tap 18px away selects it, 40px away does not
    const ids = await evaluate("[...document.querySelectorAll('.onsen-map-marker')].map(m=>m.dataset.onsenId)");
    const pts = {};
    for (const id of ids) pts[id] = await pagePoint(id);
    // choose the most isolated marker (largest nearest-neighbour distance)
    let lone = null, loneD = 0;
    for (const id of ids) { const d = Math.min(...ids.filter(o => o !== id).map(o => Math.hypot(pts[id].x - pts[o].x, pts[id].y - pts[o].y))); if (d > loneD) { loneD = d; lone = id; } }
    assert.ok(loneD > 70, `${width}px: an isolated marker exists (${loneD})`);
    const facility = await evaluate(`ONSEN_DATA.find(v=>v.id==='${lone}').facility`);
    let c = pts[lone];
    await clear();
    await tap(c.x + 18, c.y, touch);
    let s = await state();
    assert.equal(s.hasPopup,false);
    if (touch) { assert.equal(s.detailFacility, facility, `${width}px: tap 18px away selects the single facility`); assert.deepEqual(s.chooser, []); }
    else assert.equal(s.detailFacility, null, 'mouse: only the marker itself is clickable (unchanged)');
    await clear();
    c = await pagePoint(lone); // re-measure without moving the map
    await tap(c.x + 40, c.y, touch);
    s = await state();
    assert.equal(s.detailFacility, null);
    assert.equal(s.hasPopup, false, `${width}px: a tap 40px away does nothing`);
    await clear();
    // the marker itself still works for both
    await clear();
    c = await pagePoint(lone);
    await tap(c.x, c.y, touch);
    s = await state(); assert.equal(s.detailFacility, facility, `${width}px: direct tap on the marker`);
    await clear();

    // --- close facilities: zoom so that two markers are 28-40px apart; tap the midpoint (outside both 12px circles)
    const pair = await evaluate(`(() => {
      const crs=L.CRS.EPSG3857,pr=(x,z)=>crs.latLngToPoint(L.latLng(x.latitude,x.longitude),z);
      const shown=new Set([...document.querySelectorAll('.onsen-map-marker')].map(m=>m.dataset.onsenId));
      const rows=ONSEN_DATA.filter(x=>shown.has(x.id));
      let best=null;
      for(let a=0;a<rows.length;a++)for(let b=a+1;b<rows.length;b++){
        for(let z=5;z<=17;z++){const d=pr(rows[a],z).distanceTo(pr(rows[b],z));if(d>=28&&d<=42){
          const mid=[(rows[a].latitude+rows[b].latitude)/2,(rows[a].longitude+rows[b].longitude)/2],pm=crs.latLngToPoint(L.latLng(mid),z);
          const third=rows.some((o,i)=>i!==a&&i!==b&&pr(o,z).distanceTo(pm)<=50);
          if(!third&&(!best||d<best.d))best={a:rows[a].id,b:rows[b].id,z,d,mid};break}}
      }
      return best})()`);
    assert.ok(pair, `${width}px: a close pair exists`);
    await evaluate(`qaMap.setView(${JSON.stringify(pair.mid)},${pair.z},{animate:false});void 0`);
    await wait(600);
    const m = await evaluate(`(() => {const p=qaMap.latLngToContainerPoint(${JSON.stringify(pair.mid)}),b=document.getElementById('mapCanvas').getBoundingClientRect();return {x:b.left+p.x,y:b.top+p.y}})()`);
    await clear();
    await tap(m.x, m.y, touch);
    s = await state();
    if (touch) {
      assert.equal(s.detailFacility, null, `${width}px: no facility is chosen on its own between two close markers`);
      assert.equal(s.chooser.length, 2, `${width}px: chooser lists both facilities`);
      const names = await evaluate(`[${JSON.stringify(pair.a)},${JSON.stringify(pair.b)}].map(id=>ONSEN_DATA.find(v=>v.id===id).facility)`);
      for (const n of names) assert.ok(s.chooser.some(x => x.startsWith(n)), `${width}px: ${n} listed`);
      // choose the second one
      await evaluate("document.querySelectorAll('.map-choice-list button')[1].click()");
      await wait(450);
      s = await state();
      assert.ok(names.includes(s.detailFacility), `${width}px: the chosen facility opens its shared detail panel`);
      assert.equal(s.chooser.length, 0);
    } else assert.equal(s.hasPopup, false);
    await clear();

    // --- overlapping tap circles (centres 14-20px apart, tap in the overlap): same as before, the topmost marker wins; no chooser, no guess by distance
    const lap = await evaluate(`(() => {
      const crs=L.CRS.EPSG3857,pr=(x,z)=>crs.latLngToPoint(L.latLng(x.latitude,x.longitude),z);
      const shown=new Set([...document.querySelectorAll('.onsen-map-marker')].map(m=>m.dataset.onsenId)),rows=ONSEN_DATA.filter(x=>shown.has(x.id));
      for(let a=0;a<rows.length;a++)for(let b=a+1;b<rows.length;b++)for(let z=5;z<=17;z++){const d=pr(rows[a],z).distanceTo(pr(rows[b],z));if(d>=14&&d<=20)return {z,mid:[(rows[a].latitude+rows[b].latitude)/2,(rows[a].longitude+rows[b].longitude)/2]}}
      return null})()`);
    assert.ok(lap, `${width}px: an overlapping pair exists`);
    await evaluate(`qaMap.setView(${JSON.stringify(lap.mid)},${lap.z},{animate:false});void 0`);
    await wait(600);
    const lm = await evaluate(`(() => {const p=qaMap.latLngToContainerPoint(${JSON.stringify(lap.mid)}),b=document.getElementById('mapCanvas').getBoundingClientRect();return {x:b.left+p.x,y:b.top+p.y}})()`);
    const topFacility = await evaluate(`(() => {const id=document.elementFromPoint(${lm.x},${lm.y})?.closest('.onsen-map-marker')?.dataset.onsenId;return id?ONSEN_DATA.find(v=>v.id===id).facility:null})()`);
    await clear();
    await tap(lm.x, lm.y, touch);
    s = await state();
    if (touch) { assert.ok(topFacility, `${width}px: overlap point is covered by a marker`); assert.equal(s.detailFacility, topFacility, `${width}px: overlap -> topmost marker`); assert.deepEqual(s.chooser, []); }
    await clear();

    // --- map operations are not disturbed: pan by dragging empty map keeps zoom/center semantics and opens nothing
    await evaluate(`qaMap.setView(${JSON.stringify(pair.mid)},${pair.z},{animate:false});void 0`);
    await wait(300);
    const before = await evaluate('JSON.stringify([qaMap.getZoom(),qaMap.getCenter()])');
    const sx = m.x + 120, sy = m.y + 120;
    if (touch) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy }] });
      for (let i = 1; i <= 8; i++) await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx - i * 8, y: sy }] });
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: sx, y: sy, button: 'left', clickCount: 1 });
      for (let i = 1; i <= 8; i++) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: sx - i * 8, y: sy, buttons: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: sx - 64, y: sy, button: 'left', clickCount: 1 });
    }
    await wait(500);
    s = await state();
    assert.equal(s.detailFacility, null);
    assert.equal(s.hasPopup, false, `${width}px: a pan gesture opens no popup`);
    const after = await evaluate('JSON.stringify([qaMap.getZoom(),qaMap.getCenter()])');
    assert.equal(JSON.parse(after)[0], JSON.parse(before)[0], 'zoom unchanged by pan');
    assert.notEqual(after, before, `${width}px: the map did pan`);
    report.push({ width, lone, loneD: Math.round(loneD), pair: pair.a + '/' + pair.b, pairZoom: pair.z, pairDist: Math.round(pair.d) });
  }
  fs.mkdirSync('scratch/spring-marker-qa', { recursive: true });
  fs.writeFileSync('scratch/spring-marker-qa/tap-results.json', JSON.stringify(report, null, 2));
  assert.equal(await evaluate('JSON.stringify(localStorage)'), '{}');
});
