const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
test('Search form fits three widths, combines and clears filters, and derives prefectures from current data',async t=>{
 const browser=await require('./helpers/browser.cjs').startBrowser('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',pathToFileURL(path.resolve('index.html')).href);
 t.after(()=>browser.close());const {send,evaluate}=browser;
 await send('Page.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['https://*']});
 const wait=async expr=>{for(let i=0;i<100;i++){if(await evaluate(expr))return;await new Promise(r=>setTimeout(r,50));}assert.fail(expr)};
 await wait('!!window.OnsenHost');await evaluate('document.fonts.ready');
 const candidates=async()=>evaluate(`(()=>{const actual=[...document.getElementById('prefSelect').options].map(o=>o.value);const expected=['',...JapanPrefMap.PREFECTURES.map(p=>p.name).filter(p=>ONSEN_DATA.some(x=>x.prefecture===p))];return {actual,expected}})()`);
 let options=await candidates();assert.deepEqual(options.actual,options.expected);assert.equal(options.actual.length,14);
 for(const width of [1280,390,320]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<400});await send('Emulation.setTouchEmulationEnabled',{enabled:width<400});
  await evaluate(`document.getElementById('onsens').scrollIntoView({block:'start',behavior:'instant'})`);
  const layout=await evaluate(`(()=>{const r=id=>document.getElementById(id).getBoundingClientRect(),s=r('search'),b=r('clearFilter'),selects=['prefSelect','statusSelect','collectionPicker'].map(r);return {aligned:Math.abs(s.bottom-b.bottom)<1,searchWidth:s.width,clearAfter:b.left>=s.right,even:Math.max(...selects.map(x=>x.width))-Math.min(...selects.map(x=>x.width))<1,below:selects.every(x=>x.top>=b.bottom),fits:document.documentElement.scrollWidth<=innerWidth&&[s,b,...selects].every(x=>x.left>=0&&x.right<=innerWidth),background:getComputedStyle(document.getElementById('clearFilter')).backgroundColor}})()`);
  assert.ok(layout.aligned&&layout.clearAfter&&layout.even&&layout.below&&layout.fits&&layout.searchWidth>=130,JSON.stringify(layout));assert.equal(layout.background,'rgba(0, 0, 0, 0)');
  assert.deepEqual(await evaluate(`[...document.getElementById('statusSelect').options].map(o=>o.textContent)`),['すべて','未訪問','訪問済み']);
  const storageBefore=await evaluate('JSON.stringify(localStorage)');
  assert.deepEqual(await evaluate("[...document.getElementById('categorySelect').options].map(o=>o.value)"),['','chi','kake','gensei']);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('#collectionOptions .collection-label')].map(e=>e.textContent)`),['すべて','♨地・温泉','源泉かけ流し','源生の湯']);
  const activate=async selector=>{
   const p=await evaluate(`(()=>{const r=document.querySelector('${selector}').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
   if(width<400){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
   else{await send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});}
  };
  await activate('#collectionSummary');
  assert.equal(await evaluate('document.getElementById("collectionPicker").open'),true);
  assert.equal(await evaluate(`(()=>{const r=document.getElementById('collectionOptions').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.height>=176})()`),true);
  assert.equal(await evaluate(`['kake','gensei'].every(s=>document.querySelector('#collectionOptions [data-scope="'+s+'"] svg').outerHTML===document.querySelector('#progress-'+s+'-label svg').outerHTML)`),true);
  fs.writeFileSync(path.join(browser.profile,`collection-open-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  assert.equal(await evaluate('document.getElementById("collectionPicker").open'),false);
  await activate('#collectionSummary');
  await evaluate('document.getElementById("search").click()');
  assert.equal(await evaluate('document.getElementById("collectionPicker").open'),false);
  for(const [scope,total] of [['chi',42],['kake',51],['gensei',7],['all',67]]){
   await activate('#collectionSummary');await activate('#collectionOptions [data-scope="'+scope+'"]');
   assert.equal(await evaluate('document.getElementById("collectionPicker").open'),false);
   assert.equal(await evaluate('document.getElementById("categorySelect").value'),scope==='all'?'':scope);
   assert.equal(await evaluate('parseInt(document.getElementById("resultCount").textContent)'),total);
   assert.equal(await evaluate(`document.querySelector('#collectionOptions [data-scope="${scope}"]').getAttribute('aria-pressed')`),'true');
  }
  await evaluate('document.getElementById("collectionSummary").focus()');
  for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:type==='keyDown'?'\r':''});
  assert.equal(await evaluate('document.getElementById("collectionPicker").open'),true);
  await evaluate(`document.querySelector('#collectionOptions [data-scope="gensei"]').focus()`);
  for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:type==='keyDown'?'\r':''});
  assert.equal(await evaluate('document.getElementById("categorySelect").value'),'gensei');
  await evaluate('document.getElementById("clearFilter").click()');
  assert.equal(await evaluate('JSON.stringify(localStorage)'),storageBefore);
  const expected=await evaluate(`(()=>{const x=ONSEN_DATA[0],h=OnsenHost;h.setState(h.store.setVisited(h.getState(),x.id,true));const values={search:x.facility,prefSelect:x.prefecture,statusSelect:'visited',categorySelect:'chi'};for(const [id,v] of Object.entries(values)){const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event(id==='search'?'input':'change'))}return x.facility})()`);
  assert.ok((await evaluate(`document.getElementById('cards').textContent`)).includes(expected));
  await evaluate(`document.getElementById('statusSelect').value='unvisited';document.getElementById('statusSelect').dispatchEvent(new Event('change'))`);
  assert.equal(await evaluate(`document.querySelectorAll('#cards .facility-entry').length`),0);
  const p=await evaluate(`(()=>{const r=document.getElementById('clearFilter').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  if(width<400){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else{await send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});}
  assert.deepEqual(await evaluate(`['search','prefSelect','statusSelect','categorySelect'].map(id=>document.getElementById(id).value)`),['','','','']);
  assert.ok((await evaluate(`document.getElementById('resultCount').textContent`)).includes('67'));
  fs.writeFileSync(path.join(browser.profile,`search-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 }
 // A future facility is a browser-only fixture; the source master remains intact.
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`let qaRows;Object.defineProperty(window,'ONSEN_DATA',{configurable:true,get:()=>qaRows,set:v=>{qaRows=[...v,{...v[0],id:'qa-added-prefecture',prefecture:'沖縄県'}]}})`});
 await send('Page.reload');await wait(`!!window.OnsenHost&&window.ONSEN_DATA.length===69`);
 options=await candidates();assert.deepEqual(options.actual,options.expected);assert.equal(options.actual.at(-1),'沖縄県');assert.equal(options.actual.length,15);
 t.diagnostic('Screenshots: '+browser.profile);
});
