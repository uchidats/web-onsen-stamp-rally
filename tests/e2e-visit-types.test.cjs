const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
test('Visit type UI adds, edits, leaves unset labels out and retains backup data at three widths',async t=>{
 const remote=process.env.ONSEN_VISIT_TYPES_URL;
 if(remote&&new URL(remote).origin!=='https://my-onsen-journey-staging.web.app')throw Error('Only the staging site can be used for this isolated-profile UI test');
 const browser=await require('./helpers/browser.cjs').startBrowser('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',remote||pathToFileURL(path.resolve('index.html')).href);
 t.after(()=>browser.close());const {send,evaluate}=browser;
 await send('Page.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:remote?['https://*.googleapis.com/*','https://*.gstatic.com/*','https://*.openstreetmap.org/*']:['https://*']});
 for(let i=0;i<100;i++){if(await evaluate('!!window.OnsenHost'))break;await new Promise(r=>setTimeout(r,50));}await evaluate('document.fonts.ready');
 for(const width of [1280,390,320]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<400});await send('Emulation.setTouchEmulationEnabled',{enabled:width<400});
  await evaluate(`(()=>{const h=OnsenHost;let s=h.store.replace(h.store.empty(),h.getState(),true);s=h.store.addVisit(s,'onsen-001',null);s=h.store.setNotes(s,'onsen-001','残すメモ');h.setState(s);document.querySelector('[data-detail="onsen-001"]').click()})()`);
  assert.equal(await evaluate(`document.querySelectorAll('#visitList .visit-type').length`),0);
  await evaluate(`document.getElementById('visitAdd').click()`);
  assert.equal(await evaluate(`document.getElementById('visitType').value`),'');
  const box=await evaluate(`(()=>{const e=document.getElementById('visitType'),r=e.getBoundingClientRect(),m=document.querySelector('.modal');return {height:r.height,fits:r.left>=0&&r.right<=innerWidth,overflow:m.scrollWidth>m.clientWidth,options:[...e.options].map(o=>o.textContent)}})()`);
  assert.ok(box.height>=44&&box.fits&&!box.overflow);assert.deepEqual(box.options,['未設定','日帰り','宿泊']);
  fs.writeFileSync(path.join(browser.profile,`visit-type-form-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  for(const type of ['day','stay']){
   await evaluate(`document.getElementById('visitUnknown').checked=true;document.getElementById('visitUnknown').dispatchEvent(new Event('change'));document.getElementById('visitType').value='${type}';document.getElementById('visitForm').requestSubmit()`);
   if(type==='day')await evaluate(`document.getElementById('visitAdd').click()`);
  }
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('#visitList .visit-type')].map(e=>e.textContent)`),['日帰り','宿泊']);
  const id=await evaluate(`OnsenHost.getState().userData.visits['onsen-001'].records[1].id`);
  await evaluate(`document.querySelector('[data-edit-visit="${id}"]').click()`);
  assert.equal(await evaluate(`document.getElementById('visitType').value`),'day');
  await evaluate(`document.getElementById('visitType').value='stay';document.getElementById('visitForm').requestSubmit()`);
  const saved=await evaluate(`OnsenHost.backup()`);assert.equal(saved.userData.visits['onsen-001'].records[1].id,id);assert.equal(saved.userData.visits['onsen-001'].records[1].visitType,'stay');assert.equal(saved.userData.visits['onsen-001'].notes,'残すメモ');assert.equal(saved.userData.visits['onsen-001'].visitCount,3);
  await evaluate(`document.querySelector('[data-edit-visit="${id}"]').click();document.getElementById('visitType').value='';document.getElementById('visitForm').requestSubmit()`);
  assert.equal(await evaluate(`document.querySelectorAll('#visitList .visit-type').length`),1);assert.equal(await evaluate(`document.getElementById('visitList').textContent.includes('未設定')`),false);
  await evaluate(`document.getElementById('visitList').scrollIntoView({block:'center',behavior:'instant'})`);
  fs.writeFileSync(path.join(browser.profile,`visit-type-list-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate(`document.querySelector('[data-edit-visit="${id}"]').click();OnsenHost.setState(OnsenHost.store.editVisit(OnsenHost.getState(),'onsen-001','${id}',null,'day'));document.getElementById('visitForm').requestSubmit()`);
  assert.equal(await evaluate(`OnsenHost.getState().userData.visits['onsen-001'].records[1].visitType`),'day','An open stale form never overwrites a newer synced value');
  assert.ok((await evaluate(`document.getElementById('visitError').textContent`)).includes('更新されました'));
  await evaluate(`document.getElementById('modalClose').click()`);
 }
 t.diagnostic('Screenshots: '+browser.profile);
});
