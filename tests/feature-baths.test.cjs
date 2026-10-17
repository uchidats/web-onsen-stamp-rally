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

const IWATE = {
  'onsen-006': '峡雲荘', 'onsen-007': '藤三旅館', 'onsen-008': '山水閣', 'onsen-009': '元湯夏油', 'onsen-010': '石塚旅館', 'onsen-011': 'ほっとゆだ', 'onsen-012': '彩雲荘'
};

test('feature baths: data is keyed by existing facility IDs and covers exactly the 11 Akita and 7 Iwate facilities', () => {
  assert.equal(data.length, 67);
  assert.deepEqual(Object.keys(feature).sort(), [...Object.keys(IWATE), ...Object.keys(AKITA)].sort());
  for (const [id, name] of Object.entries(AKITA)) {
    const x = data.find(v => v.id === id);
    assert.ok(x, id);
    assert.equal(x.facility, name);
    assert.equal(x.prefecture, '秋田県');
  }
  assert.deepEqual(data.filter(x => x.prefecture === '秋田県').map(x => x.id).sort(), Object.keys(AKITA));
  for (const [id, name] of Object.entries(IWATE)) {
    const x = data.find(v => v.id === id);
    assert.ok(x, id);
    assert.equal(x.facility, name);
    assert.equal(x.prefecture, '岩手県');
  }
  assert.deepEqual(data.filter(x => x.prefecture === '岩手県').map(x => x.id).sort(), Object.keys(IWATE));
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
  // 湯の色は、その湯自体について公式に書かれた浴槽だけ(ほかは施設全体の補足文であり、個別の湯の色ではない)
  const COLORED = { 'onsen-018': ['神経痛の湯'], 'onsen-006': ['混浴露天風呂'], 'onsen-012': ['混浴露天風呂', '男女別内湯'] };
  for (const [id, e] of Object.entries(feature)) assert.deepEqual(e.baths.filter(b => b.color).map(b => b.name), COLORED[id] || [], id);
  // 岩盤浴は色・泉質の検索対象にしない(色なし)、料金・営業時間は載せない
  assert.equal(feature['onsen-014'].baths.find(b => b.kind === '岩盤浴').color, undefined);
  assert.ok(!/円|\d{1,2}:\d{2}|営業時間/.test(JSON.stringify(Object.values(feature).map(e => [e.note, e.baths]))), 'no prices or hours');
  const text = JSON.stringify(feature);
  for (const banned of ['candidate', 'unconfirmed', '未確認', '候補']) assert.ok(!text.includes(banned), banned);
});

test('feature baths: Iwate 7 facilities publish only officially confirmed content', () => {
  const names = id => feature[id].baths.map(b => b.name);
  assert.deepEqual(names('onsen-006'), ['混浴露天風呂', '女性専用露天風呂', '内湯']);
  assert.deepEqual(names('onsen-007'), ['白猿の湯', '桂の湯', '白糸の湯']);
  assert.deepEqual(names('onsen-008'), ['大沢の湯', '豊沢の湯', '山水の湯']);
  assert.deepEqual(names('onsen-009'), ['大湯', '滝の湯', '真湯']);
  assert.deepEqual(names('onsen-010'), ['薬師の湯', '混浴露天風呂', '小浴場']);
  assert.deepEqual(names('onsen-011'), ['大浴場', '貸切風呂']);
  assert.deepEqual(names('onsen-012'), ['混浴露天風呂', '宿泊者専用露天風呂', '男女別内湯']);
  assert.equal(Object.keys(IWATE).reduce((n, id) => n + feature[id].baths.length, 0), 20);
  // 峡雲荘: 色は混浴露天風呂だけ。源泉の無色透明を浴槽へ転用しない
  assert.equal(feature['onsen-006'].baths[0].color, '乳白色(わずかに緑をふくむ)');
  assert.ok(!/無色|透明/.test(JSON.stringify(feature['onsen-006'])));
  // 山水閣: 大沢の湯が筆頭で湯治屋の浴場と明記。貸切家族風呂は含めず、宿泊者の利用条件を断定しない
  assert.equal(feature['onsen-008'].baths[0].note, '湯治屋の浴場です');
  assert.ok(!JSON.stringify(feature['onsen-008']).includes('貸切家族風呂'));
  assert.ok(!/宿泊(の方|者)は.*(利用できます|入浴できます)/.test(JSON.stringify(feature['onsen-008'])));
  // 石塚旅館: 浴槽別の色なし。緑・青は施設全体の補足。営業状態は推測しない
  assert.ok(feature['onsen-010'].baths.every(b => !b.color && !b.tags));
  assert.match(feature['onsen-010'].note, /緑色/);
  assert.match(feature['onsen-010'].note, /青色/);
  assert.ok(!/雪害|休止|営業|宿泊/.test(JSON.stringify(feature['onsen-010'])));
  // 候補・未確認の泉質名を載せない
  for (const id of ['onsen-009', 'onsen-011']) assert.ok(!/塩化物|硫酸塩|泉質/.test(JSON.stringify(feature[id])), id);
  // 彩雲荘: 泥パック・足元湧出を個別の湯に紐づけない
  assert.ok(feature['onsen-012'].baths.every(b => !/泥|足元/.test(JSON.stringify(b))));
  // 足元湧出は公式に明記された藤三旅館の白猿の湯と元湯夏油の露天だけ
  const foot = Object.entries(feature).filter(([id]) => IWATE[id]).flatMap(([id, e]) => e.baths.filter(b => (b.tags || []).includes('足元湧出')).map(b => id + '/' + b.name));
  assert.deepEqual(foot, ['onsen-007/白猿の湯', 'onsen-009/大湯', 'onsen-009/滝の湯', 'onsen-009/真湯']);
});
