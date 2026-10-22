'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {delay,startBrowser}=require('./helpers/browser.cjs');

test('E2E: shared map detail, registered links, view preservation and local editing at 1280/390/320px',async t=>{
  const edge='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if(!fs.existsSync(edge)){t.skip('Edge not installed');return;}
  const server=http.createServer((req,res)=>{
    const file=path.resolve('.'+new URL(req.url,'http://localhost').pathname);
    if(!file.startsWith(process.cwd()+path.sep)){res.writeHead(403).end();return;}
    res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');
    fs.createReadStream(file).on('error',()=>res.writeHead(404).end()).pipe(res);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let browser;
  t.after(async()=>{await browser?.close();server.closeAllConnections();server.close();});
  browser=await startBrowser(edge,`http://127.0.0.1:${server.address().port}/index.html`);
  const {send,evaluate}=browser;
  const waitFor=async expr=>{for(let i=0;i<100;i++){if(await evaluate(expr))return;await delay(100);}assert.fail(expr);};
  const close=()=>evaluate("document.getElementById('modalClose').click()");
  await send('Page.enable');
  await waitFor("document.querySelectorAll('.japan-map-marker').length===67");
  await evaluate("new Promise(resolve=>{const s=document.createElement('script');s.src='vendor/leaflet/leaflet.js';s.onload=resolve;document.head.append(s)})");
  await evaluate("const factory=L.map;L.map=function(...args){window.qaMap=factory.apply(this,args);return qaMap}");
  const pointer=async(selector,touch)=>{
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);
    await delay(150);
    const point=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
    if(touch){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    else{await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});}
    await waitFor("document.getElementById('modalBg').style.display==='flex'");
  };
  const links=async()=>{
    await evaluate("document.querySelector('.modal').scrollTop=0");
    const result=await evaluate(`(()=>{const a=document.getElementById('detailMap'),r=a.getBoundingClientRect(),m=document.querySelector('.modal').getBoundingClientRect();return{href:a.getAttribute('href'),label:a.getAttribute('aria-label'),title:a.title,border:getComputedStyle(a).borderTopWidth,background:getComputedStyle(a).backgroundColor,svgWidth:a.querySelector('svg').getBoundingClientRect().width,svgHeight:a.querySelector('svg').getBoundingClientRect().height,target:a.target,rel:a.rel,tooltip:a.querySelector('[role=tooltip]').textContent,icon:!!a.querySelector('svg circle'),width:r.width,height:r.height,fits:r.left>=m.left&&r.right<=m.right,overflow:document.documentElement.scrollWidth>innerWidth,popup:!!document.querySelector('.leaflet-popup')}})()`);
    assert.equal(result.href,await evaluate("ONSEN_DATA.find(x=>x.id==='onsen-001').mapUrl"));
    assert.equal(result.label,'Google Mapsで開く');assert.equal(result.title,result.label);assert.equal(result.tooltip,result.label);assert.equal(result.border,'0px');assert.equal(result.background,'rgba(0, 0, 0, 0)');assert.equal(result.svgWidth,18);assert.equal(result.svgHeight,18);
    assert.equal(result.target,'_blank');assert.match(result.rel,/noopener/);assert.match(result.rel,/noreferrer/);
    assert.ok(result.icon&&result.width>=44&&result.height>=44&&result.fits&&!result.overflow);
    assert.equal(result.popup,false);
    if(await evaluate('innerWidth>=1000')){
      const point=await evaluate("(()=>{const r=document.getElementById('detailMap').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()");
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
      assert.equal(await evaluate("getComputedStyle(document.querySelector('#detailMap .map-tooltip')).visibility"),'visible');
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});
    }
    await evaluate("window.linkDefault=null;window.addEventListener('click',function check(e){if(e.target.closest('#detailMap')){window.linkDefault=e.defaultPrevented;e.preventDefault();window.removeEventListener('click',check)}},false);document.getElementById('detailMap').click()");
    assert.equal(await evaluate('window.linkDefault'),false);
  };
  const view=()=>evaluate("JSON.stringify({center:qaMap.getCenter(),zoom:qaMap.getZoom(),pref:document.getElementById('prefSelect').value,status:document.getElementById('statusSelect').value,search:document.getElementById('search').value,category:document.getElementById('categorySelect').value})");
  fs.mkdirSync('scratch/map-detail-ui',{recursive:true});
  for(const width of [1280,390,320]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<400});
    await send('Emulation.setTouchEmulationEnabled',{enabled:width<400});
    await evaluate("document.getElementById('resetPref').click()");await delay(400);
    const nationalBefore=await evaluate("document.querySelector('.geolonia-svg-map').getAttribute('viewBox')");
    await pointer('.japan-map-marker[data-onsen-id="onsen-001"]',width<400);await links();await close();
    assert.equal(await evaluate("document.querySelector('.geolonia-svg-map').getAttribute('viewBox')"),nationalBefore);
    assert.equal(await evaluate("document.getElementById('prefSelect').value"),'');
    await evaluate("document.getElementById('prefSelect').value='北海道';document.getElementById('prefSelect').dispatchEvent(new Event('change'))");
    await waitFor("!!window.qaMap && !!document.querySelector('.onsen-map-marker')");await delay(400);
    await evaluate("(()=>{const x=ONSEN_DATA.find(x=>x.id==='onsen-001');qaMap.setView([x.latitude,x.longitude],15,{animate:false});document.getElementById('mapStatus').value='';document.getElementById('mapStatus').dispatchEvent(new Event('change'))})()");
    const before=await view();
    await pointer('.onsen-map-marker[data-onsen-id="onsen-001"] span',width<400);await links();
    const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`scratch/map-detail-ui/detail-${width}.png`,Buffer.from(shot.data,'base64'));
    await close();assert.equal(await view(),before,'closing details preserves regional center, zoom and filters');
    // Keyboard entry shares the same panel and links.
    await evaluate("document.querySelector('.onsen-map-marker').dispatchEvent(new KeyboardEvent('keypress',{key:'Enter',keyCode:13,bubbles:true}))");
    await waitFor("document.getElementById('modalBg').style.display==='flex'");
    await evaluate(`document.getElementById('memoText').value='map detail test ${width}';document.getElementById('memoSave').click();document.getElementById('visitAdd').click();document.getElementById('visitDate').value='2026-10-20';document.getElementById('visitForm').requestSubmit()`);
    assert.equal(await evaluate("document.getElementById('memoText').value"),`map detail test ${width}`);
    assert.ok(await evaluate("document.getElementById('visitList').textContent.includes('2026-10-20')"));
    await close();assert.equal(await view(),before,'editing retains map view');
  }
  // Missing/unsafe URL combinations are fixtures in memory only; never change data.js.
  await evaluate("window.savedURLs={officialUrl:ONSEN_DATA[0].officialUrl,mapUrl:ONSEN_DATA[0].mapUrl}");
  for(const [official,map] of [[false,true],[true,false],[false,false],[true,'unsafe']]){
    await evaluate(`Object.assign(ONSEN_DATA[0],{officialUrl:${official?'savedURLs.officialUrl':"''"},mapUrl:${map==='unsafe'?"'javascript:alert(1)'":map?'savedURLs.mapUrl':"''"}});document.querySelector('.onsen-map-marker').click()`);
    assert.equal(await evaluate("!!document.querySelector('#modalSubtitle .facility-name-link')"),official);
    assert.equal(await evaluate("!!document.getElementById('detailMap')"),map===true);
    await close();
  }
  await evaluate('Object.assign(ONSEN_DATA[0],savedURLs)');
  const state=await evaluate("JSON.parse(localStorage.getItem('onsen-rally-user-v3'))");
  assert.equal(state.userData.schemaVersion,3);assert.equal(state.userData.visits['onsen-001'].records.length,3);
});
