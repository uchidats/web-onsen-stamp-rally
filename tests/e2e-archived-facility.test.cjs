const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const ID = 'onsen-029';
test('Temporarily hidden facility: master and fixed ID kept, excluded from list/map/search/progress/stay search, visit and note preserved', async t => {
  const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  if (!fs.existsSync(edge)) { t.skip('Edge not installed'); return; }
  // マスターと固定IDは残る(単体)
  const ctx = {}; require('node:vm').runInNewContext(fs.readFileSync('data.js', 'utf8'), Object.assign(ctx, { window: ctx }));
  assert.equal(ctx.ONSEN_DATA.length, 67);
  assert.ok(ctx.ONSEN_DATA.some(x => x.id === ID && x.facility === '湯守の宿三之亟'));
  assert.deepEqual(Object.keys(ctx.ONSEN_ARCHIVED), [ID]);
  assert.ok(!/閉館|廃業|営業終了|休業/.test(JSON.stringify(ctx.ONSEN_ARCHIVED)), 'no closure claim');
  const browser = await require('./helpers/browser.cjs').startBrowser(edge, pathToFileURL(path.resolve('index.html')).href);
  t.after(() => browser.close());
  const { send, evaluate } = browser, delay = ms => new Promise(r => setTimeout(r, ms));
  await send('Page.enable'); await send('Network.enable'); await send('Network.setBlockedURLs', { urls: ['https://*'] });
  const ready = async () => { for (let i = 0; i < 100; i++) { if (await evaluate("!!window.OnsenHost && document.querySelectorAll('.japan-map-marker').length>0")) return; await delay(100); } assert.fail('not ready'); };
  await ready();
  // 既存の訪問履歴とメモ(非公開施設分)を作り、再読み込み後も残ることを確認する
  await evaluate(`(()=>{const h=OnsenHost;let s=h.store.replace(h.store.empty(),h.getState(),true);s=h.store.addVisit(s,'${ID}','2025-05-05','stay');s=h.store.setNotes(s,'${ID}','非公開前のメモ');h.setState(s)})()`);
  const before = await evaluate("localStorage.getItem(Object.keys(localStorage).find(k=>/records|v3/.test(k)))");
  await send('Page.reload'); await ready();
  for (const width of [1280, 390]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 400 });
    await evaluate("while(!document.getElementById('showMore').classList.contains('hide'))document.getElementById('showMore').click()");
    const r = await evaluate(`JSON.stringify({data:ONSEN_DATA.length,master:ONSEN_MASTER.length,inMaster:ONSEN_MASTER.some(x=>x.id==='${ID}'),inData:ONSEN_DATA.some(x=>x.id==='${ID}'),card:!!document.querySelector('[data-facility-id="${ID}"]'),text:document.getElementById('cards').textContent.includes('三之亟'),
      markers:document.querySelectorAll('.japan-map-marker').length,markerId:!!document.querySelector('.japan-map-marker[data-onsen-id="${ID}"]'),total:document.getElementById('totalText').textContent,count:document.getElementById('resultCount').textContent,bed:!!document.querySelector('[data-stay="${ID}"]'),verified:OnsenStaySearch.googleVerified('${ID}')})`).then(JSON.parse);
    assert.deepEqual(r, { data: 66, master: 67, inMaster: true, inData: false, card: false, text: false, markers: 66, markerId: false, total: '0 / 66 施設', count: '66 施設 · 61 温泉地', bed: false, verified: false }, width + 'px');
    // 検索でも出ない
    await evaluate("search.value='三之亟';search.dispatchEvent(new Event('input'))");
    assert.equal(await evaluate("document.querySelectorAll('#cards .facility-entry').length"), 0);
    await evaluate("search.value='赤倉温泉';search.dispatchEvent(new Event('input'))");
    assert.equal(await evaluate("document.querySelectorAll('#cards .facility-entry').length"), 0);
    await evaluate("clearFilter.click()");
  }
  // 訪問履歴・メモは保存形式ごと残り、バックアップにも含まれる(復元可能)
  assert.equal(await evaluate("localStorage.getItem(Object.keys(localStorage).find(k=>/records|v3/.test(k)))"), before, 'stored records are untouched by hiding');
  const backup = await evaluate('OnsenHost.backup()');
  assert.equal(backup.userData.visits[ID].notes, '非公開前のメモ');
  assert.equal(backup.userData.visits[ID].records.length, 1);
  assert.equal(backup.userData.visits[ID].records[0].date, '2025-05-05');
  assert.equal(backup.userData.visits[ID].records[0].visitType, 'stay');
});
