const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
test('Facility badges and whole-onsen stamps follow full master groups, filters and deletion at three widths',async t=>{
 const browser=await require('./helpers/browser.cjs').startBrowser('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',pathToFileURL(path.resolve('index.html')).href);
 t.after(()=>browser.close());const {send,evaluate}=browser;
 await send('Page.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['https://*']});
 for(let i=0;i<100;i++){if(await evaluate('!!window.OnsenHost'))break;await new Promise(r=>setTimeout(r,50));}
 await evaluate('document.fonts.ready');
 assert.equal(await evaluate('document.querySelectorAll(".conquered-badge").length'),0);
 for(const width of [1280,390,320]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<400});
  await evaluate(`(()=>{let s=OnsenHost.store.replace(OnsenHost.store.empty(),OnsenHost.getState(),true);s=OnsenHost.store.addVisit(s,'onsen-015',null);s=OnsenHost.store.addVisit(s,'onsen-015',null);OnsenHost.setState(s);document.getElementById('search').value='乳頭温泉郷';document.getElementById('search').dispatchEvent(new Event('input'))})()`);
  assert.equal(await evaluate(`document.querySelectorAll('.conquered-badge').length`),1);
  assert.equal(await evaluate(`document.querySelectorAll('.onsen-stamp').length`),0,'Repeated visits do not complete the second facility');
  await evaluate(`document.getElementById('statusSelect').value='visited';document.getElementById('statusSelect').dispatchEvent(new Event('change'))`);
  assert.equal(await evaluate(`document.querySelectorAll('.facility-entry').length`),1);
  assert.equal(await evaluate(`document.querySelectorAll('.onsen-stamp').length`),0,'Hiding unvisited facilities never completes a group');
  await evaluate(`document.getElementById('clearFilter').click()`);
  await evaluate(`(()=>{let s=OnsenHost.getState();for(const x of ONSEN_DATA)s=OnsenHost.store.setVisited(s,x.id,true);OnsenHost.setState(s);while(!document.getElementById('showMore').classList.contains('hide'))document.getElementById('showMore').click()})()`);
  const layout=await evaluate(`(()=>{const cards=[...document.querySelectorAll('#cards .card')];return {count:document.querySelectorAll('.facility-entry').length,badges:document.querySelectorAll('.conquered-badge').length,stamps:document.querySelectorAll('.onsen-stamp').length,overflow:document.documentElement.scrollWidth>innerWidth,valid:cards.every(card=>{const badge=card.querySelector('.onsen-stamp'),b=badge.getBoundingClientRect(),r=card.getBoundingClientRect(),s=getComputedStyle(badge);return card.querySelectorAll('.onsen-stamp').length===1&&card.getAttribute('aria-label').includes('温泉地制覇')&&badge.getAttribute('aria-hidden')==='true'&&badge.textContent===''&&badge.querySelectorAll('circle').length===1&&Math.abs(b.top+b.height/2-r.top-r.height/2)<1&&s.opacity==='0.6'&&s.pointerEvents==='none'&&parseFloat(s.width)===${width>600?66:52}&&b.right<=r.right&&b.top>=r.top&&b.bottom<=r.bottom&&[...card.querySelectorAll('.facility-name,.facility-meta > *,.conquered-badge,.bath-colors,.kake-wrap,.gensei-wrap')].every(e=>e.getBoundingClientRect().right<=b.left)})}})()`);
  assert.deepEqual(layout,{count:67,badges:67,stamps:62,overflow:false,valid:true});
  assert.equal(await evaluate(`(()=>{const s=document.querySelector('.onsen-stamp');return getComputedStyle(s.querySelector('path')).fill===getComputedStyle(s).color})()`),true,'The spring glyph uses the same gold as its circle');
  for(const [label,selector] of [['single','[data-facility-id="onsen-001"]'],['group','[data-group="nyuto"]'],['long','[data-facility-id="onsen-017"]']]){
   await evaluate(`document.querySelector('${selector}').scrollIntoView({block:'center',behavior:'instant'})`);
   fs.writeFileSync(path.join(browser.profile,`stamp-${label}-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  await evaluate(`(()=>{const s=OnsenHost.getState();OnsenHost.setState(OnsenHost.store.deleteVisit(s,'onsen-015',s.userData.visits['onsen-015'].records[0].id))})()`);
  assert.equal(await evaluate(`!!document.querySelector('[data-group="nyuto"] .onsen-stamp')`),true,'A remaining visit still counts the facility');
  await evaluate(`(()=>{const s=OnsenHost.getState();OnsenHost.setState(OnsenHost.store.deleteVisit(s,'onsen-015',s.userData.visits['onsen-015'].records[0].id))})()`);
  assert.equal(await evaluate(`!!document.querySelector('[data-facility-id="onsen-015"] .conquered-badge')`),false);
  assert.equal(await evaluate(`document.querySelector('[data-facility-id="onsen-015"]').getAttribute('aria-label').includes('未訪問')`),true);
  assert.equal(await evaluate(`!!document.querySelector('[data-facility-id="onsen-016"] .conquered-badge')`),true);
  assert.equal(await evaluate(`!!document.querySelector('[data-group="nyuto"] .onsen-stamp')`),false);
  await evaluate(`OnsenHost.setState(OnsenHost.store.setVisited(OnsenHost.getState(),'onsen-001',false))`);
  assert.equal(await evaluate(`document.querySelector('[data-group="onsen-001"]').querySelectorAll('.conquered-badge,.onsen-stamp').length`),0);
 }
 t.diagnostic('Screenshots: '+browser.profile);
});
