const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('E2E: facility name links and map icons fit desktop and mobile cards', async (t) => {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (!fs.existsSync(edgePath)) {
    t.skip('Edge not installed at standard path');
    return;
  }

  const fixtures=Array.from({length:8},(_,i)=>({id:'onsen-'+String(i+1).padStart(3,'0'),prefecture:'青森県',category:'独自セレクション',onsen:'レイアウト検証温泉 '+(i+1),facility:i<4?'検証の温泉宿 '+(i+1):'長い宿名でも自然に読める静かな温泉旅館'.repeat(4),officialUrl:i%2?'https://example.com/':'',mapUrl:i%4>=2?'https://maps.google.com/':'',latitude:null,longitude:null,coordinateVerified:false}));
  const server = require('node:http').createServer((req,res)=>{
    if(new URL(req.url,'http://localhost').pathname.endsWith('/data.js')){res.setHeader('Content-Type','application/javascript; charset=utf-8');res.end('window.ONSEN_DATA='+JSON.stringify(fixtures)+';');return;}
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

    async function waitFor(expr){for(let i=0;i<100;i++){if(await evaluate(expr))return;await new Promise(r=>setTimeout(r,100));}assert.fail('Timed out: '+expr);}
    const results=[];
    fs.mkdirSync('scratch/card-layout-qa',{recursive:true});
    for(const width of [1440,768,390,320]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<400});
      await evaluate("document.getElementById('onsens').scrollIntoView()");
      await new Promise(r=>setTimeout(r,150));
      const layout=await evaluate(`(() => {
        const cards=[...document.querySelectorAll('#cards .card')];
        return {overflow:document.documentElement.scrollWidth>innerWidth,cards:cards.map((card,i)=>{
          const row=card.querySelector('.facility'),name=row.querySelector('.facility-name'),pin=row.querySelector('.map-link');
          const r=row.getBoundingClientRect(),n=name.getBoundingClientRect(),p=pin?.getBoundingClientRect();
          return {id:ONSEN_DATA[i].id,official:name.tagName==='A',map:!!pin,name:name.textContent,
            officialUrl:name.href,mapLabel:pin?.getAttribute('aria-label'),safe:!pin||(pin.target==='_blank'&&pin.rel.includes('noopener')),
            font:parseFloat(getComputedStyle(name).fontSize),headingFont:parseFloat(getComputedStyle(card.querySelector('h3')).fontSize),descriptionFont:parseFloat(getComputedStyle(card.querySelector('.desc')).fontSize),
            contained:n.left>=r.left-1&&n.right<=r.right+1&&(!p||p.right<=r.right+1),
            grouped:!p||(Math.abs(p.left-n.right-6)<1&&Math.abs(p.top-r.top)<1),
            noSeparateOfficial:!row.querySelector('.facility-link'),direct:!pin||pin.parentElement===row};
        })};
      })()`);
      assert.equal(layout.overflow,false,`${width}px: no page overflow`);
      assert.equal(layout.cards.length,8);
      for(const [i,c] of layout.cards.entries()){
        assert.equal(c.official,!!fixtures[i].officialUrl);
        assert.equal(c.map,!!fixtures[i].mapUrl);
        assert.equal(c.name,fixtures[i].facility);
        if(c.official)assert.equal(c.officialUrl,fixtures[i].officialUrl);
        if(c.map)assert.ok(c.mapLabel.includes('Google Maps')&&c.mapLabel.includes(fixtures[i].facility));
        assert.ok(c.font>c.descriptionFont&&c.font<c.headingFont);
        assert.ok(c.contained&&c.grouped&&c.safe&&c.direct&&c.noSeparateOfficial,JSON.stringify({width,...c}));
        await evaluate(`document.querySelector('[data-detail="${c.id}"]').click()`);
        assert.equal(await evaluate("document.getElementById('modalTitle').textContent"),fixtures[i].onsen);
        assert.equal(await evaluate("document.querySelector('#modalSubtitle .facility-name').textContent"),fixtures[i].facility);
        await evaluate("document.getElementById('modalClose').click()");
      }
      results.push({width,...layout});
      const bounds=await evaluate("(()=>{const r=document.getElementById('cards').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");
      const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:bounds});
      fs.writeFileSync(`scratch/card-layout-qa/cards-${width}.png`,Buffer.from(shot.data,'base64'));
    }
    fs.writeFileSync('scratch/card-layout-qa/results.json',JSON.stringify(results,null,2));
    ws.close();
  }finally{edge.kill();server.closeAllConnections();server.close();}
});
