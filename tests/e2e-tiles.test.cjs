const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('E2E: background tiles, regional bounds, filters, errors, retry and file guidance', async (t) => {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (!fs.existsSync(edgePath)) {
    t.skip('Edge not installed at standard path');
    return;
  }

  const server = require('node:http').createServer((req,res)=>{
    const file = path.resolve('.'+new URL(req.url,'http://localhost').pathname.replace(/^\/web-onsen-stamp-rally\//,'/'));
    if(!file.startsWith(process.cwd()+path.sep)){res.writeHead(403).end();return;}
    const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)];
    if(type)res.setHeader('Content-Type',type);
    fs.createReadStream(file).on('error',()=>res.writeHead(404).end()).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  // Match the GitHub Pages project subdirectory as well as local HTTP behavior.
  const htmlUrl = `http://127.0.0.1:${server.address().port}/web-onsen-stamp-rally/index.html`;
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

    let res;
    for(let i=0;i<50;i++){try{res=await fetch(`http://127.0.0.1:${port}/json`);break;}catch{await new Promise(r=>setTimeout(r,200));}}
    assert.ok(res,'Edge debugging endpoint must start');
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

    const responses=[],failures=[],exceptions=[];
    ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Network.responseReceived'&&m.params.response.url.includes('tile.openstreetmap.org'))responses.push({url:m.params.response.url,status:m.params.response.status});if(m.method==='Network.loadingFailed')failures.push(m.params.errorText);if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.text);});
    await send('Network.enable');await send('Runtime.enable');
    async function waitFor(expr){for(let i=0;i<100;i++){if(await evaluate(expr))return;await new Promise(r=>setTimeout(r,100));}assert.fail('Timed out: '+expr);}
    for(const [pref,width] of [['岩手県',1280],['北海道',390],['秋田県',390],['群馬県',1280]]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<400});
      await evaluate(`document.getElementById('prefSelect').value='${pref}';document.getElementById('prefSelect').dispatchEvent(new Event('change'));document.getElementById('regional-progress').scrollIntoView()`);
      await waitFor(`document.querySelectorAll('#mapCanvas img.leaflet-tile').length>0 && [...document.querySelectorAll('#mapCanvas img.leaflet-tile')].every(t=>t.complete&&t.naturalWidth===256)`);
      assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
      assert.ok(await evaluate(`document.querySelectorAll('#mapCanvas .leaflet-marker-icon').length>0`));
      assert.equal(await evaluate(`document.getElementById('mapTileNotice').hidden`),true);
      fs.mkdirSync('scratch/tile-qa',{recursive:true});const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`scratch/tile-qa/${width}-${pref}.png`,Buffer.from(shot.data,'base64'));
    }
    const storage=await evaluate('JSON.stringify(localStorage)');
    await evaluate(`document.getElementById('mapStatus').value='visited';document.getElementById('mapStatus').dispatchEvent(new Event('change'))`);
    assert.equal(await evaluate(`document.getElementById('statusSelect').value`),'visited');
    assert.equal(await evaluate(`document.querySelectorAll('#mapCanvas .leaflet-marker-icon').length`),0);
    await evaluate(`document.getElementById('mapStatus').value='unvisited';document.getElementById('mapStatus').dispatchEvent(new Event('change'))`);
    assert.ok(await evaluate(`document.querySelectorAll('#mapCanvas .leaflet-marker-icon').length>0`));
    await send('Network.setBlockedURLs',{urls:['*tile.openstreetmap.org*']});
    await evaluate(`document.getElementById('mapRetryBtn').click()`);
    await waitFor(`!document.getElementById('mapRetryBtn').hidden && document.getElementById('mapTileNotice').textContent.includes('取得できません')`);
    assert.ok(await evaluate(`document.querySelectorAll('#mapCanvas .leaflet-marker-icon').length>0`));
    await send('Network.setBlockedURLs',{urls:[]});
    await evaluate(`document.getElementById('mapRetryBtn').click()`);
    await waitFor(`document.getElementById('mapRetryBtn').hidden && [...document.querySelectorAll('#mapCanvas img.leaflet-tile')].every(t=>t.complete&&t.naturalWidth===256)`);
    assert.equal(await evaluate('JSON.stringify(localStorage)'),storage);
    await evaluate(`document.getElementById('mapReset').click()`);
    assert.equal(await evaluate(`document.getElementById('japanMap').hidden`),false);
    assert.equal(await evaluate(`document.getElementById('prefSelect').value`),'');
    assert.equal(exceptions.length,0,JSON.stringify(exceptions));
    assert.ok(responses.some(r=>r.status===200));
    await send('Page.navigate',{url:pathToFileURL(path.resolve('index.html')).href});
    await waitFor(`document.readyState==='complete' && !!document.querySelector('.prefecture')`);
    await evaluate(`document.getElementById('prefSelect').value='岩手県';document.getElementById('prefSelect').dispatchEvent(new Event('change'))`);
    await waitFor(`document.getElementById('mapTileNotice').textContent.includes('Open with Live Server')`);
    assert.equal(await evaluate(`document.querySelectorAll('#mapCanvas img.leaflet-tile').length`),0);
    fs.writeFileSync('scratch/tile-qa/network.json',JSON.stringify({responses,expectedBlockedFailures:failures,exceptions},null,2));
    ws.close();
  } finally {edge.kill();server.closeAllConnections();server.close();}
});
