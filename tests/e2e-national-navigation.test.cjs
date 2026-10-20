const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {spawn}=require('node:child_process');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const added=Array.from({length:67},(_,i)=>'onsen-'+String(i+1).padStart(3,'0'));

test('E2E: national SVG zoom, pan, pinch and selection',async t=>{
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
 let session;
 t.after(async()=>{await session?.close();server.closeAllConnections();server.close();});
 session=await require('./helpers/browser.cjs').startBrowser(browser,url);
 const {ws,send,evaluate}=session;
 try{
  const waitFor=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(100);}assert.fail('Timed out: '+expression);};
  const click=async(point,mobile)=>{if(mobile){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else{await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});}};
  await send('Page.enable');await waitFor("document.readyState==='complete' && document.querySelectorAll('.japan-map-marker').length===67");
  await evaluate("(()=>{const repo=OnsenRecords.create(localStorage);let state=repo.load();for(const id of ['onsen-001','onsen-006','onsen-026'])state=repo.setVisited(state,id,true);})()");
  await send('Page.reload');await waitFor("document.readyState==='complete' && document.querySelectorAll('.japan-map-marker').length===67 && document.getElementById('totalText').textContent.startsWith('3 / 67')");
  const stored=await evaluate('JSON.stringify(localStorage)');
  const bounds=async()=>evaluate("(()=>{const r=document.querySelector('.geolonia-svg-map').getBoundingClientRect();return{x:r.left,y:r.top,width:r.width,height:r.height}})()");
  const view=()=>evaluate("document.querySelector('.geolonia-svg-map').getAttribute('viewBox').split(' ').map(Number)");
  const button=async(id,mobile)=>{const p=await evaluate("(()=>{const b=document.getElementById("+JSON.stringify(id)+");b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()");await click(p,mobile);await delay(60);};
  const centerError=async()=>evaluate("(()=>{const svg=document.querySelector('.geolonia-svg-map'),matrix=svg.getScreenCTM();return Math.max(...[...document.querySelectorAll('.japan-map-marker')].map(m=>{const x=ONSEN_DATA.find(x=>x.id===m.dataset.onsenId),p=new DOMPoint(...JapanPrefMap.project(x.longitude,x.latitude)).matrixTransform(matrix),r=m.getBoundingClientRect();return Math.hypot(p.x-r.left-r.width/2,p.y-r.top-r.height/2)}))})()");
  const outcome=()=>evaluate("({pref:document.getElementById('prefSelect').value,modal:document.getElementById('modalBg').style.display==='flex'})");
  const regionView=()=>evaluate("(()=>{const v=JapanPrefMap.createViewport().region();return[v.x,v.y,v.size,v.size]})()");
  for(const width of [1280,390]){
   const mobile=width===390;await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile});await send('Emulation.setTouchEmulationEnabled',{enabled:mobile});
   await send('Page.reload');await waitFor("document.readyState==='complete' && document.querySelectorAll('.japan-map-marker').length===67");
   assert.deepEqual(await view(),await regionView(),'each reload starts at the unchanged Kanto/Tohoku preset');
   await button('japanMapResetView',mobile);assert.deepEqual(await view(),[0,0,1000,1000],'whole Japan button remains available from initial region');
   await evaluate("document.getElementById('resetPref').click();document.getElementById('japanMapResetView').click();document.querySelector('.japan-map-svg-frame').scrollIntoView({block:'center',behavior:'instant'})");await delay(100);
   assert.deepEqual(await view(),[0,0,1000,1000]);
   await button('japanMapZoomIn',mobile);assert.ok((await view())[2]<1000);await button('japanMapZoomOut',mobile);assert.deepEqual(await view(),[0,0,1000,1000]);
   await button('japanMapRegionView',mobile);assert.ok((await view())[2]<500);assert.ok(await centerError()<.1,'shared outline/marker matrix after preset');
   const radius=await evaluate("document.querySelector('.japan-map-marker').getBoundingClientRect().width");assert.ok(radius>=7&&radius<=13,'circles stay legible without growing excessively');
   let r=await bounds(),p={x:r.x+r.width*.45,y:r.y+r.height*.55},before=await view();
   if(mobile){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x+55,y:p.y+35}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
   else{await send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x+55,y:p.y+35,button:'left',buttons:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x+55,y:p.y+35,button:'left',clickCount:1});}
   assert.notDeepEqual(await view(),before,'drag pans the SVG');assert.deepEqual(await outcome(),{pref:'',modal:false},'drag never clicks');assert.ok(await centerError()<.1);
   if(mobile){
    r=await bounds();const x=r.x+r.width*.5,y=r.y+r.height*.6;
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-25,y,id:1},{x:x+25,y,id:2}]});
    const initial=await view();await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-55,y,id:1},{x:x+55,y,id:2}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.ok((await view())[2]<initial[2],'two-finger pinch zooms');assert.deepEqual(await outcome(),{pref:'',modal:false});assert.ok(await centerError()<.1);
    const sy=await evaluate('scrollY');before=await view();
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:5,y:700}]});
    await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:5,y:580}]});
    await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(1000);
    assert.ok(await evaluate('scrollY')>sy,'swipe outside the map scrolls the page');assert.deepEqual(await view(),before);
   }else{
    before=await view();const sy=await evaluate('scrollY');await send('Input.dispatchMouseEvent',{type:'mouseWheel',...p,deltaX:0,deltaY:160});await delay(180);assert.deepEqual(await view(),before,'ordinary wheel never zooms');assert.ok(await evaluate('scrollY')>sy,'ordinary wheel scrolls the page');
    await evaluate("document.querySelector('.japan-map-svg-frame').scrollIntoView({block:'center',behavior:'instant'})");r=await bounds();p={x:r.x+r.width*.5,y:r.y+r.height*.5};before=await view();await send('Input.dispatchMouseEvent',{type:'mouseWheel',...p,deltaX:0,deltaY:-100,modifiers:2});await delay(100);assert.ok((await view())[2]<before[2],'Ctrl wheel zooms');
   }
   await button('japanMapRegionView',mobile);
   await evaluate("document.querySelector('.japan-map-svg-frame').scrollIntoView({block:'center',behavior:'instant'})");await delay(150);
   const coast=await evaluate("(()=>{const m=document.querySelector('.japan-map-marker[data-onsen-id=\"onsen-004\"]'),r=m.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()");await click(coast,mobile);
   if(!(await outcome()).modal){await waitFor("!!document.querySelector('[data-map-candidate=\"onsen-004\"]')");const p=await evaluate("(()=>{const b=document.querySelector('[data-map-candidate=\"onsen-004\"]');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()");await click(p,mobile);}
   await waitFor("document.getElementById('modalBg').style.display==='flex'");assert.ok(await evaluate("document.getElementById('modalSubtitle').textContent.includes('黄金崎不老ふ死温泉')"));await evaluate("document.getElementById('modalClose').click()");
   await evaluate("document.querySelector('.japan-map-svg-frame').scrollIntoView({block:'center',behavior:'instant'})");
   // Hit-test an interior prefecture point after zoom/pan, avoiding the markers.
   const prefPoint=await evaluate(`(()=>{const n=document.querySelector('.prefecture[data-pref="青森県"]'),b=n.getBBox(),matrix=n.getScreenCTM();for(let y=b.y;y<b.y+b.height;y+=1)for(let x=b.x;x<b.x+b.width;x+=1){const p=new DOMPoint(x,y).matrixTransform(matrix);if(p.x<10||p.x>innerWidth-10||p.y<10||p.y>innerHeight-10)continue;const hit=document.elementFromPoint(p.x,p.y);if(hit?.closest('.prefecture')===n&&!hit.closest('.japan-map-marker'))return{x:p.x,y:p.y};}return null})()`);
   assert.ok(prefPoint,'visible prefecture interior');await click(prefPoint,mobile);assert.equal(await evaluate("document.getElementById('prefSelect').value"),'青森県');
   await evaluate("document.getElementById('resetPref').click()");
   // Keyboard selection remains precise after changing the viewport.
   await evaluate("document.querySelector('.prefecture[data-pref=\"青森県\"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))");assert.equal(await evaluate("document.getElementById('prefSelect').value"),'青森県');await waitFor("document.querySelectorAll('#mapCanvas .onsen-map-marker').length===4");
   await evaluate("document.getElementById('resetPref').click();document.getElementById('japanMapZoomIn').click();document.querySelector('.japan-map-svg-frame').scrollIntoView({block:'center',behavior:'instant'})");
   for(let i=0;i<20;i++)await evaluate("document.getElementById('japanMapZoomIn').click()");assert.equal((await view())[2],125);assert.equal(await evaluate("document.getElementById('japanMapZoomIn').disabled"),true);
   for(let i=0;i<20;i++)await evaluate("document.getElementById('japanMapZoomOut').click()");assert.deepEqual(await view(),[0,0,1000,1000]);assert.equal(await evaluate("document.querySelectorAll('.japan-map-marker').length"),67);
   await button('japanMapRegionView',mobile);fs.mkdirSync('scratch/national-navigation-qa',{recursive:true});const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('scratch/national-navigation-qa/preset-'+width+'.png',Buffer.from(shot.data,'base64'));
   await button('japanMapResetView',mobile);assert.deepEqual(await view(),[0,0,1000,1000]);
   const credit=await evaluate("(()=>{const a=document.querySelector('.japan-map-attribution'),i=a.querySelector('.japan-map-credit-info'),r=a.getBoundingClientRect(),f=a.closest('.japan-map-svg-frame').getBoundingClientRect();i.scrollIntoView({block:'center',behavior:'instant'});const p=i.getBoundingClientRect();return{text:a.textContent,size:parseFloat(getComputedStyle(a).fontSize),right:Math.abs(r.right-f.right),width:p.width,height:p.height,x:p.left+p.width/2,y:p.top+p.height/2}})()");
   assert.equal(credit.text,'© OpenStreetMapⓘ');assert.ok(credit.size>=12&&credit.right<1&&credit.width>=44&&credit.height>=44);
   const creditShot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('scratch/national-navigation-qa/credits-'+width+'.png',Buffer.from(creditShot.data,'base64'));
   await click({x:credit.x,y:credit.y},mobile);await waitFor("document.title==='地理データの出典・利用条件'");
   assert.ok(await evaluate("document.body.textContent.includes('Foursquare')&&document.body.textContent.includes('Meta')&&document.body.textContent.includes('ODbL 1.0')"));
   for(const file of ['licenses/CDLA-Permissive-2.0.txt','licenses/Apache-2.0.txt','licenses/Foursquare-NOTICE.txt'])assert.ok(await evaluate(`fetch(${JSON.stringify(file)}).then(async r=>r.ok&&(await r.text()).length>1000)`));
   await send('Page.navigate',{url});await waitFor("document.readyState==='complete'&&document.querySelectorAll('.japan-map-marker').length===67");
  }
  assert.equal(await evaluate('JSON.stringify(localStorage)'),stored,'view never saves or alters visits');await send('Page.reload');await waitFor("document.readyState==='complete'&&!!document.getElementById('japanMapResetView')");assert.deepEqual(await view(),await regionView());assert.equal(await evaluate("document.getElementById('totalText').textContent"),'3 / 67 施設');t.diagnostic('PASS: desktop/mobile initial region, whole Japan, buttons, preset, bounded zoom, drag, pinch, wheel policy, exact centers, coast selection, Leaflet, unchanged storage and reload region');
 }finally{await session.close();server.closeAllConnections();server.close();}
});
