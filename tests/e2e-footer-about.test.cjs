'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {startBrowser,delay}=require('./helpers/browser.cjs');
test('E2E: compact footer, site information, privacy entry and keyboard return at desktop/mobile widths',async t=>{
  const edge='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if(!fs.existsSync(edge)){t.skip('Edge not installed');return;}
  const server=http.createServer((req,res)=>{
    const file=path.resolve('.'+new URL(req.url,'http://localhost').pathname);
    if(!file.startsWith(process.cwd()+path.sep)){res.writeHead(403).end();return;}
    res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');
    fs.createReadStream(file).on('error',()=>res.writeHead(404).end()).pipe(res);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let browser;t.after(async()=>{await browser?.close();server.closeAllConnections();server.close();});
  browser=await startBrowser(edge,`http://127.0.0.1:${server.address().port}/index.html`);
  const {send,evaluate}=browser;
  const waitFor=async expr=>{for(let i=0;i<100;i++){if(await evaluate(expr))return;await delay(100);}assert.fail(expr);};
  const key=async(key,code=key,windowsVirtualKeyCode=27,modifiers=0)=>{for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode,modifiers,text:key==='Enter'&&type==='keyDown'?'\r':''});};
  const click=async(selector,touch)=>{
    // 直前のスクリーンショット(captureBeyondViewport)でスクロール位置が戻ることがあるため、実利用と同じく押す前に対象を表示範囲へ入れる
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);await delay(100);
    const point=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);
    if(touch){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    else{await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});}
  };
  await send('Page.enable');await waitFor("document.readyState==='complete' && !!window.OnsenAnalytics && document.querySelectorAll('.japan-map-marker').length===67");
  await evaluate('document.fonts.ready');
  const originalStorage=await evaluate('JSON.stringify(localStorage)');
  const output='scratch/footer-about-ui';fs.mkdirSync(output,{recursive:true});
  const results=[];
  for(const width of [1280,390,320]){
    const touch=width<400;
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:touch});
    await send('Emulation.setTouchEmulationEnabled',{enabled:touch});
    await evaluate("document.activeElement.blur();document.querySelector('.footer').scrollIntoView({block:'center'})");await delay(250);
    const layout=await evaluate("(()=>{const f=document.querySelector('.footer'),r=f.getBoundingClientRect(),b=document.getElementById('aboutOpen').getBoundingClientRect();return{text:f.textContent,inside:r.left>=0&&r.right<=innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,height:r.height,tapHeight:b.height,shot:{x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}}})()");
    assert.ok(layout.inside&&!layout.overflow&&layout.tapHeight>=44);
    assert.match(layout.text,/♨ 温泉の旅.*© 2026/);assert.ok(layout.text.includes('このサイトについて'));
    assert.ok(!layout.text.includes('施設情報')&&!layout.text.includes('クラウド'));
    const footerShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:layout.shot});fs.writeFileSync(`${output}/footer-${width}.png`,Buffer.from(footerShot.data,'base64'));
    await click('#aboutOpen',touch);await waitFor("document.getElementById('aboutDialog').open");
    assert.equal(await evaluate('document.activeElement.id'),'aboutClose');
    const about=await evaluate("(()=>{const d=document.getElementById('aboutDialog'),r=d.getBoundingClientRect();return{text:d.textContent,inside:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,overflow:d.scrollWidth>d.clientWidth}})()");
    assert.ok(about.inside&&!about.overflow);assert.ok(about.text.includes('訪問前に必ず公式情報で確認'));
    assert.ok(about.text.includes('クラウドにも保存されます'));assert.ok(about.text.includes('プライバシー・アクセス解析の設定'));
    const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`${output}/about-${width}.png`,Buffer.from(shot.data,'base64'));
    await key('Tab','Tab',9);assert.equal(await evaluate('document.activeElement.id'),'analyticsSettings');
    await key('Enter','Enter',13);await waitFor("document.getElementById('privacyDialog').open");
    assert.equal(await evaluate("document.getElementById('aboutDialog').open"),true);
    await key('Escape');await waitFor("!document.getElementById('privacyDialog').open");
    assert.equal(await evaluate('document.activeElement.id'),'analyticsSettings');
    assert.equal(await evaluate("document.getElementById('aboutDialog').open"),true);
    await key('Escape');await waitFor("!document.getElementById('aboutDialog').open");
    assert.equal(await evaluate('document.activeElement.id'),'aboutOpen');
    await click('#aboutOpen',touch);await click('#aboutClose',touch);await waitFor("!document.getElementById('aboutDialog').open");
    assert.equal(await evaluate('document.activeElement.id'),'aboutOpen');
    assert.equal(await evaluate('JSON.stringify(localStorage)'),originalStorage);
    assert.equal(await evaluate("!!document.getElementById('onsenGtag')"),false);
    results.push({width,footerHeight:layout.height,tapHeight:layout.tapHeight,keyboard:true,privacyNavigation:true,storageUnchanged:true});
  }
  fs.writeFileSync(output+'/results.json',JSON.stringify(results,null,2));
});
