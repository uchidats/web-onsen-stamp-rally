const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
test('Detail onsen name uses the bath heading Mincho family, remains subordinate and wraps at three widths',async t=>{
 const browser=await require('./helpers/browser.cjs').startBrowser('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',pathToFileURL(path.resolve('index.html')).href);
 t.after(()=>browser.close());const {send,evaluate}=browser;
 await send('Page.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['https://*']});
 for(let i=0;i<100;i++){if(await evaluate('!!window.OnsenHost'))break;await new Promise(r=>setTimeout(r,50));}
 await evaluate('document.fonts.ready');
 const ids=await evaluate(`['onsen-001',ONSEN_DATA.reduce((a,b)=>a.onsen.length>b.onsen.length?a:b).id]`);
 for(const width of [1280,390,320]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<400});
  for(const id of ids){
   await evaluate(`(()=>{const e=document.querySelector('.japan-map-marker[data-onsen-id="${id}"]');e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))})()`);
   const layout=await evaluate(`(()=>{const e=document.getElementById('modalTitle'),s=getComputedStyle(e),h=getComputedStyle(document.getElementById('featureBathsHeading')),f=getComputedStyle(document.querySelector('#modalSubtitle .facility-name')),r=e.getBoundingClientRect(),m=document.querySelector('.modal').getBoundingClientRect();return {size:parseFloat(s.fontSize),sameFamily:s.fontFamily===h.fontFamily,weight:s.fontWeight,subordinate:parseFloat(s.fontSize)<parseFloat(f.fontSize),margin:s.margin,color:s.color,expectedColor:getComputedStyle(document.documentElement).getPropertyValue('--muted').trim(),fits:r.left>=m.left&&r.right<=m.right,overflow:document.querySelector('.modal').scrollWidth>document.querySelector('.modal').clientWidth}})()`);
   assert.equal(layout.size,16);assert.ok(layout.size/13>=1.2&&layout.size/13<=1.3);assert.ok(layout.sameFamily&&layout.subordinate&&layout.fits&&!layout.overflow,JSON.stringify(layout));assert.equal(layout.weight,'600');assert.equal(layout.margin,'12px 0px 6px');
   assert.equal(await evaluate(`document.getElementById('modalTitle').textContent===ONSEN_DATA.find(x=>x.id==='${id}').onsen`),true);
   fs.writeFileSync(path.join(browser.profile,`title-${width}-${id}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
   await evaluate(`document.getElementById('modalClose').click()`);
  }
 }
 t.diagnostic('Screenshots: '+browser.profile);
});
