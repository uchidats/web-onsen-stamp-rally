const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('Map help opens, closes and preserves legends and prefecture navigation at three widths', async t => {
  const browser = await require('./helpers/browser.cjs').startBrowser(
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    pathToFileURL(path.resolve('index.html')).href
  );
  t.after(() => browser.close());
  const { send, evaluate } = browser;
  await send('Page.enable');
  await send('Network.enable');
  // This UI test needs local SVG/Leaflet only, never remote tiles or Firebase.
  await send('Network.setBlockedURLs', { urls: ['https://*', 'http://*'] });
  await evaluate('document.fonts.ready');
  const stored = await evaluate('JSON.stringify(localStorage)');
  const waitFor = async expression => {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.fail('Timed out: ' + expression);
  };
  const click = async (selector, mobile) => {
    const point = await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
    if (mobile) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    }
  };
  for (const width of [1280, 390, 320]) {
    const mobile = width < 400;
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile });
    await send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
    assert.equal(await evaluate('document.getElementById("japanMapHelpDialog").open'), false);
    assert.equal(await evaluate('document.getElementById("japanMapDetailBar").hidden'), true);
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".japan-map-legend .legend-item")].map(e=>e.textContent)'), ['100%', '50〜99%', '1〜49%', '0%', '登録施設なし', '訪問済み', '未訪問']);
    assert.equal(await evaluate('document.querySelectorAll(".japan-map-marker").length'), 67);
    await click('#japanMapHelp', mobile);
    assert.equal(await evaluate('document.getElementById("japanMapHelpDialog").open'), true);
    const fits = await evaluate(`(() => {
      const selectors=['#japanMapHelpDialog','.japan-map-legend','#japanMapHelp','.japan-map-legend .legend-item'];
      return document.documentElement.scrollWidth<=innerWidth && selectors.every(s=>[...document.querySelectorAll(s)].every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}));
    })()`);
    assert.equal(fits, true, 'panel and legends fit at ' + width);
    fs.writeFileSync(path.join(browser.profile, `map-help-${width}-open.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    await click('#japanMapHelpClose', mobile);
    assert.equal(await evaluate('document.getElementById("japanMapHelpDialog").open'), false);
    assert.equal(await evaluate('document.activeElement.id'), 'japanMapHelp');
    await click('#japanMapHelp', mobile);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await waitFor('!document.getElementById("japanMapHelpDialog").open');
    fs.writeFileSync(path.join(browser.profile, `map-help-${width}-closed.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    // Exercise the existing prefecture handler; no gesture or remote tile E2E.
    await evaluate('document.querySelector(\'.prefecture[data-pref="青森県"]\').dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}))');
    await waitFor('!document.getElementById("prefectureMap").hidden && document.querySelectorAll("#mapCanvas .onsen-map-marker").length===4');
    assert.equal(await evaluate('document.getElementById("prefSelect").value'), '青森県');
    assert.equal(await evaluate('document.getElementById("japanMap").hidden'), true);
    assert.equal(await evaluate('document.getElementById("mapHeading").textContent'), '青森県の温泉マップ');
    assert.equal(await evaluate('[...document.querySelectorAll("#cards .card")].length'), 4);
    await evaluate('document.getElementById("resetPref").click()');
    assert.equal(await evaluate('document.getElementById("japanMap").hidden'), false);
    assert.equal(await evaluate('JSON.stringify(localStorage)'), stored);
    console.log(JSON.stringify({ width, fits, legends: 7, prefectureNavigation: true, screenshots: browser.profile }));
  }
});
