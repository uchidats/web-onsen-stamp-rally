const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('Live GA4 production verification', async (t) => {
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
  const port = 9237;

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

    const requests=[],exceptions=[];
    ws.addEventListener('message',e=>{
      const m=JSON.parse(e.data);
      if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.text);
      if(m.method==='Network.requestWillBeSent'){
        const request=m.params.request,url=new URL(request.url);
        if(!/^(www\.googletagmanager\.com|(?:[a-z0-9-]+\.)*google-analytics\.com)$/.test(url.hostname))return;
        const parameters=new URLSearchParams(url.search);const body=(request.postData||'').split('\n').map(x=>new URLSearchParams(x));
        const events=[parameters.get('en'),...body.map(x=>x.get('en'))].filter(Boolean);
        requests.push({requestId:m.params.requestId,host:url.hostname,path:url.pathname,type:url.pathname.includes('/gtag/js')?'tag':'collect',measurementId:parameters.get('tid')||parameters.get('id'),events,pageLocation:parameters.get('dl')||body.find(x=>x.has('dl'))?.get('dl')||null,method:request.method});
      }
      if(m.method==='Network.responseReceived'){const r=requests.find(x=>x.requestId===m.params.requestId);if(r)r.status=m.params.response.status;}
      if(m.method==='Network.loadingFailed'){const r=requests.find(x=>x.requestId===m.params.requestId);if(r)r.failure=m.params.errorText;}
    });
    await send('Network.enable');await send('Runtime.enable');
    async function waitFor(expr){for(let i=0;i<150;i++){if(await evaluate(expr))return;await new Promise(r=>setTimeout(r,100));}assert.fail('Timed out: '+expr);}
    const production='https://uchidats.github.io/web-onsen-stamp-rally/';
    await send('Page.navigate',{url:production});
    await waitFor("document.readyState==='complete' && !!window.OnsenAnalytics && !document.getElementById('analyticsNotice').hidden");
    await new Promise(r=>setTimeout(r,1800));
    assert.equal(requests.length,0,'No Google requests before consent');
    assert.equal(await evaluate("OnsenAnalytics.config.measurementId"),'G-5P0Y0M7SNM');
    await evaluate("document.getElementById('analyticsAccept').click();document.getElementById('analyticsAccept').click()");
    await waitFor("!!window.google_tag_manager && dataLayer.some(x=>x[0]==='event'&&x[1]==='page_view')");
    await new Promise(r=>setTimeout(r,5000));
    assert.equal(requests.filter(x=>x.type==='tag').length,1);
    const pageViews=requests.flatMap(x=>x.events.filter(e=>e==='page_view').map(()=>x));
    assert.equal(pageViews.length,1,JSON.stringify(requests.map(({requestId,...x})=>x)));
    assert.equal(pageViews[0].measurementId,'G-5P0Y0M7SNM');
    assert.equal(pageViews[0].pageLocation,production);
    assert.ok([200,204].includes(pageViews[0].status),'GA collect response must succeed');
    await evaluate("document.getElementById('search').value='青森';document.getElementById('search').dispatchEvent(new Event('input'));document.getElementById('analyticsSettings').click()");
    await new Promise(r=>setTimeout(r,1000));
    assert.equal(requests.flatMap(x=>x.events.filter(e=>e==='page_view')).length,1);
    assert.equal(await evaluate("document.getElementById('resultCount').textContent"),'4 件の温泉');
    assert.equal(exceptions.length,0,JSON.stringify(exceptions));
    const result={url:production,measurementId:'G-5P0Y0M7SNM',preConsentGoogleRequests:0,postConsentPageViews:1,requests:requests.map(({requestId,...x})=>x),exceptions,verifiedAt:new Date().toISOString()};
    fs.mkdirSync('scratch/ga4-live',{recursive:true});fs.writeFileSync('scratch/ga4-live/result.json',JSON.stringify(result,null,2));
    console.log(JSON.stringify(result,null,2));ws.close();
  }finally{edge.kill();server.closeAllConnections();server.close();}
});
