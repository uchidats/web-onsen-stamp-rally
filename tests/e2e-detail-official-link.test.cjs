const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('E2E: facility name in the detail view links to the official site (card and map entry, new tab, no side effects)', async (t) => {
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
    const delay = ms => new Promise(r => setTimeout(r, ms));
    await send('Page.enable');
    await waitFor("document.querySelectorAll('#cards .card').length>0 && document.querySelectorAll('.japan-map-marker').length===67");
    await evaluate('localStorage.clear()');
    await evaluate("while(!document.getElementById('showMore').classList.contains('hide'))document.getElementById('showMore').click()");

    const open = {
      card: id => evaluate(`document.querySelector('[data-detail="${id}"]').click()`),
      // 地図のマーカー(キーボード/スクリーンリーダー操作と同じ経路)から詳細を開く
      map: id => evaluate(`document.querySelector('.japan-map-marker[data-onsen-id="${id}"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))`)
    };
    const modalOpen = () => evaluate("document.getElementById('modalBg').style.display==='flex'");
    const close = async () => { await evaluate("document.getElementById('modalClose').click()"); await delay(50); };
    const info = () => evaluate(`(()=>{const f=document.querySelector('#modalSubtitle .facility-name'),a=f.closest('a'),m=document.querySelector('.modal').getBoundingClientRect(),r=f.getBoundingClientRect(),ar=a&&a.getBoundingClientRect();
      return JSON.stringify({text:f.textContent,isLink:!!a,href:a&&a.getAttribute('href'),target:a&&a.target,rel:a&&a.rel,label:a&&a.getAttribute('aria-label'),icon:!!(a&&a.querySelector('.external-link-icon')),underline:a&&getComputedStyle(a).textDecorationLine,
        tapH:ar&&Math.round(ar.height),inside:r.right<=m.right&&r.left>=m.left,overflow:document.documentElement.scrollWidth>innerWidth,links:document.querySelectorAll('#modalSubtitle a').length,bg:document.getElementById('modalBg').style.display})})()`).then(JSON.parse);

    const data = JSON.parse(await evaluate('JSON.stringify(ONSEN_DATA.map(x=>({id:x.id,facility:x.facility,officialUrl:x.officialUrl,lat:x.latitude,lng:x.longitude})))'));
    const withUrl = data.filter(x => x.officialUrl), without = data.filter(x => !x.officialUrl);
    assert.deepEqual(without.map(x => x.id), ['onsen-005', 'onsen-022', 'onsen-025']);
    assert.equal(withUrl.length, 64);

    for (const width of [1280, 390]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 400 });
      for (const via of ['card', 'map']) {
        // 公式サイト登録あり: 全64施設で、施設名がそのURLへのリンク(新しいタブ・noopener)
        for (const x of withUrl) {
          await open[via](x.id);
          assert.equal(await modalOpen(), true, `${via}:${x.id} opens`);
          const i = await info();
          assert.equal(i.text, x.facility, `${via}:${x.id} text unchanged`);
          assert.equal(i.isLink, true, `${via}:${x.id}`);
          assert.equal(i.href, x.officialUrl, `${via}:${x.id} href`);
          assert.equal(i.target, '_blank');
          assert.match(i.rel, /noopener/);
          assert.match(i.label, /公式サイト（新しいタブで開く）/);
          assert.equal(i.icon, true);
          assert.equal(i.underline, 'underline');
          assert.ok(i.tapH >= 28, `${via}:${x.id} tap height ${i.tapH}`);
          assert.ok(i.inside && !i.overflow, `${via}:${x.id}@${width} fits`);
          assert.equal(i.links, 2);
          await close();
        }
        // 未登録(3施設)はリンクにせず従来どおり表示のみ
        for (const x of without) {
          await open[via](x.id);
          const i = await info();
          assert.equal(i.text, x.facility);
          assert.equal(i.isLink, false, `${via}:${x.id} stays plain text`);
          assert.equal(i.links, 1);
          assert.equal(i.icon, false);
          await close();
        }
      }
    }

    // リンクのクリックで詳細は閉じず、アプリ側が既定動作を取り消さない(遷移だけテスト内で止める)
    await open.card('onsen-001');
    await evaluate("window.__dp=[];window.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('#modalSubtitle a')){window.__dp.push(e.defaultPrevented);e.preventDefault()}},false)");
    await evaluate("document.querySelector('#modalSubtitle a').click()");
    assert.deepEqual(JSON.parse(await evaluate('JSON.stringify(window.__dp)')), [false]);
    assert.equal(await modalOpen(), true, 'detail stays open after tapping the link');
    await close();
    // 地図から開いた場合も同じ
    await open.map('onsen-001');
    await evaluate("document.querySelector('#modalSubtitle a').click()");
    assert.equal(await modalOpen(), true);
    assert.deepEqual(JSON.parse(await evaluate('JSON.stringify(window.__dp)')), [false, false]);
    await close();

    // データ・保存形式は変えない(座標・公式URLは読み取るだけ)
    assert.equal(await evaluate('JSON.stringify(localStorage)'), '{}');
    assert.equal(await evaluate('ONSEN_DATA.length'), 67);
    ws.close();
  } finally { await browser.close(); server.closeAllConnections(); server.close(); }
});
