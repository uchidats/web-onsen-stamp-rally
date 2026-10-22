const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function load(file) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  return JSON.parse(JSON.stringify(sandbox.window));
}
const data = load('data.js').ONSEN_DATA;
const hitou = load('hitou-membership.js').ONSEN_HITOU_MEMBERSHIP;

// 日本秘湯を守る会の現行加盟を確認できた26施設(両現行公式一覧への掲載・所在地/電話の照合済み)
const MEMBERS = [
  'onsen-001', 'onsen-006', 'onsen-009', 'onsen-010', 'onsen-012', 'onsen-015', 'onsen-017', 'onsen-019', 'onsen-020', 'onsen-021',
  'onsen-024', 'onsen-027', 'onsen-030', 'onsen-031', 'onsen-032', 'onsen-033', 'onsen-038', 'onsen-039', 'onsen-042', 'onsen-047',
  'onsen-054', 'onsen-059', 'onsen-061', 'onsen-062', 'onsen-064', 'onsen-066'
];

test('hitou membership: exactly the 26 confirmed member facilities, keyed by existing fixed IDs', () => {
  assert.equal(data.length, 68);
  assert.deepEqual(Object.keys(hitou).sort(), MEMBERS);
  const ids = new Set(data.map(x => x.id));
  for (const id of Object.keys(hitou)) assert.ok(ids.has(id), id);
});

test('hitou membership: every entry has the official name, an official detail URL on nihon-hitou.org and a check date', () => {
  for (const [id, e] of Object.entries(hitou)) {
    assert.ok(e.officialName, id);
    assert.match(e.url, /^https:\/\/nihon-hitou\.org\/member\/\d+$/, id);
    assert.match(e.checkedAt, /^\d{4}-\d{2}-\d{2}$/, id);
    if (e.reservationUrl) assert.match(e.reservationUrl, /^https:\/\/www\.hitou\.or\.jp\/provider\/\d+$/, id);
    const u = new URL(e.url);
    assert.equal(u.username + u.password, '', id);
  }
  // 詳細ページは施設ごとに別(同名・近隣施設へURLを流用しない)
  assert.equal(new Set(Object.values(hitou).map(e => e.url)).size, 26);
});

test('hitou membership: look-alike facilities are not mixed up (Azumaya, Higashiya, Ishizuka, Kashiwaya, Sannoujo, Kanikyu)', () => {
  const fac = id => data.find(x => x.id === id);
  // 白布温泉の東屋は2025年3月12日付で退会。新高湯の吾妻屋は別施設で加盟
  assert.equal(fac('onsen-028').facility, '東屋');
  assert.equal(hitou['onsen-028'], undefined);
  assert.equal(fac('onsen-033').facility, '吾妻屋');
  assert.equal(fac('onsen-033').onsen, '新高湯温泉');
  assert.equal(hitou['onsen-033'].officialName, '奥白布 吾妻屋旅館');
  // 石塚旅館の宿泊営業休止は加盟休会ではない(加盟のまま)
  assert.ok(hitou['onsen-010']);
  assert.match(hitou['onsen-010'].note, /休会・加盟停止ではない/);
  // 別団体(日本源泉湯宿を守る会)への入会、公式非掲載、同温泉地の別宿からは広げない
  for (const id of ['onsen-037', 'onsen-029', 'onsen-008', 'onsen-045', 'onsen-056', 'onsen-025']) assert.equal(hitou[id], undefined, id);
});

test('hitou membership: the display lives in its own file; data.js, personal records and saved data are not touched', () => {
  const dataSrc = fs.readFileSync('data.js', 'utf8');
  assert.ok(!/HITOU|秘♨|nihon-hitou/i.test(dataSrc));
  const src = fs.readFileSync('hitou-membership.js', 'utf8');
  assert.ok(!/localStorage|sessionStorage|indexedDB/.test(src));
  const app = fs.readFileSync('app.js', 'utf8');
  // ラベル表示は閲覧データだけを読む(訪問記録・メモ・localStorageへ書き込まない)
  const fn = app.slice(app.indexOf('function hitouBadge'), app.indexOf('function filtered'));
  assert.ok(fn.includes('ONSEN_HITOU_MEMBERSHIP'));
  assert.ok(!/localStorage|setItem|state\./.test(fn));
  assert.ok(fs.readFileSync('index.html', 'utf8').includes('hitou-membership.js'));
});
