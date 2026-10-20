const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
test('Visit stamps fit all facilities, long names and tags at three widths and follow visit deletion',async t=>{
 const browser=await require('./helpers/browser.cjs').startBrowser('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',pathToFileURL(path.resolve('index.html')).href);
 t.after(()=>browser.close());const {send,evaluate}=browser;
 await send('Page.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['https://*']});
 for(let i=0;i<100;i++){if(await evaluate('!!window.OnsenHost'))break;await new Promise(r=>setTimeout(r,50));}
 await evaluate('document.fonts.ready');
 assert.equal(await evaluate('document.querySelectorAll(".conquered-badge").length'),0);
 for(const width of [1280,390,320]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<400});
  await evaluate(`(()=>{let s=OnsenHost.getState();for(const x of ONSEN_DATA)s=OnsenHost.store.setVisited(s,x.id,true);OnsenHost.setState(s);while(!document.getElementById('showMore').classList.contains('hide'))document.getElementById('showMore').click()})()`);
  const layout=await evaluate(`(()=>{const rows=[...document.querySelectorAll('.facility-entry')];return {count:rows.length,stamps:document.querySelectorAll('.conquered-badge').length,overflow:document.documentElement.scrollWidth>innerWidth,valid:rows.every(row=>{const badge=row.querySelector('.conquered-badge'),b=badge.getBoundingClientRect(),r=row.getBoundingClientRect(),s=getComputedStyle(badge);return row.getAttribute('aria-label').includes('訪問済み')&&badge.getAttribute('aria-hidden')==='true'&&badge.textContent===''&&badge.querySelectorAll('circle').length===1&&badge.querySelectorAll('path').length>0&&s.opacity==='0.6'&&s.pointerEvents==='none'&&parseFloat(s.width)===${width>600?66:52}&&b.left>=r.left&&b.right<=r.right+1&&b.top>=r.top-1&&b.bottom<=r.bottom+1&&[...row.querySelectorAll('.facility-name,.facility-meta > *,.bath-colors,.kake-wrap,.gensei-wrap')].every(e=>e.getBoundingClientRect().right<=b.left)})}})()`);
  assert.deepEqual(layout,{count:67,stamps:67,overflow:false,valid:true});
  assert.equal(await evaluate(`(()=>{const s=document.querySelector('.conquered-badge');return getComputedStyle(s.querySelector('path')).fill===getComputedStyle(s).color})()`),true,'The spring glyph uses the same gold as its circle');
  for(const [label,selector] of [['single','[data-facility-id="onsen-001"]'],['group','[data-group="nyuto"]'],['long','[data-facility-id="onsen-017"]']]){
   await evaluate(`document.querySelector('${selector}').scrollIntoView({block:'center',behavior:'instant'})`);
   fs.writeFileSync(path.join(browser.profile,`stamp-${label}-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  await evaluate(`OnsenHost.setState(OnsenHost.store.setVisited(OnsenHost.getState(),'onsen-015',false))`);
  assert.equal(await evaluate(`!!document.querySelector('[data-facility-id="onsen-015"] .conquered-badge')`),false);
  assert.equal(await evaluate(`document.querySelector('[data-facility-id="onsen-015"]').getAttribute('aria-label').includes('未訪問')`),true);
  assert.equal(await evaluate(`!!document.querySelector('[data-facility-id="onsen-016"] .conquered-badge')`),true);
 }
 t.diagnostic('Screenshots: '+browser.profile);
});
