const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('analytics.js','utf8');
function run(url='https://uchidats.github.io/web-onsen-stamp-rally/',saved=null,blocked=false){
  const scripts=[],reads=[],writes=[],nodes={};for(const id of ['analyticsNotice','analyticsSettings','analyticsChoice','analyticsAccept','analyticsDecline','analyticsMessage','analyticsNoticeAccept','analyticsNoticeDecline','analyticsControls','privacyDialog','privacyMore','privacyClose'])nodes[id]={hidden:true,open:false,textContent:'',focus(){this.focused=true;},showModal(){this.open=true;},close(){this.open=false;}};
  const location=new URL(url);location.reload=()=>location.reloads=(location.reloads||0)+1;
  const storage={getItem(k){reads.push(k);if(blocked)throw Error('blocked');return saved;},setItem(k,v){writes.push([k,v]);if(blocked)throw Error('blocked');saved=v;}};
  const cookies=new Map([['_ga','synthetic'],['other_cookie','keep']]);
  const document={readyState:'complete',get cookie(){return Array.from(cookies,([k,v])=>k+'='+v).join('; ');},set cookie(value){const [k,v]=value.split(';')[0].split('=');if(value.includes('Max-Age=0'))cookies.delete(k);else cookies.set(k,v);},head:{appendChild(s){scripts.push(s);}},getElementById:id=>nodes[id],createElement:()=>({})};
  const root={location,localStorage:storage};const context={window:root,document,Date,Object,Number,JSON,console};
  vm.runInNewContext(source,context);return {root,document,scripts,reads,writes,nodes,again:()=>vm.runInNewContext(source,context),commands:()=>Array.from(root.dataLayer||[],x=>Array.from(x))};
}
const valid=choice=>JSON.stringify({version:1,choice,expiresAt:Date.now()+86400000});
test('Production ID and explicit consent gate: one page_view, sanitized metadata, ads denied',()=>{
  const r=run('https://uchidats.github.io/web-onsen-stamp-rally/?comment=synthetic-private&visit=2026-01-01#memo');
  assert.equal(r.root.OnsenAnalytics.config.measurementId,'G-5P0Y0M7SNM');assert.equal(r.scripts.length,0);assert.equal(r.root.dataLayer,undefined);assert.equal(r.nodes.analyticsNotice.hidden,false);
  r.root.OnsenAnalytics.setConsent('granted');r.nodes.analyticsAccept.onclick();r.again();assert.equal(r.scripts.length,1);
  const script=r.scripts[0];assert.equal(script.src,'https://www.googletagmanager.com/gtag/js?id=G-5P0Y0M7SNM');assert.equal(script.async,true);
  const commands=r.commands();assert.equal(commands.find(x=>x[0]==='config')[2].send_page_view,false);assert.equal(commands.find(x=>x[0]==='config')[2].allow_google_signals,false);
  assert.equal(commands.filter(x=>x[0]==='event').length,0);script.onload();script.onload();r.nodes.analyticsAccept.onclick();assert.equal(r.commands().filter(x=>x[0]==='event').length,1);
  const event=r.commands().find(x=>x[0]==='event');assert.equal(event[1],'page_view');assert.equal(event[2].page_location,'https://uchidats.github.io/web-onsen-stamp-rally/');assert.equal(event[2].page_referrer,'');
  assert.equal(/synthetic-private|2026-01-01|#memo/.test(JSON.stringify(r.commands())),false);
  assert.ok(r.commands().filter(x=>x[0]==='consent').every(x=>x[2].ad_storage==='denied'&&x[2].ad_user_data==='denied'&&x[2].ad_personalization==='denied'));
  assert.ok(r.reads.every(k=>k==='onsen-analytics-consent-v1'));assert.ok(r.writes.every(([k])=>k==='onsen-analytics-consent-v1'));
});
test('Local, file, unrelated GitHub Pages projects and other origins never load Google, even with saved consent',()=>{
  for(const url of ['file:///C:/site/index.html','http://localhost:5500/','https://localhost/','http://127.0.0.1:5500/','https://127.0.0.1/','http://[::1]/','https://uchidats.github.io/other/','https://uchidats.github.io/web-onsen-stamp-rally/preview.html','https://example.com/web-onsen-stamp-rally/','http://uchidats.github.io/web-onsen-stamp-rally/']){
    const r=run(url,valid('granted'));r.root.OnsenAnalytics.setConsent('granted');assert.equal(r.scripts.length,0,url);assert.equal(r.root.dataLayer,undefined,url);assert.equal(r.reads.length,0,url);assert.equal(r.nodes.analyticsNotice.hidden,true,url);
  }
});
test('Denied, expired, malformed and blocked preferences do not auto-send; stored grants work',()=>{
  for(const saved of [valid('denied'),'{}','not JSON',JSON.stringify({version:1,choice:'granted',expiresAt:0}),JSON.stringify({version:2,choice:'granted',expiresAt:Date.now()+86400000})]){const r=run(undefined,saved);assert.equal(r.scripts.length,0);}
  const r=run('https://uchidats.github.io/web-onsen-stamp-rally/index.html',valid('granted'));assert.equal(r.scripts.length,1);r.scripts[0].onload();assert.equal(r.commands().filter(x=>x[0]==='event').length,1);
  const blocked=run(undefined,null,true);assert.equal(blocked.scripts.length,0);blocked.root.OnsenAnalytics.setConsent('granted');blocked.scripts[0].onload();assert.equal(blocked.commands().filter(x=>x[0]==='event').length,1);
});
test('Decline remains usable; withdrawal disables GA, clears only analytics cookies and unloads tag',()=>{
  const r=run();r.nodes.analyticsNoticeDecline.onclick();assert.equal(r.scripts.length,0);assert.equal(r.nodes.analyticsNotice.hidden,true);r.nodes.analyticsSettings.onclick();assert.equal(r.nodes.privacyDialog.open,true);assert.equal(r.nodes.analyticsNotice.hidden,true);
  r.nodes.analyticsAccept.onclick();r.nodes.analyticsDecline.onclick();r.scripts[0].onload();assert.equal(r.root['ga-disable-G-5P0Y0M7SNM'],true);assert.equal(r.root.location.reloads,1);assert.equal(r.commands().filter(x=>x[0]==='event').length,0);assert.equal(r.document.cookie,'other_cookie=keep');
});
test('Settings keep explanations off the homepage and allow closing without choosing, including non-production',()=>{
  const r=run();r.nodes.privacyMore.onclick();assert.equal(r.nodes.privacyDialog.open,true);assert.equal(r.nodes.analyticsNotice.hidden,true);
  let cancelled=false;r.nodes.privacyDialog.oncancel({preventDefault(){cancelled=true;}});assert.equal(cancelled,true);assert.equal(r.nodes.privacyDialog.open,false);assert.equal(r.nodes.analyticsNotice.hidden,false);assert.equal(r.scripts.length,0);
  const local=run('http://localhost:5500/');local.nodes.analyticsSettings.onclick();assert.equal(local.nodes.privacyDialog.open,true);assert.equal(local.nodes.analyticsControls.hidden,true);assert.equal(local.scripts.length,0);assert.equal(local.reads.length,0);
  const html=fs.readFileSync('index.html','utf8'),footer=html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/)[1];
  assert.ok(footer.includes('このサイトについて'));assert.ok(!footer.includes('analyticsChoice'));assert.ok(!html.includes('<section id="privacy-notice"'));
  const dialog=html.match(/<dialog id="privacyDialog"[^>]*>([\s\S]*?)<\/dialog>/)[1];assert.ok(dialog.includes('180日間'));assert.ok(dialog.includes('https://policies.google.com/privacy'));assert.ok(dialog.includes('https://policies.google.com/technologies/partner-sites'));
  const start=Date.now();r.nodes.analyticsNoticeDecline.onclick();assert.ok(JSON.parse(r.writes.at(-1)[1]).expiresAt>=start+180*86400000);
});
test('Load failure does not send page views or interfere with the application; head has one initializer',()=>{
  const r=run();r.nodes.analyticsAccept.onclick();r.scripts[0].onerror();assert.equal(r.commands().filter(x=>x[0]==='event').length,0);assert.ok(r.nodes.analyticsMessage.textContent.includes('温泉の機能'));
  const html=fs.readFileSync('index.html','utf8');assert.equal((html.match(/src="analytics[.]js[?]v=privacy-dialog-1"/g)||[]).length,1);assert.ok(html.slice(0,html.indexOf('</head>')).includes('src="analytics.js?v=privacy-dialog-1" defer'));
  assert.equal(html.includes('googletagmanager.com/gtag/js'),false);
});
