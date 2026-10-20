const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('E2E: compact progress summary states and backup restore', async (t) => {
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
  let browser;
  t.after(async () => { await browser?.close(); server.closeAllConnections(); server.close(); });
  browser = await require('./helpers/browser.cjs').startBrowser(edgePath, htmlUrl);
  const { ws, send, evaluate, profile } = browser;
  try {

    await send('Page.enable');

    for (let attempt = 0; attempt < 50; attempt++) {
      if (await evaluate(`!!document.querySelector('.geolonia-svg-map .prefecture')`)) break;
      await new Promise(r => setTimeout(r, 100));
    }

    async function waitFor(expr){for(let i=0;i<100;i++){if(await evaluate(expr))return;await new Promise(r=>setTimeout(r,100));}assert.fail('Timed out: '+expr);}
    let dialogs=0;
    ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Page.javascriptDialogOpening'){dialogs++;send('Page.handleJavaScriptDialog',{accept:true});}});
    await send('Browser.setDownloadBehavior',{behavior:'deny'});
    await send('Page.setInterceptFileChooserDialog',{enabled:true});
    fs.mkdirSync('scratch/progress-summary-qa',{recursive:true});
    const results=[];
    for(const width of [1440,1280,768,390,320]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<400});
      for(const count of [0,17,67]){
        await evaluate(`(()=>{localStorage.clear();const repo=OnsenRecords.create(localStorage);let state=repo.load();for(const x of ONSEN_DATA.slice(0,${count}))state=repo.setVisited(state,x.id,true);location.reload();})()`);
        await waitFor(`document.readyState==='complete' && document.getElementById('totalText').textContent.startsWith('${count} / 67')`);
        await evaluate("document.getElementById('progress').scrollIntoView({block:'center'})");
        const pct=Math.round(count/67*1000)/10;
        assert.equal(await evaluate("document.getElementById('totalPercent').textContent"),pct+'%');
        assert.equal(await evaluate("document.getElementById('nextCount').textContent"),`未訪問 ${67-count} 施設`);
        assert.equal(await evaluate("document.getElementById('totalBar').style.width"),pct+'%');
        assert.equal(await evaluate("document.getElementById('progressScope').value"),'all');
        const scopeDone=await evaluate(`ONSEN_DATA.slice(0,${count}).filter(x=>['現・旧','現（新規）','旧（掲載終了）'].includes(x.category)).length`);
        await evaluate("document.getElementById('progressScope').value='chi';document.getElementById('progressScope').dispatchEvent(new Event('change'))");
        assert.equal(await evaluate("document.getElementById('totalText').textContent"),`${scopeDone} / 43 施設を訪問済み`);
        assert.equal(await evaluate("document.getElementById('totalPercent').textContent"),Math.round(scopeDone/43*1000)/10+'%');
        assert.equal(await evaluate("document.getElementById('nextCount').textContent"),`未訪問 ${43-scopeDone} 施設`);
        assert.equal(await evaluate("document.getElementById('totalBar').style.width"),Math.round(scopeDone/43*1000)/10+'%');
        await evaluate("document.getElementById('progressScope').value='all';document.getElementById('progressScope').dispatchEvent(new Event('change'))");
        const layout=await evaluate(`(()=>{
          const panel=document.querySelector('.progress-summary'),r=panel.getBoundingClientRect();
          const boxes=['.progress-total .stathead','#progressScope','#totalPercent','#nextCount','#totalText'].map(s=>{const e=panel.querySelector(s);if(s==='#totalPercent'){const range=document.createRange();range.selectNodeContents(e);return range.getBoundingClientRect();}return e.getBoundingClientRect();});
          return {panels:document.querySelectorAll('#progress .panel').length,height:r.height,overflow:document.documentElement.scrollWidth>innerWidth,contained:boxes.every(b=>b.left>=r.left&&b.right<=r.right&&b.top>=r.top&&b.bottom<=r.bottom),overlap:boxes.some((a,i)=>boxes.slice(i+1).some(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1))};
        })()`);
        assert.equal(layout.panels,1);assert.equal(layout.overflow,false);assert.equal(layout.contained,true);assert.equal(layout.overlap,false);
        if(width===1440)assert.ok(layout.height>=100&&layout.height<=150,JSON.stringify(layout));
        const screenshot=await send('Page.captureScreenshot',{format:'png'});
        fs.writeFileSync(`scratch/progress-summary-qa/${width}-${count}.png`,Buffer.from(screenshot.data,'base64'));
        // Exercise the existing visit button, then the actual backup and restore handlers.
        await evaluate("document.getElementById('progressScope').value='chi';document.getElementById('progressScope').dispatchEvent(new Event('change'))");
        await evaluate(`document.querySelector('[data-detail="${count===67?'onsen-001':'onsen-'+String(count+1).padStart(3,'0')}"]').click();if(${count}===67){document.querySelector('[data-delete-visit]').click()}else{document.getElementById('detailStamp').click()}document.getElementById('modalClose').click()`);
        const selectedDone=await evaluate("(()=>{const state=OnsenRecords.create(localStorage).load();return ONSEN_DATA.filter(x=>['現・旧','現（新規）','旧（掲載終了）'].includes(x.category)&&OnsenRecords.summary(state.userData.visits[x.id]).visited).length})()");
        assert.equal(await evaluate("document.getElementById('progressScope').value"),'chi');
        assert.equal(await evaluate("document.getElementById('totalText').textContent"),`${selectedDone} / 43 施設を訪問済み`);
        await evaluate("document.getElementById('progressScope').value='all';document.getElementById('progressScope').dispatchEvent(new Event('change'))");
        const updated=count===67?66:count+1;
        await waitFor(`document.getElementById('totalText').textContent.startsWith('${updated} / 67')`);
        await evaluate("(()=>{const original=URL.createObjectURL;URL.createObjectURL=blob=>{window.qaBackup=blob.text();return original.call(URL,blob)};document.getElementById('exportBtn').click();})()");
        const backup=JSON.parse(await evaluate('qaBackup'));
        assert.equal(backup.format,'onsen-stamp-rally-v3');
        assert.equal(Object.values(backup.userData.visits).filter(v=>v.records.length>0).length,updated);
        const restoreFile=path.join(profile,'restore.json');fs.writeFileSync(restoreFile,JSON.stringify(backup));
        await evaluate("localStorage.clear();location.reload()");
        await waitFor("document.readyState==='complete' && document.getElementById('totalText').textContent.startsWith('0 / 67')");
        await evaluate("document.getElementById('importBtn').click()");
        const doc=await send('DOM.getDocument');
        const node=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#importFile'});
        const before=dialogs;
        await evaluate("document.getElementById('progressScope').value='chi';document.getElementById('progressScope').dispatchEvent(new Event('change'))");
        await send('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[restoreFile]});
        await waitFor(`document.getElementById('totalText').textContent.startsWith('${selectedDone} / 43')`);
        assert.equal(await evaluate("document.getElementById('progressScope').value"),'chi');
        await evaluate("document.getElementById('progressScope').value='all';document.getElementById('progressScope').dispatchEvent(new Event('change'))");
        await waitFor(`document.getElementById('totalText').textContent.startsWith('${updated} / 67')`);
        assert.ok(dialogs>before,'Restore requires the existing confirmation');
        assert.equal(await evaluate("document.querySelectorAll('.geolonia-svg-map .prefecture').length"),47);
        assert.equal(await evaluate("document.querySelectorAll('#prefgrid .pref').length"),12);
        assert.ok(await evaluate("document.querySelectorAll('#cards .card').length>0"));
        results.push({width,count,pct,...layout,updated,backup:true,restore:true});
      }
    }
    fs.writeFileSync('scratch/progress-summary-qa/results.json',JSON.stringify(results,null,2));
    ws.close();
  }finally{await browser.close();server.closeAllConnections();server.close();}
});
