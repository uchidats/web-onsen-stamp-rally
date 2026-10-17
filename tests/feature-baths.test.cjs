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
const feature = load('feature-baths.js').ONSEN_FEATURE_BATHS;
const KINDS = ['内湯', '露天', '半露天', '蒸し風呂', '岩盤浴'];
const FORMS = ['男女別', '混浴', '貸切', '女性専用'];
const KNOWN_KEYS = ['name', 'kind', 'form', 'color', 'tags', 'note'];

const AKITA = {
  'onsen-013': '新玉川温泉', 'onsen-014': '玉川温泉', 'onsen-015': '鶴の湯温泉', 'onsen-016': '妙乃湯', 'onsen-017': '元湯雄山閣', 'onsen-018': '後生掛温泉旅館',
  'onsen-019': '鷹の湯温泉', 'onsen-020': '蒸ノ湯温泉', 'onsen-021': '奥山旅館', 'onsen-022': '川原毛大湯滝', 'onsen-023': '湯瀬ホテル'
};

test('feature baths: data is keyed by existing facility IDs and covers exactly the 11 Akita facilities', () => {
  assert.equal(data.length, 67);
  assert.deepEqual(Object.keys(feature).sort(), Object.keys(AKITA));
  for (const [id, name] of Object.entries(AKITA)) {
    const x = data.find(v => v.id === id);
    assert.ok(x, id);
    assert.equal(x.facility, name);
    assert.equal(x.prefecture, '秋田県');
  }
  assert.deepEqual(data.filter(x => x.prefecture === '秋田県').map(x => x.id).sort(), Object.keys(AKITA));
});

test('feature baths: at most 3 baths and 3 tags, vocabulary respected, source recorded', () => {
  for (const [id, entry] of Object.entries(feature)) {
    assert.ok(entry.baths.length >= 1 && entry.baths.length <= 3, id);
    assert.match(entry.source.url, /^https?:\/\//);
    assert.match(entry.source.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
    for (const b of entry.baths) {
      assert.ok(b.name, id);
      assert.deepEqual(Object.keys(b).filter(k => !KNOWN_KEYS.includes(k)), [], b.name);
      if (b.kind) assert.ok(KINDS.includes(b.kind), b.name);
      if (b.form) assert.ok(FORMS.includes(b.form), b.name);
      if (b.tags) assert.ok(b.tags.length <= 3, b.name);
    }
  }
});

test('feature baths: only officially confirmed content is published (no unconfirmed bath, no facility-wide color applied to a bath)', () => {
  assert.deepEqual(feature['onsen-015'].baths.map(b => b.name), ['混浴露天風呂', '白湯', '黒湯']);
  assert.ok(feature['onsen-015'].baths.every(b => !b.color), 'Tsuru-no-yu: no bath color is stated officially');
  assert.deepEqual(feature['onsen-016'].baths.map(b => b.name), ['やわらぎの湯－銀の湯']);
  assert.ok(!JSON.stringify(feature['onsen-016']).includes('金の湯'), 'Kin-no-yu has no confirmed bath');
  assert.ok(!feature['onsen-016'].baths[0].color, 'Source description is not applied to the private bath');
  assert.deepEqual(feature['onsen-018'].baths.map(b => b.name), ['神経痛の湯', '箱蒸し風呂', '火山風呂']);
  assert.deepEqual(feature['onsen-016'].baths.length, 1);
  assert.equal(feature['onsen-018'].baths.filter(b => b.color).length, 1);
  assert.equal(feature['onsen-018'].baths[0].color, '灰白色のにごり湯');
  // 玉川・新玉川: 源泉(大噴)の「無色透明」を浴槽や施設へ転用しない
  for (const id of ['onsen-013', 'onsen-014']) assert.ok(!/無色|透明/.test(JSON.stringify(feature[id])), id);
  // 湯の色は後生掛の神経痛の湯だけ(ほかは施設全体の補足文であり、個別の湯の色ではない)
  for (const [id, e] of Object.entries(feature)) if (id !== 'onsen-018') assert.ok(e.baths.every(b => !b.color), id);
  // 岩盤浴は色・泉質の検索対象にしない(色なし)、料金・営業時間は載せない
  assert.equal(feature['onsen-014'].baths.find(b => b.kind === '岩盤浴').color, undefined);
  assert.ok(!/円|\d{1,2}:\d{2}|営業時間/.test(JSON.stringify(Object.values(feature).map(e => [e.note, e.baths]))), 'no prices or hours');
  const text = JSON.stringify(feature);
  for (const banned of ['candidate', 'unconfirmed', '未確認', '候補']) assert.ok(!text.includes(banned), banned);
});
