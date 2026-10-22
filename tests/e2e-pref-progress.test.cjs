const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('E2E: native prefecture progress disclosure and hidden record updates', async (t) => {
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
  const { ws, send, evaluate } = browser;
  try {

    await send('Page.enable');

    for (let attempt = 0; attempt < 50; attempt++) {
      if (await evaluate(`!!document.querySelector('.geolonia-svg-map .prefecture')`)) break;
      await new Promise(r => setTimeout(r, 100));
    }

    async function waitFor(expr){for(let i=0;i<100;i++){if(await evaluate(expr))return;await new Promise(r=>setTimeout(r,100));}assert.fail('Timed out: '+expr);}
    fs.mkdirSync('scratch/pref-progress-qa',{recursive:true});
    const results=[];
    for(const width of [1280,390,320]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<400});
      await send('Emulation.setTouchEmulationEnabled',{enabled:width<400});
      await evaluate("localStorage.clear();location.reload()");
      await waitFor("document.readyState==='complete' && !!document.querySelector('#prefgrid .pref')");
      assert.equal(await evaluate("document.getElementById('prefProgress').open"),false);
      assert.equal(await evaluate("document.getElementById('prefProgressMeta').textContent"),'13都道府県・67施設の訪問進捗');
      assert.equal(await evaluate("document.querySelectorAll('#prefgrid .pref').length"),13);
      // Native details may retain the hidden children's layout boxes; only summary is painted.
      assert.ok(await evaluate("document.getElementById('prefProgress').getBoundingClientRect().height<=document.querySelector('#prefProgress summary').getBoundingClientRect().height+3"));
      const storageBefore=await evaluate('JSON.stringify(localStorage)');
      async function activate(selector){
        await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);
        await new Promise(r=>setTimeout(r,150));
        const point=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.left+24,y:r.top+r.height/2}})()`);
        if(width<400){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
        else{await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});}
        await new Promise(r=>setTimeout(r,150));
      }
      await activate('#prefProgress summary');
      assert.equal(await evaluate("document.getElementById('prefProgress').open"),true);
      assert.ok(await evaluate("document.getElementById('prefgrid').getBoundingClientRect().height>0"));
      await activate('#prefProgress summary');
      assert.equal(await evaluate("document.getElementById('prefProgress').open"),false);
      assert.equal(await evaluate('JSON.stringify(localStorage)'),storageBefore,'Disclosure stores no preference');
      // Records update while cards are hidden; opening reveals current values.
      await evaluate("document.querySelector('[data-detail=\"onsen-002\"]').click();document.getElementById('detailStamp').click();document.getElementById('modalClose').click()");
      assert.equal(await evaluate("document.getElementById('prefProgress').open"),false);
      assert.ok(await evaluate("document.querySelector('.pref[data-pref=\"青森県\"] .fraction').textContent.includes('1 / 4')"));
      await activate('#prefProgress summary');
      await evaluate("document.querySelector('[data-detail=\"onsen-003\"]').click();document.getElementById('detailStamp').click();document.getElementById('modalClose').click()");
      assert.equal(await evaluate("document.getElementById('prefProgress').open"),true);
      assert.ok(await evaluate("document.querySelector('.pref[data-pref=\"青森県\"] .fraction').textContent.includes('2 / 4')"));
      assert.equal(await evaluate("document.querySelector('.pref[data-pref=\"青森県\"] .mini i').style.width"),'50%');
      assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true);
      const shot=await send('Page.captureScreenshot',{format:'png'});
      fs.writeFileSync(`scratch/pref-progress-qa/open-${width}.png`,Buffer.from(shot.data,'base64'));
      await activate('.pref[data-pref="青森県"]');
      await waitFor("!!document.querySelector('#mapCanvas .onsen-map-marker')");
      assert.equal(await evaluate("document.getElementById('prefSelect').value"),'青森県');
      assert.equal(await evaluate("!document.getElementById('prefectureMap').hidden"),true);
      await evaluate("document.getElementById('mapReset').click()");
      assert.equal(await evaluate("!document.getElementById('japanMap').hidden"),true);
      await send('Page.reload');
      await waitFor("document.readyState==='complete' && !!document.querySelector('#prefgrid .pref')");
      assert.equal(await evaluate("document.getElementById('prefProgress').open"),false);
      assert.ok(await evaluate("document.querySelector('.pref[data-pref=\"青森県\"] .fraction').textContent.includes('2 / 4')"));
      await evaluate("document.querySelector('#prefProgress summary').focus()");
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
      await send('Input.dispatchKeyEvent',{type:'char',key:'Enter',code:'Enter',text:'\r',windowsVirtualKeyCode:13});
      await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
      assert.equal(await evaluate("document.getElementById('prefProgress').open"),true);
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
      await send('Input.dispatchKeyEvent',{type:'char',key:' ',code:'Space',text:' ',windowsVirtualKeyCode:32});
      await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
      assert.equal(await evaluate("document.getElementById('prefProgress').open"),false);
      await evaluate("document.querySelector('#prefProgress summary').scrollIntoView({block:'center'})");
      const closedShot=await send('Page.captureScreenshot',{format:'png'});
      fs.writeFileSync(`scratch/pref-progress-qa/closed-${width}.png`,Buffer.from(closedShot.data,'base64'));
      results.push({width,cards:13,closedByDefault:true,toggle:true,updatesHiddenAndOpen:true,reloadClosed:true,keyboard:true,mapNavigation:true});
    }
    fs.writeFileSync('scratch/pref-progress-qa/results.json',JSON.stringify(results,null,2));
    ws.close();
  }finally{await browser.close();server.closeAllConnections();server.close();}
});
