const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('E2E: production consent, GA4 loading, page view deduplication and app isolation', async (t) => {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (!fs.existsSync(edgePath)) {
    t.skip('Edge not installed at standard path');
    return;
  }

  const server = require('node:http').createServer((req,res)=>{
    const file = path.resolve('.'+new URL(req.url,'http://localhost').pathname.replace(/^\/web-onsen-stamp-rally\//,'/'));
    if(!file.startsWith(process.cwd()+path.sep)){res.writeHead(403).end();return;}
    const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)];
    if(type)res.setHeader('Content-Type',type);
    fs.createReadStream(file).on('error',()=>res.writeHead(404).end()).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  // Match the GitHub Pages project subdirectory as well as local HTTP behavior.
  const htmlUrl = `http://127.0.0.1:${server.address().port}/web-onsen-stamp-rally/index.html`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'onsen-map-browser-'));
  const port = 9225;

  const edge = spawn(edgePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    htmlUrl
  ]);

  try {
    await new Promise(r => setTimeout(r, 1200));

    let res;
    for(let i=0;i<50;i++){try{res=await fetch(`http://127.0.0.1:${port}/json`);break;}catch{await new Promise(r=>setTimeout(r,200));}}
    assert.ok(res,'Edge debugging endpoint must start');
    const pages = await res.json();
    const page = pages.find(p => p.type === 'page' && p.url === htmlUrl);
    assert.ok(page, 'Application browser page must be available');

    const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let idSeq = 0;
    function send(method, params = {}) {
      return new Promise((resolve) => {
        const id = ++idSeq;
        const onMsg = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id === id) {
            ws.removeEventListener('message', onMsg);
            resolve(msg.result);
          }
        };
        ws.addEventListener('message', onMsg);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    async function evaluate(expr) {
      const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
      return res.result?.value;
    }

    await send('Page.enable');

    for (let attempt = 0; attempt < 50; attempt++) {
      if (await evaluate(`!!document.querySelector('.geolonia-svg-map .prefecture')`)) break;
      await new Promise(r => setTimeout(r, 100));
    }

    const tagRequests=[],unexpectedCollect=[],exceptions=[];
    ws.addEventListener('message',async e=>{
      const m=JSON.parse(e.data);
      if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.text);
      if(m.method!=='Fetch.requestPaused')return;
      const {requestId,request}=m.params,url=new URL(request.url);
      if(url.hostname==='uchidats.github.io'){
        const file=path.resolve(url.pathname.replace('/web-onsen-stamp-rally/','')||'index.html');
        if(!file.startsWith(process.cwd()+path.sep)||!fs.existsSync(file)){await send('Fetch.failRequest',{requestId,errorReason:'Failed'});return;}
        const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'}[path.extname(file)]||'application/octet-stream';
        await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:type}],body:fs.readFileSync(file).toString('base64')});
      }else if(url.hostname==='www.googletagmanager.com'){
        tagRequests.push(request.url);
        await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/javascript'}],body:Buffer.from('window.__gaTestLoaded=true;').toString('base64')});
      }else{unexpectedCollect.push(request.url);await send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});}
    });
    await send('Runtime.enable');
    await send('Fetch.enable',{patterns:[{urlPattern:'https://uchidats.github.io/web-onsen-stamp-rally/*'},{urlPattern:'https://www.googletagmanager.com/*'},{urlPattern:'*google-analytics.com/*'}]});
    async function waitFor(expr){for(let i=0;i<100;i++){if(await evaluate(expr))return;await new Promise(r=>setTimeout(r,100));}assert.fail('Timed out: '+expr);}
    assert.equal(await evaluate("!!document.getElementById('analyticsNotice').hidden"),true);
    assert.equal(tagRequests.length,0);
    const production='https://uchidats.github.io/web-onsen-stamp-rally/?comment=synthetic-private#visit-date';
    await send('Page.navigate',{url:production});
    await waitFor("document.readyState==='complete' && !!window.OnsenAnalytics && !document.getElementById('analyticsNotice').hidden");
    assert.equal(tagRequests.length,0,'No Google requests before consent');
    assert.equal(await evaluate("document.getElementById('privacyDialog').open"),false);
    await evaluate("document.getElementById('privacyMore').focus();document.getElementById('privacyMore').click()");
    assert.equal(await evaluate("document.getElementById('privacyDialog').open"),true);
    assert.equal(tagRequests.length,0,'Reading settings never starts GA');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await waitFor("!document.getElementById('privacyDialog').open");
    assert.equal(await evaluate("document.activeElement.id"),'privacyMore');
    await evaluate("document.querySelector('[data-detail=onsen-002]').click();document.getElementById('privacyMore').click()");
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await waitFor("!document.getElementById('privacyDialog').open");
    assert.equal(await evaluate("document.getElementById('modalBg').style.display"),'flex','Closing privacy must preserve the underlying facility detail');
    await evaluate("document.getElementById('modalClose').click()");
    await evaluate("document.querySelector('[data-visit=\"onsen-002\"]').click();document.getElementById('search').value='青森';document.getElementById('search').dispatchEvent(new Event('input'))");
    assert.equal(await evaluate("document.getElementById('resultCount').textContent"),'4 件の温泉');
    const visits=await evaluate("localStorage.getItem('onsen-rally-user-v3')");
    for(const width of [1440,1280,768,390,320]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<400});
      assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true);
      fs.mkdirSync('scratch/analytics-qa',{recursive:true});const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('scratch/analytics-qa/consent-'+width+'.png',Buffer.from(shot.data,'base64'));
      await evaluate("document.getElementById('analyticsSettings').focus();document.getElementById('analyticsSettings').click()");
      const dialogLayout=await evaluate("(()=>{const d=document.getElementById('privacyDialog'),r=d.getBoundingClientRect();return {open:d.open,inside:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,overflow:d.scrollWidth>d.clientWidth}})()");
      assert.equal(dialogLayout.open,true);assert.equal(dialogLayout.inside,true);assert.equal(dialogLayout.overflow,false);
      const settingsShot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('scratch/analytics-qa/settings-'+width+'.png',Buffer.from(settingsShot.data,'base64'));
      await evaluate("document.getElementById('privacyClose').click()");
      assert.equal(await evaluate("document.activeElement.id"),'analyticsSettings');
    }
    await send('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});
    await evaluate("document.getElementById('analyticsSettings').click();document.getElementById('analyticsAccept').scrollIntoView({block:'nearest'})");
    assert.equal(await evaluate("(()=>{const d=document.getElementById('privacyDialog').getBoundingClientRect(),b=document.getElementById('analyticsAccept').getBoundingClientRect();return d.top>=0&&d.bottom<=innerHeight&&b.top>=d.top&&b.bottom<=d.bottom})()"),true,'Short mobile viewport keeps settings and consent actions reachable');
    const shortShot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('scratch/analytics-qa/settings-320-short.png',Buffer.from(shortShot.data,'base64'));
    await evaluate("document.getElementById('privacyClose').click()");
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});
    await evaluate("document.getElementById('analyticsNoticeDecline').click()");
    assert.equal(tagRequests.length,0);
    await send('Page.reload');await waitFor("document.readyState==='complete' && window.OnsenAnalytics?.getConsent()==='denied'");assert.equal(tagRequests.length,0,'Saved denial remains silent after reload');
    await evaluate("document.getElementById('analyticsSettings').click();document.getElementById('analyticsAccept').click();document.getElementById('analyticsAccept').click()");
    await waitFor("window.__gaTestLoaded && dataLayer.some(x=>x[0]==='event')");
    assert.equal(tagRequests.length,1);assert.equal(tagRequests[0],'https://www.googletagmanager.com/gtag/js?id=G-5P0Y0M7SNM');
    const commands=await evaluate("Array.from(dataLayer,x=>Array.from(x))");
    const events=commands.filter(x=>x[0]==='event');assert.equal(events.length,1);assert.equal(events[0][1],'page_view');
    assert.equal(events[0][2].page_location,'https://uchidats.github.io/web-onsen-stamp-rally/');assert.equal(events[0][2].page_referrer,'');
    assert.equal(JSON.stringify(commands).includes('synthetic-private'),false);assert.equal(JSON.stringify(commands).includes('onsen-002'),false);
    assert.equal(await evaluate("localStorage.getItem('onsen-rally-user-v3')"),visits);
    await send('Page.reload');await waitFor("document.readyState==='complete' && window.__gaTestLoaded && window.OnsenAnalytics?.getConsent()==='granted'");
    assert.equal(tagRequests.length,2,'Saved consent loads once on the next document');
    assert.equal(await evaluate("dataLayer.filter(x=>x[0]==='event').length"),1);
    await evaluate("document.getElementById('search').value='';document.getElementById('search').dispatchEvent(new Event('input'));document.querySelector('.pref[data-pref=\"青森県\"]').click()");
    await waitFor("!!document.querySelector('#mapCanvas .leaflet-marker-icon')");
    assert.equal(await evaluate("document.getElementById('mapHeading').textContent"),'青森県の温泉マップ');
    assert.equal(await evaluate("dataLayer.filter(x=>x[0]==='event').length"),1,'Map and search must not send new events');
    await evaluate("document.getElementById('analyticsSettings').click();document.getElementById('analyticsDecline').click()");
    await waitFor("document.readyState==='complete' && window.OnsenAnalytics?.getConsent()==='denied'");
    assert.equal(await evaluate("!!document.querySelector('#onsenGtag')"),false);assert.equal(tagRequests.length,2);
    assert.equal(await evaluate("localStorage.getItem('onsen-rally-user-v3')"),visits);
    assert.equal(exceptions.length,0,JSON.stringify(exceptions));assert.equal(unexpectedCollect.length,0);
    fs.writeFileSync('scratch/analytics-qa/results.json',JSON.stringify({tagRequests,pageView:events[0],exceptions,unexpectedCollect,productionContent:'local source intercepted at production URL; Google script stubbed, no live GA data sent'},null,2));
    ws.close();
  }finally{edge.kill();server.closeAllConnections();server.close();}
});
