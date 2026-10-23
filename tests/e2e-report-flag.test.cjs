const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('E2E: 施設カードの旗アイコン(掲載情報の訂正・情報提供)', async (t) => {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (!fs.existsSync(edgePath)) { t.skip('Edge not installed at standard path'); return; }
  const server = require('node:http').createServer((req, res) => {
    const file = path.resolve('.' + new URL(req.url, 'http://localhost').pathname.replace(/^\/web-onsen-stamp-rally\//, '/'));
    if (!file.startsWith(process.cwd() + path.sep)) { res.writeHead(403).end(); return; }
    const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }[path.extname(file)];
    if (type) res.setHeader('Content-Type', type);
    fs.createReadStream(file).on('error', () => res.writeHead(404).end()).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const htmlUrl = `http://127.0.0.1:${server.address().port}/web-onsen-stamp-rally/index.html`;
  let browser;
  t.after(async () => { await browser?.close(); server.closeAllConnections(); server.close(); });
  browser = await require('./helpers/browser.cjs').startBrowser(edgePath, htmlUrl);
  const { ws, send, evaluate } = browser;
  try {
    const waitFor = async expr => { for (let i = 0; i < 100; i++) { if (await evaluate(expr)) return; await new Promise(r => setTimeout(r, 100)); } assert.fail('Timed out: ' + expr); };
    await send('Page.enable');
    await waitFor("document.querySelectorAll('#cards .card').length>0");
    await evaluate('localStorage.clear()');
    await evaluate("while(!document.getElementById('showMore').classList.contains('hide'))document.getElementById('showMore').click()");
    const entry = id => `document.querySelector('[data-facility-id="${id}"]')`;
    const total = await evaluate("document.querySelectorAll('#cards .facility-entry').length");

    for (const width of [1280, 390, 320]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 400 });
      assert.equal(await evaluate("document.querySelectorAll('#cards .report-link').length"), total, '1 flag per card entry');
      // 詳細のすぐ右・地図アイコンと同じ色とサイズ
      const r = JSON.parse(await evaluate(`(()=>{const e=${entry('onsen-001')},d=e.querySelector('.facility-detail'),f=e.querySelector('.report-link'),m=e.querySelector('.map-link:not(.report-link)'),a=d.getBoundingClientRect(),b=f.getBoundingClientRect(),c=m.getBoundingClientRect();
        return JSON.stringify({next:d.nextElementSibling===f,sameRow:Math.abs((a.top+a.height/2)-(b.top+b.height/2))<=2,gap:b.left-a.right,color:getComputedStyle(f).color===getComputedStyle(m).color,w:[b.width,c.width],svg:[f.querySelector('svg').getBoundingClientRect().width,m.querySelector('svg').getBoundingClientRect().width],inside:b.right<=e.closest('.card').getBoundingClientRect().right,scroll:document.documentElement.scrollWidth>innerWidth})})()`));
      assert.ok(r.next && r.sameRow, `flag right of 詳細 @${width}`);
      assert.ok(r.gap >= -8 && r.gap <= 12, `gap ${r.gap} @${width}`);
      assert.ok(r.color && r.w[0] === r.w[1] && r.svg[0] === r.svg[1], `same look as map icon @${width}`);
      assert.ok(r.inside && !r.scroll, `no overflow @${width}`);
    }
    // リンク
    const a = JSON.parse(await evaluate(`(()=>{const n=${entry('onsen-001')}.querySelector('.report-link');return JSON.stringify({href:n.href,target:n.target,rel:n.rel,label:n.getAttribute('aria-label'),tip:n.querySelector('.map-tooltip').textContent,desc:n.getAttribute('aria-describedby')})})()`));
    const u = new URL(a.href);
    assert.equal(u.origin + u.pathname, 'https://docs.google.com/forms/d/e/1FAIpQLSc7vTNi32N9Ew_lEdmMQ0tJUA-usQuSWa57VY8VZ-1uv79rgQ/viewform');
    assert.equal(u.searchParams.get('usp'), 'pp_url');
    assert.equal(u.searchParams.get('entry.1682536074'), '知内温泉旅館');
    assert.equal(u.searchParams.get('entry.1645956111'), 'onsen-001');
    assert.equal(a.target, '_blank');
    assert.match(a.rel, /noopener/); assert.match(a.rel, /noreferrer/);
    assert.equal(a.tip, '掲載情報の訂正・情報提供');
    // クリックは詳細を開かず、既存の地図・宿泊・詳細リンクに影響しない
    await evaluate("window.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('.report-link'))e.preventDefault()},false)");
    await evaluate(`${entry('onsen-001')}.querySelector('.report-link').click()`);
    assert.equal(await evaluate("document.getElementById('modalBg').style.display==='flex'"), false);
    await evaluate(`${entry('onsen-001')}.querySelector('[data-detail]').click()`);
    assert.equal(await evaluate("document.getElementById('modalBg').style.display==='flex'"), true);
    await evaluate("document.getElementById('modalClose').click()");
    assert.equal(await evaluate('JSON.stringify(localStorage)'), '{}');
    ws.close();
  } finally { await browser.close(); server.closeAllConnections(); server.close(); }
});
