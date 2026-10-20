const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('Minimal beta badge and progress heading fit desktop and narrow phones', async t => {
  const browser = await require('./helpers/browser.cjs').startBrowser(
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    pathToFileURL(path.resolve('index.html')).href
  );
  t.after(() => browser.close());
  const { send, evaluate } = browser;
  await send('Page.enable');
  await evaluate('document.fonts.ready');
  await evaluate("(()=>{const h=OnsenHost;let state=h.getState();for(const x of ONSEN_DATA.slice(0,17))state=h.store.setVisited(state,x.id,true);h.setState(state)})()");
  for (const width of [1280, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 400 });
    const layout = await evaluate(`(() => {
      const rect = s => document.querySelector(s).getBoundingClientRect();
      const badge = rect('.beta-badge-header'), account = rect('.account-tools');
      const panel = rect('.progress-summary'), hero = rect('.hero');
      return {
        badge: document.querySelector('.beta-badge-header').textContent,
        headings: document.querySelectorAll('.progress-summary h2').length,
        notices: document.querySelectorAll('.beta-notice').length,
        overflow: document.documentElement.scrollWidth > innerWidth,
        cardCount: document.querySelectorAll('.progress-card').length,
        badgeFits: badge.left >= 0 && badge.right <= innerWidth && (badge.right <= account.left || badge.top >= account.bottom),
        panelFits: panel.left >= 0 && panel.right <= innerWidth,
        overlap: hero.bottom - panel.top,
        percent: document.getElementById('totalPercent').textContent,
        labels: [...document.querySelectorAll('.progress-card h3')].map(e => {const label=e.cloneNode(true);label.querySelectorAll('button,.progress-help-tip').forEach(x=>x.remove());return label.textContent}),
        cardsPlain: [...document.querySelectorAll('.progress-card')].every(e=>{const s=getComputedStyle(e);return s.backgroundColor==='rgba(0, 0, 0, 0)'&&['Top','Right','Bottom','Left'].every(side=>s['border'+side+'Width']==='0px')}),
        rings: [...document.querySelectorAll('.progress-ring')].map(e=>{const r=e.getBoundingClientRect(),label=e.previousElementSibling.getBoundingClientRect();return {width:r.width,height:r.height,gap:r.top-label.bottom,stroke:getComputedStyle(e.querySelector('svg')).strokeWidth}}),
        columns: new Set([...document.querySelectorAll('.progress-card')].map(e=>Math.round(e.getBoundingClientRect().left))).size
      };
    })()`);
    assert.equal(layout.badge, 'β版 公開中');
    assert.equal(layout.headings, 0);
    assert.equal(await evaluate("document.getElementById('regionalHeading').textContent"), '都道府県別の♨達成度');
    assert.equal(await evaluate("document.querySelector('#regional-progress .section-kicker').textContent"), 'REGIONAL PROGRESS');
    assert.equal(await evaluate("document.querySelector('.pref-progress-toggle strong').textContent"), '都道府県別の♨達成度');
    assert.equal(await evaluate("document.getElementById('prefProgressMeta').textContent"), '12都道府県・67施設の訪問進捗');
    assert.equal(await evaluate("document.getElementById('prefProgressMeta').getClientRects().length"), 0);
    await evaluate("document.getElementById('prefProgress').open=true");
    assert.equal(await evaluate("document.querySelectorAll('#prefgrid .pref').length"), 12);
    assert.equal(await evaluate("document.getElementById('prefProgressMeta').getClientRects().length"), 0);
    assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"), true);
    await evaluate("document.getElementById('prefProgress').open=false");
    assert.equal(layout.notices, 0);
    assert.equal(layout.overflow, false, JSON.stringify({ width, layout }));
    assert.equal(layout.cardCount, 4);
    assert.equal(layout.badgeFits, true);
    assert.equal(layout.panelFits, true);
    assert.equal(layout.overlap, width < 400 ? 24 : 30);
    assert.equal(layout.percent, '25.4%');
    assert.deepEqual(layout.labels, ['全施設', '♨地・温泉', '源泉かけ流し', '源生の湯']);
    assert.equal(layout.cardsPlain, true);
    assert.equal(layout.columns, width === 1280 ? 4 : 2);
    assert.deepEqual(layout.rings, Array(4).fill({width:width===1280?104:88,height:width===1280?104:88,gap:10,stroke:'6px'}));
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(browser.profile, `heading-${width}.png`), Buffer.from(screenshot.data, 'base64'));
    console.log(JSON.stringify({ width, ...layout, screenshot: path.join(browser.profile, `heading-${width}.png`) }));
  }
});
