const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('E2E: warm monochrome tiles, comparison screenshots and isolated UI', async (t) => {
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
    const results=[];
    fs.mkdirSync('scratch/map-tones', {recursive:true});
    await send('Runtime.enable');
    const exceptions=[];
    ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.text)});
    for(const width of [1280,390]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});
      await send('Emulation.setTouchEmulationEnabled',{enabled:width===390});
      for(const [slug,pref] of [['iwate','岩手県'],['aomori','青森県'],['akita','秋田県']]) {
        await evaluate(`document.getElementById('prefSelect').value=${JSON.stringify(pref)};document.getElementById('prefSelect').dispatchEvent(new Event('change'))`);
        await waitFor("!!document.querySelector('#mapCanvas .onsen-map-marker')");
        const id=await evaluate("document.querySelector('#mapCanvas .onsen-map-marker').dataset.onsenId");
        await evaluate(`if(document.querySelector('.onsen-map-marker[data-onsen-id="${id}"]').classList.contains('is-unvisited')){document.querySelector('[data-detail="${id}"]').click();document.getElementById('detailStamp').click();document.getElementById('modalClose').click()}`);
        await evaluate("document.getElementById('mapCanvas').scrollIntoView()");
        await new Promise(r=>setTimeout(r,400));
        await waitFor("document.querySelectorAll('#mapCanvas img.leaflet-tile').length>0 && [...document.querySelectorAll('#mapCanvas img.leaflet-tile')].every(t=>t.complete&&t.naturalWidth===256)");
        const state=await evaluate(`(() => {
          const pane=document.querySelector('#mapCanvas .leaflet-tile');
          const markers=[...document.querySelectorAll('#mapCanvas .onsen-map-marker')];
          const ancestorsClean=node=>{for(let n=node;n;n=n.parentElement)if(getComputedStyle(n).filter!=='none')return false;return true};
          return {filter:getComputedStyle(pane).filter,markers:markers.length,
            colors:markers.map(m=>({visited:m.classList.contains('is-visited'),color:getComputedStyle(m.querySelector('span')).backgroundColor})),
            isolated:markers.every(ancestorsClean)&&ancestorsClean(document.querySelector('.leaflet-control-zoom')),
            overflow:document.documentElement.scrollWidth>innerWidth};
        })()`);
        assert.ok(state.filter.includes('grayscale(1)'));
        assert.equal(state.isolated,true);assert.equal(state.overflow,false);
        assert.ok(state.colors.some(m=>m.visited&&m.color==='rgb(52, 79, 67)'));
        assert.ok(state.colors.some(m=>!m.visited&&m.color==='rgb(161, 123, 63)'));
        for(const mode of ['before','after']) {
          await evaluate(`document.querySelectorAll('#mapCanvas .leaflet-tile').forEach(t=>t.style.filter=${JSON.stringify(mode==='before'?'none':'')})`);
          const shot=await send('Page.captureScreenshot',{format:'png'});
          fs.writeFileSync(`scratch/map-tones/${slug}-${width}-${mode}.png`,Buffer.from(shot.data,'base64'));
        }
        const point=await evaluate(`(() => {const r=document.querySelector('#mapCanvas .onsen-map-marker.is-visited span').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
        if(width===390){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
        else {await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});}
        await waitFor("document.getElementById('modalBg').style.display==='flex'");
        assert.equal(await evaluate("getComputedStyle(document.querySelector('.leaflet-popup-pane')).filter"),'none');
        assert.ok(await evaluate("!document.querySelector('.leaflet-popup') && document.querySelector('#detailMap').href.startsWith('https://')"));
        await evaluate("document.getElementById('modalClose').click()");
        const zoomBefore=await evaluate("document.querySelector('.leaflet-tile-container').style.transform");
        await evaluate("document.querySelector('.leaflet-control-zoom-in').click()");
        await new Promise(r=>setTimeout(r,500));
        assert.notEqual(await evaluate("document.querySelector('.leaflet-tile-container').style.transform"),zoomBefore);
        await waitFor("[...document.querySelectorAll('#mapCanvas img.leaflet-tile')].every(t=>t.complete&&t.naturalWidth===256)");
        const detail=await send('Page.captureScreenshot',{format:'png'});
        fs.writeFileSync(`scratch/map-tones/${slug}-${width}-after-zoom.png`,Buffer.from(detail.data,'base64'));
        await evaluate("document.querySelector('.leaflet-control-zoom-out').click()");
        await new Promise(r=>setTimeout(r,400));
        results.push({pref,width,...state,detail:true,zoom:true});
        await evaluate("document.getElementById('mapReset').click()");
        assert.equal(await evaluate("!document.getElementById('japanMap').hidden && getComputedStyle(document.querySelector('.geolonia-svg-map')).filter==='none'"),true);
      }
    }
    assert.deepEqual(exceptions,[]);
    fs.writeFileSync('scratch/map-tones/results.json',JSON.stringify({results,exceptions},null,2));
    ws.close();
  }finally{await browser.close();server.closeAllConnections();server.close();}
});
