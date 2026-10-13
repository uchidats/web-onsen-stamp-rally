const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {spawn}=require('node:child_process');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const added=['006','018','026','034','035','042','054','057','065'].map(n=>'onsen-'+n).concat(JSON.parse(fs.readFileSync('tests/fixtures/verified-coordinates-2026-10-14.json','utf8')).map(x=>x.id));

test('E2E: 67 national markers, 27 regional additions, close-marker selection and preserved visit storage',async t=>{
 const browser=['C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
 if(!browser){t.skip('Chrome/Edge not installed');return;}
 const server=http.createServer((req,res)=>{
  const file=path.resolve('.'+new URL(req.url,'http://localhost').pathname.replace(/^\/web-onsen-stamp-rally\//,'/'));
  if(!file.startsWith(process.cwd()+path.sep)){res.writeHead(403).end();return;}
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'};
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).on('error',()=>res.writeHead(404).end()).pipe(res);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${server.address().port}/web-onsen-stamp-rally/index.html`;
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'onsen-nine-coordinates-'));
 const child=spawn(browser,['--headless=new','--disable-gpu','--no-first-run',`--user-data-dir=${profile}`,'--remote-debugging-port=0','--remote-allow-origins=*',url],{stdio:'ignore'});
 let ws;
 try{
  let port;for(let i=0;i<100;i++){const f=path.join(profile,'DevToolsActivePort');if(fs.existsSync(f)){port=fs.readFileSync(f,'utf8').split('\n')[0];break;}await delay(100);}
  assert.ok(port,'Browser must start');let page;for(let i=0;i<100;i++){const pages=await(await fetch(`http://127.0.0.1:${port}/json`)).json();page=pages.find(p=>p.type==='page'&&p.url===url);if(page)break;await delay(100);}assert.ok(page);
  ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let sequence=0;
  const send=(method,params={})=>new Promise((resolve,reject)=>{
   const id=++sequence;const listener=e=>{const m=JSON.parse(e.data);if(m.id!==id)return;clearTimeout(timer);ws.removeEventListener('message',listener);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result);};
   const timer=setTimeout(()=>{ws.removeEventListener('message',listener);reject(Error('CDP timeout: '+method));},15000);
   ws.addEventListener('message',listener);ws.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
  const waitFor=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(100);}assert.fail('Timed out: '+expression);};
  const click=async(point,mobile)=>{if(mobile){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else{await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});}};
  await send('Page.enable');await waitFor("document.readyState==='complete' && document.querySelectorAll('.japan-map-marker').length===67");
  await evaluate("(()=>{const repo=OnsenRecords.create(localStorage);let state=repo.load();for(const id of ['onsen-001','onsen-006','onsen-026'])state=repo.setVisited(state,id,true);})()");
  await send('Page.reload');await waitFor("document.readyState==='complete' && document.querySelectorAll('.japan-map-marker').length===67 && document.getElementById('totalText').textContent.startsWith('3 / 67')");
  const stored=await evaluate('JSON.stringify(localStorage)');
  assert.equal(await evaluate("ONSEN_DATA.filter(OnsenMap.verified).length"),67);
  assert.equal(await evaluate("ONSEN_DATA.filter(x=>!OnsenMap.verified(x)).length"),0);
  assert.equal(await evaluate("document.getElementById('mapUnverifiedCount').textContent.includes('全国 0施設')"),true);
  assert.equal(await evaluate("!!document.querySelector('.japan-map-attribution a[href=\"https://www.openstreetmap.org/copyright\"]')"),true);
  assert.equal(await evaluate("ONSEN_DATA.filter(x=>!x.coordinateVerified).some(x=>document.querySelector('.japan-map-marker[data-onsen-id=\"'+x.id+'\"]'))"),false);
  const output='scratch/ishizuka-coordinate-qa';fs.mkdirSync(output,{recursive:true});const results=[];
  const expectDetail=async(id,context='')=>{
   await waitFor("document.getElementById('modalBg').style.display==='flex'");
   assert.equal(await evaluate("document.getElementById('modalTitle').textContent"),await evaluate(`ONSEN_DATA.find(x=>x.id===${JSON.stringify(id)}).onsen`),context+' '+id);
   // Both high-yu facilities share an onsen name; verify the selected facility too.
   assert.ok(await evaluate(`document.getElementById('modalSubtitle').textContent.includes(ONSEN_DATA.find(x=>x.id===${JSON.stringify(id)}).facility)`));
   await evaluate("document.getElementById('modalClose').click()");
  };
  for(const width of [1280,390]){
   const mobile=width===390;
   await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile});
   await send('Emulation.setTouchEmulationEnabled',{enabled:mobile});
   await evaluate("document.getElementById('resetPref').click();document.querySelector('.japan-map-svg-frame').scrollIntoView({block:'center'})");await delay(200);
   for(const id of added){
    const point=await evaluate(`(()=>{const m=document.querySelector('.japan-map-marker[data-onsen-id="${id}"]'),r=m.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,hit:document.elementFromPoint(x,y)?.closest('.japan-map-marker')?.getAttribute('data-onsen-id'),width:r.width}})()`);
    assert.ok(point.width>0);assert.equal(point.hit,id,width+'px national marker must receive pointer '+id);
    await click({x:point.x,y:point.y},mobile);await expectDetail(id,width+'px national');results.push({width,id,view:'national',selected:true});
   }
   assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);
   const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`${output}/national-${width}.png`,Buffer.from(shot.data,'base64'));
  }
  await evaluate("new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='vendor/leaflet/leaflet.js';s.onload=resolve;s.onerror=reject;document.head.append(s)})");
  await evaluate("const originalMapFactory=L.map;L.map=function(...args){window.qaMap=originalMapFactory.apply(this,args);return window.qaMap}");
  // Include the new close pairs and old close markers. Use their visible circles,
  // without moving any stored coordinates or replacing real pointer events.
  const regionalIds=[...added,'onsen-041','onsen-038','onsen-050','onsen-051','onsen-013','onsen-014','onsen-015','onsen-016'];
  for(const width of [1280,390]){
   const mobile=width===390;
   await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile});
   await send('Emulation.setTouchEmulationEnabled',{enabled:mobile});
   for(const id of regionalIds){
    const pref=await evaluate(`ONSEN_DATA.find(x=>x.id==='${id}').prefecture`);
    await evaluate(`document.getElementById('prefSelect').value=${JSON.stringify(pref)};document.getElementById('prefSelect').dispatchEvent(new Event('change'))`);
    await waitFor(`!!window.qaMap && !!document.querySelector('#mapCanvas .onsen-map-marker[data-onsen-id="${id}"]')`);
    const expected=await evaluate(`ONSEN_DATA.filter(x=>x.prefecture===${JSON.stringify(pref)}&&OnsenMap.verified(x)).map(x=>x.id).sort()`);
    assert.deepEqual(await evaluate("[...document.querySelectorAll('#mapCanvas .onsen-map-marker')].map(x=>x.dataset.onsenId).sort()"),expected);
    await evaluate(`(()=>{qaMap.stop();qaMap.closePopup();document.getElementById('mapCanvas').scrollIntoView({block:'center'});qaMap.invalidateSize({pan:false});const x=ONSEN_DATA.find(x=>x.id==='${id}');qaMap.setView([x.latitude,x.longitude],13,{animate:false});})()`);await delay(450);
    const point=await evaluate(`(()=>{const marker=document.querySelector('#mapCanvas .onsen-map-marker[data-onsen-id="${id}"]'),r=marker.querySelector('span').getBoundingClientRect();const candidates=[{x:r.left+r.width/2,y:r.top+r.height/2}];for(let y=r.top+1;y<r.bottom;y++)for(let x=r.left+1;x<r.right;x++)candidates.push({x,y});return candidates.find(p=>Math.hypot(p.x-r.left-r.width/2,p.y-r.top-r.height/2)<r.width/2-0.75&&document.elementFromPoint(p.x,p.y)?.closest('.onsen-map-marker')?.dataset.onsenId==='${id}')||null})()`);
    if(!point){const diagnostic=await evaluate(`(()=>{const m=document.querySelector('#mapCanvas .onsen-map-marker[data-onsen-id="${id}"]'),r=m.querySelector('span').getBoundingClientRect(),b=document.getElementById('mapCanvas').getBoundingClientRect();return {dot:r.toJSON(),map:b.toJSON(),hit:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.outerHTML.slice(0,250),center:qaMap.getCenter(),zoom:qaMap.getZoom()}})()`);assert.fail(width+'px regional '+id+' '+JSON.stringify(diagnostic));}
    await click(point,mobile);await waitFor("!!document.querySelector('.onsen-popup')");
    assert.equal(await evaluate("document.querySelector('.onsen-popup > div').textContent"),await evaluate(`ONSEN_DATA.find(x=>x.id==='${id}').facility`));
    await evaluate("document.querySelector('.onsen-popup button').click()");await expectDetail(id);
    assert.equal(await evaluate("document.getElementById('mapUnverifiedCount').textContent.includes('全国 0施設')"),true);
    assert.equal(await evaluate("document.querySelector('.leaflet-control-attribution').textContent.includes('OpenStreetMap')"),true);
    results.push({width,id,view:'regional',count:expected.length,selected:true});
   }
   const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`${output}/regional-${width}.png`,Buffer.from(shot.data,'base64'));
  }
  await evaluate("document.getElementById('mapReset').click()");
  assert.equal(await evaluate('JSON.stringify(localStorage)'),stored,'Map selection must preserve every stored visit byte');
  assert.equal(await evaluate("document.getElementById('totalText').textContent"),'3 / 67 施設を訪問済み');
  fs.writeFileSync(output+'/results.json',JSON.stringify(results,null,2));
  t.diagnostic('PASS: 54 national and 70 regional mouse/touch selections; 67 verified, 0 excluded; synthetic 3/67 progress and storage preserved');
 }finally{ws?.close();child.kill();server.closeAllConnections();server.close();}
});
