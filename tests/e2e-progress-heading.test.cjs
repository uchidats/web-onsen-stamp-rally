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
  for (const width of [1280, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 400 });
    const layout = await evaluate(`(() => {
      const rect = s => document.querySelector(s).getBoundingClientRect();
      const label = rect('.progress-head .stathead'), select = rect('#progressScope');
      const badge = rect('.beta-badge-header'), account = rect('.account-tools');
      const panel = rect('.progress-summary'), hero = rect('.hero');
      return {
        badge: document.querySelector('.beta-badge-header').textContent,
        heading: document.querySelector('.progress-head .stathead').textContent,
        notices: document.querySelectorAll('.beta-notice').length,
        overflow: document.documentElement.scrollWidth > innerWidth,
        selectRight: select.left >= label.right && Math.abs(select.top + select.height / 2 - label.top - label.height / 2) < 1,
        badgeFits: badge.left >= 0 && badge.right <= innerWidth && (badge.right <= account.left || badge.top >= account.bottom),
        panelFits: panel.left >= 0 && panel.right <= innerWidth,
        overlap: hero.bottom - panel.top,
        percent: document.getElementById('totalPercent').textContent,
        options: [...document.getElementById('progressScope').options].map(o => o.value)
      };
    })()`);
    assert.equal(layout.badge, 'β版 公開中');
    assert.equal(layout.heading, '♨ 達成率');
    assert.equal(layout.notices, 0);
    assert.equal(layout.overflow, false, JSON.stringify({ width, layout }));
    assert.equal(layout.selectRight, true);
    assert.equal(layout.badgeFits, true);
    assert.equal(layout.panelFits, true);
    assert.equal(layout.overlap, width < 400 ? 24 : 30);
    assert.equal(layout.percent, '0%');
    assert.deepEqual(layout.options, ['all', 'chi', 'kake', 'gensei']);
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(browser.profile, `heading-${width}.png`), Buffer.from(screenshot.data, 'base64'));
    console.log(JSON.stringify({ width, ...layout, screenshot: path.join(browser.profile, `heading-${width}.png`) }));
  }
});
