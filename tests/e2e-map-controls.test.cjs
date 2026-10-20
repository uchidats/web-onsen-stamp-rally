const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

test('Shared map zoom controls fit and work at desktop and phone widths', async t => {
  const server = http.createServer((req, res) => {
    const file = path.resolve('.' + new URL(req.url, 'http://localhost').pathname);
    if (!file.startsWith(process.cwd() + path.sep)) { res.writeHead(403).end(); return; }
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).on('error', () => res.writeHead(404).end()).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const browser = await require('./helpers/browser.cjs').startBrowser(
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    `http://127.0.0.1:${server.address().port}/index.html`
  );
  t.after(() => browser.close());
  const { send, evaluate } = browser;
  await send('Page.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://*'] });
  await evaluate('document.fonts.ready');
  const stored = await evaluate('JSON.stringify(localStorage)');
  const wait = async expression => {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(expression)) return;
      await new Promise(r => setTimeout(r, 50));
    }
    assert.fail('Timed out: ' + expression);
  };
  const click = async (selector, mobile) => {
    const point = await evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);
    if (mobile) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    }
  };
  const style = selector => evaluate(`(() => {const s=getComputedStyle(document.querySelector(${JSON.stringify(selector)}));return Object.fromEntries(['width','height','padding','backgroundColor','color','borderBottom','borderRadius','fontSize','fontFamily','lineHeight'].map(k=>[k,s[k]]))})()`);
  const view = () => evaluate("document.querySelector('.geolonia-svg-map').getAttribute('viewBox')");
  const shot = async name => fs.writeFileSync(path.join(browser.profile, name + '.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  // Capture the existing Leaflet instance for zoom/coordinate assertions only.
  await evaluate(`new Promise((resolve,reject)=>{const l=document.createElement('link');l.rel='stylesheet';l.href='vendor/leaflet/leaflet.css';l.dataset.mapCss=l.href;l.onload=resolve;l.onerror=reject;document.head.appendChild(l)})`);
  await evaluate(`new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='vendor/leaflet/leaflet.js';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})`);
  await evaluate('window.qaOriginalMap=L.map;L.map=function(...args){window.qaMap=qaOriginalMap.apply(this,args);return qaMap}');
  for (const width of [1280, 390, 320]) {
    const mobile = width < 400;
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile });
    await send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
    await click('#japanMapRegionView', mobile);
    const region = await view();
    const expectedRegion = await evaluate("(()=>{const v=JapanPrefMap.createViewport().region();return [v.x,v.y,v.size,v.size].join(' ')})()");
    assert.equal(region, expectedRegion);
    const svgSize = await evaluate("document.querySelector('.geolonia-svg-map').getBoundingClientRect().width");
    assert.equal(await evaluate(`(() => {const z=document.querySelector('.map-zoom-controls').getBoundingClientRect(),r=document.querySelector('.japan-map-region-controls').getBoundingClientRect(),f=document.querySelector('.japan-map-svg-frame').getBoundingClientRect();return z.left===f.left&&r.right===f.right&&z.right<r.left&&Math.abs(z.top-r.top)<1&&document.documentElement.scrollWidth<=innerWidth})()`), true);
    await click('#japanMapZoomIn', mobile);
    assert.notEqual(await view(), region);
    await click('#japanMapZoomOut', mobile);
    assert.equal(await view(), region);
    await evaluate("document.getElementById('japanMapZoomIn').focus()");
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await send('Input.dispatchKeyEvent', { type: 'char', key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    assert.notEqual(await view(), region);
    await click('#japanMapRegionView', mobile);
    await click('#japanMapResetView', mobile);
    assert.equal(await view(), '0 0 1000 1000');
    await click('#japanMapRegionView', mobile);
    assert.equal(await view(), region);
    assert.equal(await evaluate("document.querySelector('.geolonia-svg-map').getBoundingClientRect().width"), svgSize);
    const nationalStyle = await style('#japanMapZoomIn');
    const nationalGroup = await evaluate("(()=>{const s=getComputedStyle(document.querySelector('.map-zoom-controls'));return [s.border,s.borderRadius,s.padding,s.backgroundColor]})()");
    await evaluate("document.querySelector('.japan-map-svg-frame').scrollIntoView({block:'start',behavior:'instant'})");
    await shot('national-controls-' + width);
    await evaluate("document.querySelector('.japan-map-marker[data-onsen-id=\"onsen-004\"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))");
    assert.equal(await evaluate("document.getElementById('modalBg').style.display"), 'flex');
    assert.equal(await evaluate("document.getElementById('modalSubtitle').textContent.includes('黄金崎不老ふ死温泉')"), true);
    await evaluate("document.getElementById('modalClose').click();document.querySelector('.prefecture[data-pref=\"青森県\"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))");
    await wait("document.querySelectorAll('#mapCanvas .onsen-map-marker').length===4");
    assert.equal(await evaluate("(()=>{const b=document.getElementById('mapReset').getBoundingClientRect(),h=document.querySelector('#prefectureMap > .heading').getBoundingClientRect();return Math.abs(b.right-h.right)<1})()"), true);
    assert.deepEqual(await style('.leaflet-control-zoom-in'), nationalStyle);
    assert.deepEqual(await evaluate("(()=>{const s=getComputedStyle(document.querySelector('.leaflet-control-zoom'));return [s.border,s.borderRadius,s.padding,s.backgroundColor]})()"), nationalGroup);
    assert.equal(await evaluate("(()=>{const r=document.querySelector('.leaflet-control-zoom').getBoundingClientRect(),c=document.getElementById('mapCanvas').getBoundingClientRect();return Math.abs(r.left-c.left-10)<2&&Math.abs(r.top-c.top-10)<2&&r.right<=c.right&&document.documentElement.scrollWidth<=innerWidth})()"), true);
    const center = await evaluate('({lat:qaMap.getCenter().lat,lng:qaMap.getCenter().lng})');
    const zoom = await evaluate('qaMap.getZoom()');
    await click('.leaflet-control-zoom-in', mobile);
    await wait(`qaMap.getZoom()===${zoom+1} && !qaMap._animatingZoom`);
    await click('.leaflet-control-zoom-out', mobile);
    await wait(`qaMap.getZoom()===${zoom} && !qaMap._animatingZoom`);
    const restored = await evaluate('({lat:qaMap.getCenter().lat,lng:qaMap.getCenter().lng})');
    assert.ok(Math.abs(restored.lat-center.lat)<.01 && Math.abs(restored.lng-center.lng)<.01);
    assert.equal(await evaluate("(()=>{const layers=[];qaMap.eachLayer(l=>{if(l.getLatLng&&l.options.title)layers.push(l)});return layers.length===4&&layers.every(l=>{const x=ONSEN_DATA.find(x=>l.options.title.startsWith(x.facility+'・'));const p=l.getLatLng();return x&&p.lat===x.latitude&&p.lng===x.longitude})})()"), true);
    assert.equal(await evaluate("(()=>{const c=document.getElementById('mapCanvas').getBoundingClientRect();return [...document.querySelectorAll('#mapCanvas .onsen-map-marker')].every(e=>{const r=e.getBoundingClientRect();return r.right>c.left&&r.left<c.right&&r.bottom>c.top&&r.top<c.bottom})})()"), true);
    await evaluate("document.getElementById('prefectureMap').scrollIntoView({block:'start',behavior:'instant'})");
    await shot('prefecture-controls-' + width);
    await evaluate("document.querySelector('#mapCanvas .onsen-map-marker').focus()");
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await send('Input.dispatchKeyEvent', { type: 'char', key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await wait("document.getElementById('modalBg').style.display==='flex'");
    await evaluate("document.getElementById('modalClose').click()");
    await click('#mapReset', mobile);
    assert.equal(await evaluate("document.getElementById('japanMap').hidden"), false);
    assert.equal(await evaluate("document.getElementById('prefSelect').value"), '');
    assert.equal(await view(), region);
    assert.equal(await evaluate('JSON.stringify(localStorage)'), stored);
    console.log(JSON.stringify({width,sharedStyles:true,zoom:true,navigation:true,markers:true,screenshots:browser.profile}));
  }
});
