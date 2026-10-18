const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('E2E: close markers select their own facility on desktop and touch', async (t) => {
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
    const results=[];
    for(const width of [1280,390]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});
      await send('Emulation.setTouchEmulationEnabled',{enabled:width===390});
      for(const [pref,ids] of [['秋田県',['onsen-014','onsen-013','onsen-015','onsen-016']],['群馬県',['onsen-050','onsen-051']]]){
        await evaluate(`document.getElementById('prefSelect').value=${JSON.stringify(pref)};document.getElementById('prefSelect').dispatchEvent(new Event('change'))`);
        await waitFor("!!window.qaMap && !!document.querySelector('.onsen-map-marker')");
        await evaluate("document.getElementById('mapCanvas').scrollIntoView()");
        await new Promise(r=>setTimeout(r,400));
        const regionalZoom=await evaluate('qaMap.getZoom()');
        for(const zoom of [regionalZoom,regionalZoom+2,Math.min(regionalZoom+5,17)]){
          const coords=await evaluate(`ONSEN_DATA.filter(x=>${JSON.stringify(ids)}.includes(x.id)).map(x=>[x.latitude,x.longitude])`);
          await evaluate(`qaMap.setView(L.latLngBounds(${JSON.stringify(coords)}).getCenter(),${zoom},{animate:false});void 0`);
          // Keep each facility in the viewport at close zoom, preserving actual coordinates.
          for(const id of [...ids,ids[0],ids[1],ids[0]]){
            await evaluate(`(() => {qaMap.closePopup();const x=ONSEN_DATA.find(x=>x.id===${JSON.stringify(id)});qaMap.panTo([x.latitude,x.longitude],{animate:false});})()`);
            await waitFor("!document.querySelector('.onsen-popup')");
            // Popup auto-pan and touch zoom transitions must finish before measuring pixels.
            await new Promise(r=>setTimeout(r,400));
            const point=await evaluate(`(() => {
              const marker=document.querySelector('.onsen-map-marker[data-onsen-id="${id}"]');
              const dot=marker.querySelector('span').getBoundingClientRect();
              const others=[...document.querySelectorAll('.onsen-map-marker')].filter(m=>m!==marker&&+m.style.zIndex>=+marker.style.zIndex).map(m=>m.querySelector('span').getBoundingClientRect());
              const inside=(r,x,y)=>Math.hypot(x-r.left-r.width/2,y-r.top-r.height/2)<r.width/2-0.5;
              const cx=dot.left+dot.width/2,cy=dot.top+dot.height/2;
              const points=[{x:cx,y:cy}];
              for(let y=dot.top+1;y<dot.bottom;y++)for(let x=dot.left+1;x<dot.right;x++)points.push({x,y});
              const p=points.find(p=>inside(dot,p.x,p.y)&&others.every(r=>Math.hypot(p.x-r.left-r.width/2,p.y-r.top-r.height/2)>r.width/2+0.75));
              if(!p)return null;
              return {...p,hitId:document.elementFromPoint(p.x,p.y)?.closest('.onsen-map-marker')?.dataset.onsenId,iconWidth:marker.getBoundingClientRect().width,dotWidth:dot.width,iconPointer:getComputedStyle(marker).pointerEvents,dotPointer:getComputedStyle(marker.querySelector('span')).pointerEvents};
            })()`);
            assert.ok(point, `${width}px zoom ${zoom}: ${id} has a visible part of its circle`);
            assert.equal(point.hitId,id,`${width}px zoom ${zoom}: visible circle must receive its own pointer ${JSON.stringify(point)}`);
            const {x,y}=point;
            if(width===390){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
            else{await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});}
            await waitFor("!!document.querySelector('.onsen-popup')");
            const facility=await evaluate(`ONSEN_DATA.find(x=>x.id==='${id}').facility`);
            assert.equal(await evaluate("document.querySelector('.onsen-popup > div').textContent"),facility);
            const error=await evaluate(`(() => {const x=ONSEN_DATA.find(x=>x.id==='${id}'),p=qaMap.latLngToContainerPoint([x.latitude,x.longitude]),r=document.querySelector('.onsen-map-marker[data-onsen-id="${id}"] span').getBoundingClientRect(),b=document.getElementById('mapCanvas').getBoundingClientRect();return Math.hypot(r.left+r.width/2-b.left-p.x,r.top+r.height/2-b.top-p.y)})()`);
            assert.ok(error<1.5,'Circle stays at its original coordinate');
            results.push({width,zoom,id,facility,hitId:point.hitId,popup:true,pixelError:error});
          }
        }
      }
    }
    fs.mkdirSync('scratch/nearby-marker-qa',{recursive:true});
    fs.writeFileSync('scratch/nearby-marker-qa/results.json',JSON.stringify(results,null,2));
    ws.close();
  }finally{await browser.close();server.closeAllConnections();server.close();}
});
