const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('E2E: Aomori facility positions and marker projection on desktop/mobile', async (t) => {
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
  let browser;
  t.after(async () => { await browser?.close(); server.closeAllConnections(); server.close(); });
  browser = await require('./helpers/browser.cjs').startBrowser(edgePath, htmlUrl);
  const { ws, send, evaluate } = browser;
  try {

    await send('Page.enable');

    for (let attempt = 0; attempt < 50; attempt++) {
      if (await evaluate(`!!document.querySelector('.geolonia-svg-map .prefecture')`)) break;
      await new Promise(r => setTimeout(r, 100));
    }

    async function waitFor(expr){for(let i=0;i<100;i++){if(await evaluate(expr))return;await new Promise(r=>setTimeout(r,100));}assert.fail('Timed out: '+expr);}
    await evaluate("new Promise(resolve=>{const s=document.createElement('script');s.src='vendor/leaflet/leaflet.js';s.onload=resolve;document.head.append(s)})");
    await waitFor('!!window.L');
    await evaluate("const factory=L.map;L.map=function(...args){window.qaMap=factory.apply(this,args);return window.qaMap}");
    await evaluate("document.getElementById('prefSelect').value='青森県';document.getElementById('prefSelect').dispatchEvent(new Event('change'))");
    await waitFor('!!window.qaMap && !!document.querySelector(".onsen-map-marker")');
    const results=[];
    for(const width of [1280,390]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<400});
      // Let ResizeObserver finish its regional fit before setting a facility zoom.
      await new Promise(r=>setTimeout(r,350));
      for(const id of ['onsen-002','onsen-003','onsen-004','onsen-005']){
        await evaluate(`(()=>{const x=ONSEN_DATA.find(x=>x.id==='${id}');qaMap.setView([x.latitude,x.longitude],17,{animate:false});document.getElementById('mapCanvas').scrollIntoView()})()`);
        await waitFor(`!!document.querySelector('.onsen-map-marker[data-onsen-id="${id}"]') && [...document.querySelectorAll('#mapCanvas img.leaflet-tile')].every(t=>t.complete&&t.naturalWidth===256)`);
        const result=await evaluate(`(()=>{const x=ONSEN_DATA.find(x=>x.id==='${id}'),marker=document.querySelector('.onsen-map-marker[data-onsen-id="${id}"]'),r=marker.querySelector('span').getBoundingClientRect(),base=document.getElementById('mapCanvas').getBoundingClientRect(),p=qaMap.latLngToContainerPoint([x.latitude,x.longitude]);marker.click();return {id:x.id,facility:x.facility,latitude:x.latitude,longitude:x.longitude,pixelError:Math.hypot(r.left+r.width/2-base.left-p.x,r.top+r.height/2-base.top-p.y),detail:document.getElementById('modalSubtitle').textContent,unvisited:marker.classList.contains('is-unvisited')}})()`);
        assert.ok(result.pixelError<1.5,JSON.stringify(result));
        await waitFor(`document.getElementById('modalSubtitle').textContent.includes(${JSON.stringify(result.facility)})`);
        assert.equal(result.unvisited,true);results.push({...result,width});
        await evaluate("document.getElementById('modalClose').click();void 0");
        await new Promise(r=>setTimeout(r,250));
        fs.mkdirSync('scratch/coordinate-audit/screenshots',{recursive:true});const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`scratch/coordinate-audit/screenshots/${id}-${width}.png`,Buffer.from(shot.data,'base64'));
      }
    }
    for(const pref of ['岩手県','秋田県','群馬県']){
      await evaluate(`document.getElementById('prefSelect').value='${pref}';document.getElementById('prefSelect').dispatchEvent(new Event('change'));document.getElementById('mapCanvas').scrollIntoView()`);
      await waitFor("document.querySelectorAll('.onsen-map-marker').length>0 && [...document.querySelectorAll('#mapCanvas img.leaflet-tile')].every(t=>t.complete&&t.naturalWidth===256)");
      assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true);
      const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`scratch/coordinate-audit/screenshots/${pref}.png`,Buffer.from(shot.data,'base64'));
    }
    await evaluate("document.getElementById('prefSelect').value='青森県';document.getElementById('prefSelect').dispatchEvent(new Event('change'));document.querySelector('[data-detail=\"onsen-002\"]').click();document.getElementById('detailStamp').click();document.getElementById('modalClose').click();qaMap.setView([40.6506075,140.8504857],17,{animate:false});void 0");
    await waitFor("!!document.querySelector('.onsen-map-marker.is-visited[data-onsen-id=\"onsen-002\"]')");
    await evaluate("document.getElementById('mapStatus').value='visited';document.getElementById('mapStatus').dispatchEvent(new Event('change'))");
    assert.equal(await evaluate("document.querySelectorAll('.onsen-map-marker.is-unvisited').length"),0);
    assert.equal(await evaluate("document.getElementById('resultCount').textContent"),'1 施設 · 1 温泉地');
    await evaluate("document.getElementById('mapReset').click()");
    assert.equal(await evaluate("document.getElementById('japanMap').hidden"),false);
    fs.writeFileSync('scratch/coordinate-audit/browser-results.json',JSON.stringify(results,null,2));ws.close();
  }finally{await browser.close();server.closeAllConnections();server.close();}
});
