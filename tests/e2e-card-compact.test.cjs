const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('E2E: compact Grid cards, natural heights, ordering, filters and independent visits', async (t) => {
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
    const before=process.env.CARD_COMPACT_BASELINE==='1'&&['app.js','design.css'].includes(path.basename(file));
    const source=before?path.resolve('scratch/card-compact-qa','before-'+path.basename(file)):file;
    fs.createReadStream(source).on('error',()=>res.writeHead(404).end()).pipe(res);
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
      const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      return res.result?.value;
    }

    await send('Page.enable');
    ws.addEventListener('message',event=>{if(JSON.parse(event.data).method==='Page.javascriptDialogOpening')send('Page.handleJavaScriptDialog',{accept:true});});

    for (let attempt = 0; attempt < 50; attempt++) {
      if (await evaluate(`!!document.querySelector('.geolonia-svg-map .prefecture')`)) break;
      await new Promise(r => setTimeout(r, 100));
    }

    async function waitFor(expr){for(let i=0;i<100;i++){if(await evaluate(expr))return;await new Promise(r=>setTimeout(r,100));}assert.fail('Timed out: '+expr);}
    const baseline=process.env.CARD_COMPACT_BASELINE==='1',phase=baseline?'before':'after',results=[];
    fs.mkdirSync('scratch/card-compact-qa',{recursive:true});
    async function settle(){await evaluate('document.fonts.ready.then(()=>true)');await new Promise(r=>setTimeout(r,180));}
    async function measure(){return evaluate(`(() => {
      const container=document.getElementById('cards'),bounds=container.getBoundingClientRect();
      const cards=[...container.querySelectorAll('.card')].map(c=>{const r=c.getBoundingClientRect();return {id:c.dataset.group,x:r.left-bounds.left,y:r.top-bounds.top,width:r.width,height:r.height};});
      const gaps=cards.map((c,i)=>{const above=cards.slice(0,i).filter(a=>Math.abs(a.x-c.x)<1).at(-1);return above?c.y-above.y-above.height:null}).filter(g=>g!==null);
      const rows=[...container.querySelectorAll('.facility-entry')];
      return {display:getComputedStyle(container).display,inlinePositioning:[...container.querySelectorAll('.card')].some(c=>c.style.top||c.style.left||c.style.width),padding:parseFloat(getComputedStyle(container.querySelector('.card-content')||container).paddingTop),overflow:document.documentElement.scrollWidth>innerWidth,containerHeight:bounds.height,cards,gaps,columns:new Set(cards.map(c=>Math.round(c.x))).size,
        contained:rows.every(row=>[...(row.querySelector('.facility-meta')||row.querySelector('.facility')).children].every(e=>e.getBoundingClientRect().right<=row.getBoundingClientRect().right+1)),
        facilities:rows.map(r=>r.dataset.facilityId)};
    })()`);}
    function verify(layout,width){
      assert.equal(layout.overflow,false);assert.equal(layout.contained,true);
      if(baseline)return;
      assert.equal(layout.columns,layout.cards.length?Math.min(width>600?2:1,layout.cards.length):0);
      if(!layout.cards.length)return;
      assert.ok(Math.max(...layout.cards.map(c=>c.width))-Math.min(...layout.cards.map(c=>c.width))<1);
      assert.equal(layout.cards[0].y,0);
      for(let i=1;i<layout.cards.length;i++)assert.ok(layout.cards[i].y>=layout.cards[i-1].y-1,'visual top-to-bottom order stays in DOM order');
      for(const gap of layout.gaps)assert.ok(gap>=(width>600?16:14)-1,'Grid row gap: '+gap);
      for(let i=0;i<layout.cards.length;i++){
        const card=layout.cards[i];assert.equal(Math.round(card.x),i%layout.columns===0?0:Math.round(layout.cards[1].x));
        if(i%layout.columns===1)assert.equal(card.y,layout.cards[i-1].y,'row-major order');
      }
      assert.equal(layout.display,'grid');assert.equal(layout.inlinePositioning,false);
      assert.equal(layout.padding,16);
      assert.ok(layout.containerHeight>=Math.max(...layout.cards.map(c=>c.y+c.height)),'container encloses cards');
    }
    for(const width of [1440,1280,768,390,320]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<400});
      await evaluate("document.getElementById('clearFilter').click();document.getElementById('onsens').scrollIntoView()");await settle();
      const initial=await measure();verify(initial,width);
      await evaluate("document.getElementById('toast').style.display='none'");
      const bounds=await evaluate("(()=>{const r=document.getElementById('cards').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");
      const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:bounds});
      fs.writeFileSync(`scratch/card-compact-qa/${phase}-${width}.png`,Buffer.from(shot.data,'base64'));
      await evaluate("while(!document.getElementById('showMore').classList.contains('hide'))document.getElementById('showMore').click()");await settle();
      const all=await measure();verify(all,width);assert.equal(all.cards.length,62);assert.equal(new Set(all.facilities).size,67);
      const scenarios=[];
      for(const [control,value] of [['prefSelect','秋田県'],['search','乳頭温泉郷'],['search','妙乃湯'],['search','存在しない温泉地']]){
        await evaluate(`document.getElementById('clearFilter').click();document.getElementById('${control}').value=${JSON.stringify(value)};document.getElementById('${control}').dispatchEvent(new Event('${control==='search'?'input':'change'}'))`);await settle();
        const layout=await measure();verify(layout,width);scenarios.push({control,value,...layout});
      }
      await evaluate("document.getElementById('clearFilter').click();document.querySelector('[data-detail=onsen-015]').click();document.getElementById('detailStamp').click();document.getElementById('modalClose').click()");await settle();
      const visited=await measure();verify(visited,width);
      assert.equal(await evaluate("document.querySelector('[data-facility-id=onsen-015]').classList.contains('is-visited')"),true);
      assert.equal(await evaluate("document.querySelector('[data-facility-id=onsen-016]').classList.contains('is-unvisited')"),true);
      await evaluate("document.getElementById('toast').style.display='none'");
      const visitedBounds=await evaluate("(()=>{const r=document.querySelector('[data-group=nyuto]').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");
      const visitedShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:visitedBounds});
      fs.writeFileSync(`scratch/card-compact-qa/${phase}-visited-${width}.png`,Buffer.from(visitedShot.data,'base64'));
      await evaluate("document.getElementById('statusSelect').value='visited';document.getElementById('statusSelect').dispatchEvent(new Event('change'))");await settle();
      const filtered=await measure();verify(filtered,width);assert.deepEqual(filtered.facilities,['onsen-015']);
      await evaluate("document.getElementById('clearFilter').click();document.querySelector('[data-detail=onsen-015]').click();document.querySelector('[data-delete-visit]').click();document.getElementById('modalClose').click()");await settle();verify(await measure(),width);
      results.push({width,initial,all,scenarios,visited,filtered});
    }
    fs.writeFileSync(`scratch/card-compact-qa/${phase}-results.json`,JSON.stringify(results,null,2));

    ws.close();
  }finally{edge.kill();server.closeAllConnections();server.close();}
});
