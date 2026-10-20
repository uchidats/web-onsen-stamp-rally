const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

test('Four progress rings: responsive layout, percentages, record edits, backup restore and passive display', async t => {
  const server = http.createServer((req, res) => {
    const file = path.resolve('.' + new URL(req.url, 'http://localhost').pathname);
    if (!file.startsWith(process.cwd() + path.sep)) { res.writeHead(403).end(); return; }
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' };
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).on('error', () => res.writeHead(404).end()).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const browser = await require('./helpers/browser.cjs').startBrowser(
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    `http://127.0.0.1:${server.address().port}/index.html`
  );
  t.after(() => browser.close());
  const { send, evaluate, ws } = browser;
  await send('Page.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://*'] });
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true });
  });
  const wait = async expr => {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(expr)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.fail('Timed out: ' + expr);
  };
  await wait("document.readyState==='complete' && document.getElementById('totalText').textContent==='0 / 67 施設'");
  await evaluate('document.fonts.ready');
  const seed = count => evaluate(`(()=>{const h=OnsenHost;let state=h.store.replace(h.store.empty(),h.getState(),true);for(const x of ONSEN_DATA.slice(0,${count}))state=h.store.setVisited(state,x.id,true);h.setState(state)})()`);
  async function check() {
    const rings = await evaluate(`(()=>{
      const predicates=[()=>true,x=>['現・旧','現（新規）','旧（掲載終了）'].includes(x.category),x=>!!ONSEN_KAKENAGASHI[x.id],x=>ONSEN_GENSEI.certifiedBaths(ONSEN_KAKENAGASHI[x.id]||null).length>0];
      return ['all','chi','kake','gensei'].map((scope,i)=>{
        const rows=ONSEN_DATA.filter(predicates[i]),done=rows.filter(x=>OnsenRecords.summary(OnsenHost.getState().userData.visits[x.id]).visited).length,p=rows.length?Math.round(done/rows.length*1000)/10:0;
        const percent=document.getElementById(scope==='all'?'totalPercent':'progress-'+scope+'-percent'),count=document.getElementById(scope==='all'?'totalText':'progress-'+scope+'-count'),circle=document.getElementById('progress-'+scope+'-ring');
        return {scope,done,total:rows.length,p,percent:percent.textContent,count:count.textContent,offset:Number(circle.style.strokeDashoffset),visible:circle.style.visibility,pathLength:circle.getAttribute('pathLength')};
      });
    })()`);
    for (const ring of rings) {
      assert.equal(ring.percent, ring.p.toFixed(1) + '%');
      assert.equal(ring.count, `${ring.done} / ${ring.total} 施設`);
      assert.equal(ring.offset, 100 - ring.p);
      assert.equal(ring.visible, ring.p ? 'visible' : 'hidden');
      assert.equal(ring.pathLength, '100');
    }
    return rings;
  }
  for (const width of [1280, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 400 });
    for (const count of [0, 17, 67]) {
      await seed(count);
      const rings = await check();
      const layout = await evaluate(`(()=>{
        const cards=[...document.querySelectorAll('.progress-card')],rects=cards.map(e=>e.getBoundingClientRect());
        return {columns:new Set(rects.map(r=>Math.round(r.left))).size,rows:new Set(rects.map(r=>Math.round(r.top))).size,overflow:document.documentElement.scrollWidth>innerWidth,contained:cards.every(e=>{const r=e.getBoundingClientRect();return [...e.querySelectorAll('h3,.progress-ring,.progress-percent,.progress-count')].every(x=>{const b=x.getBoundingClientRect();return b.left>=r.left&&b.right<=r.right&&b.top>=r.top&&b.bottom<=r.bottom})}),controls:document.querySelectorAll('#progressRings button,#progressRings a,#progressRings select,#progressScope,#totalBar').length};
      })()`);
      assert.deepEqual(layout, { columns: width === 1280 ? 4 : 2, rows: width === 1280 ? 1 : 2, overflow: false, contained: true, controls: 0 });
      assert.deepEqual(rings.map(r => r.total), [67, 43, 51, 7]);
      await evaluate("document.getElementById('progress').scrollIntoView({block:'center',behavior:'instant'})");
      await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(browser.profile, `rings-${width}-${count}.png`), Buffer.from(shot.data, 'base64'));
    }
    await seed(0);
    await evaluate("document.querySelector('[data-detail=\"onsen-001\"]').click();document.getElementById('detailStamp').click()");
    await check();
    await evaluate("document.getElementById('visitAdd').click();document.getElementById('visitUnknown').checked=true;document.getElementById('visitUnknown').dispatchEvent(new Event('change'));document.getElementById('visitForm').requestSubmit()");
    assert.equal(await evaluate("OnsenHost.getState().userData.visits['onsen-001'].records.length"), 2);
    assert.equal((await check())[0].done, 1);
    await evaluate("document.querySelector('[data-delete-visit]').click()");
    await wait("OnsenHost.getState().userData.visits['onsen-001'].records.length===1");
    assert.equal((await check())[0].done, 1);
    await evaluate("document.querySelector('[data-delete-visit]').click()");
    await wait("OnsenHost.getState().userData.visits['onsen-001'].records.length===0");
    assert.equal((await check())[0].done, 0);
    await evaluate("document.getElementById('modalClose').click()");
    await seed(17);
    await send('Browser.setDownloadBehavior', { behavior: 'deny' });
    await evaluate("(()=>{const original=URL.createObjectURL;URL.createObjectURL=blob=>{window.qaBackup=blob.text();return original.call(URL,blob)};document.getElementById('exportBtn').click()})()");
    const backup = JSON.parse(await evaluate('qaBackup'));
    assert.equal(backup.format, 'onsen-stamp-rally-v3');
    const file = path.join(browser.profile, `restore-${width}.json`);
    fs.writeFileSync(file, JSON.stringify(backup));
    await seed(0);
    const doc = await send('DOM.getDocument');
    const node = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#importFile' });
    await send('DOM.setFileInputFiles', { nodeId: node.nodeId, files: [file] });
    await wait("document.getElementById('totalText').textContent==='17 / 67 施設'");
    await check();
    await evaluate("document.getElementById('search').value='乳頭';document.getElementById('search').dispatchEvent(new Event('input'))");
    const before = await evaluate("JSON.stringify({search:document.getElementById('search').value,pref:document.getElementById('prefSelect').value,category:document.getElementById('categorySelect').value,cards:document.getElementById('cards').innerHTML,map:document.getElementById('mapPref').value,storage:JSON.stringify(localStorage)})");
    await evaluate("document.querySelectorAll('.progress-card').forEach(e=>e.click())");
    assert.equal(await evaluate("JSON.stringify({search:document.getElementById('search').value,pref:document.getElementById('prefSelect').value,category:document.getElementById('categorySelect').value,cards:document.getElementById('cards').innerHTML,map:document.getElementById('mapPref').value,storage:JSON.stringify(localStorage)})"), before);
    await check();
    await evaluate("document.getElementById('search').value='';document.getElementById('search').dispatchEvent(new Event('input'))");
    console.log(JSON.stringify({ width, states: [0, 17, 67], addDelete: true, repeatedVisits: true, restore: true, passive: true, screenshots: browser.profile }));
  }
});
