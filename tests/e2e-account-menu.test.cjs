const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const FAKE=fs.readFileSync(path.join(__dirname,'helpers/fake-cloud.cjs'),'utf8')+`
window.__cloud=new FakeCloud();let user=null,changed;
const sdk={initializeApp:()=>({}),getAuth:()=>({get currentUser(){return user}}),onAuthStateChanged:(a,fn)=>{changed=fn;Promise.resolve().then(()=>fn(user))},setPersistence:async()=>{},browserSessionPersistence:'s',browserLocalPersistence:'l',GoogleAuthProvider:class{setCustomParameters(){}},signInWithPopup:async()=>{user={uid:'menu-test',displayName:'テスト 太郎'};changed(user)},signOut:async()=>{user=null;changed(null)}};
window.ONSEN_FIREBASE={sdkVersion:'10.14.1',loadSdk:async()=>sdk,syncAdapterFactory:()=>__cloud.adapter(),environments:{local:{hosts:['127.0.0.1'],sync:true,config:{apiKey:'fake',authDomain:'fake.firebaseapp.com',projectId:'fake-menu',appId:'fake'}}}};
`;
test('account settings: 1280/390/320px, keyboard/outside/Esc, status/errors, disclosure and original deletion gates preserve records',async t=>{
 const edge='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';if(!fs.existsSync(edge)){t.skip('Edge unavailable');return;}
 const http=require('node:http'),server=http.createServer((req,res)=>{const p=path.resolve('.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(process.cwd()+path.sep)){res.writeHead(403).end();return;}const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'}[path.extname(p)];if(type)res.setHeader('Content-Type',type);fs.createReadStream(p).on('error',()=>res.writeHead(404).end()).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 t.after(async()=>{await browser?.close();server.closeAllConnections();server.close();});
 browser=await require('./helpers/browser.cjs').startBrowser(edge,`http://127.0.0.1:${server.address().port}/index.html`);
 const {send,evaluate}=browser,wait=async expr=>{for(let i=0;i<100;i++){if(await evaluate(expr))return;await new Promise(r=>setTimeout(r,100));}assert.fail('timeout '+expr);};
 await send('Page.enable');await wait("window.OnsenHost && window.OnsenAuth");
 await evaluate("let s=OnsenHost.store.addVisit(OnsenHost.getState(),'onsen-001',null);s=OnsenHost.store.setNotes(s,'onsen-001','UI試験のメモ');OnsenHost.setState(s)");
 const original=await evaluate("localStorage.getItem('onsen-rally-user-v3')");
 await send('Page.addScriptToEvaluateOnNewDocument',{source:FAKE});
 const output='scratch/account-menu-ui';fs.mkdirSync(output,{recursive:true});
 const results=[];
 for(const width of [1280,390,320]){
  await evaluate("localStorage.removeItem('onsen-rally-sync-v1')");
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<400});await send('Page.reload');
  await wait("window.OnsenSync && document.getElementById('accountPanel').parentElement===document.body && document.getElementById('accountSettings').getAttribute('aria-expanded')==='false' && OnsenAuth.controller.getSession().ready");
  assert.equal(await evaluate("document.getElementById('accountPanel').hidden"),true);
  await evaluate("document.getElementById('accountSettings').focus()");await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  t.diagnostic(await evaluate("JSON.stringify({width:innerWidth,active:document.activeElement.id,expanded:document.getElementById('accountSettings').getAttribute('aria-expanded'),hidden:document.getElementById('accountPanel').hidden})"));
  await wait("!document.getElementById('accountPanel').hidden");
  assert.equal(await evaluate("document.activeElement.id"),'accountPanelClose');
  await evaluate("document.getElementById('loginBtn').click()");await wait("document.getElementById('syncDialog').open");
  await evaluate("document.getElementById('syncConfirm').click()");await wait("document.getElementById('accountCompactStatus').textContent==='✓ 同期済み'");
  assert.equal(await evaluate("document.getElementById('accountPanel').hidden"),true);
  for(const expanded of [false,true]){
   if(expanded){
    const gear=JSON.parse(await evaluate("JSON.stringify((()=>{const r=document.getElementById('accountSettings').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})())"));
    await send('Input.dispatchMouseEvent',{type:'mousePressed',...gear,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',...gear,button:'left',clickCount:1});
   }
   const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`${output}/${width}-${expanded?'open':'closed'}.png`,Buffer.from(shot.data,'base64'));
  }
  const layout=JSON.parse(await evaluate(`(()=>{const p=document.getElementById('accountPanel').getBoundingClientRect(),g=document.getElementById('accountSettings').getBoundingClientRect(),a=document.querySelector('.logo').getBoundingClientRect();return JSON.stringify({width,left:p.left,right:p.right,bottom:p.bottom,gearWidth:g.width,gearHeight:g.height,sameHeaderRow:a.right<=g.left,overflow:document.documentElement.scrollWidth>innerWidth,panelColor:getComputedStyle(document.getElementById('accountPanel')).backgroundColor})})()` .replace('JSON.stringify({width,','JSON.stringify({width:'+width+',')));
  assert.ok(layout.left>=0&&layout.right<=width&&layout.bottom<=900&&!layout.overflow&&layout.gearWidth>=44&&layout.gearHeight>=44&&layout.sameHeaderRow,JSON.stringify(layout));
  assert.equal(layout.panelColor,'rgb(45, 69, 59)');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  assert.equal(await evaluate('document.activeElement.tagName'),'SUMMARY');
  assert.equal(await evaluate("document.querySelector('.account-cloud-info').open"),false);
  await evaluate("document.querySelector('.account-cloud-info summary').click()");assert.equal(await evaluate("document.querySelector('.account-cloud-info').open"),true);
  await evaluate("document.querySelector('.account-cloud-info summary').click()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await wait("document.getElementById('accountPanel').hidden");assert.equal(await evaluate('document.activeElement.id'),'accountSettings');
  await evaluate("document.getElementById('accountSettings').click();document.querySelector('.hero h1').click()");assert.equal(await evaluate("document.getElementById('accountPanel').hidden"),true);
  await evaluate("document.getElementById('accountSettings').click();document.getElementById('accountSettings').click()");assert.equal(await evaluate("document.getElementById('accountPanel').hidden"),true);
  await evaluate("document.getElementById('syncStatus').dataset.state='error';document.getElementById('syncStatus').textContent='同期: 同期エラー — 試験用'");await wait("document.getElementById('accountCompactStatus').textContent.includes('同期エラー')");
  await evaluate("document.getElementById('accountSettings').click();document.getElementById('cloudDeleteOpen').click()");await wait("document.getElementById('cloudDeleteDialog').open");assert.equal(await evaluate("document.getElementById('accountPanel').hidden"),true);
  assert.equal(await evaluate("document.getElementById('cloudDeleteRun').disabled"),true);
  await evaluate("document.getElementById('cloudDeleteAck').click()");assert.equal(await evaluate("document.getElementById('cloudDeleteRun').disabled"),true);
  await evaluate("document.getElementById('cloudDeleteWord').value='削除';document.getElementById('cloudDeleteWord').dispatchEvent(new Event('input'))");assert.equal(await evaluate("document.getElementById('cloudDeleteRun').disabled"),false);
  await evaluate("document.getElementById('cloudDeleteClose').click()");assert.equal(await evaluate("localStorage.getItem('onsen-rally-user-v3')"),original);
  await evaluate("document.getElementById('accountSettings').click();document.getElementById('loginBtn').click()");await wait("OnsenAuth.controller.getSession().uid===null");await wait("document.getElementById('accountCompactStatus').textContent==='端末内保存'");
  results.push(layout);
 }
 fs.writeFileSync(output+'/results.json',JSON.stringify({results,recordsUnchanged:true,realCloudAccess:false},null,2)+'\n');
});
