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

const AOMORI = {
  'onsen-002': '酸ヶ湯温泉旅館', 'onsen-003': '蔦温泉旅館', 'onsen-004': '黄金崎不老ふ死温泉', 'onsen-005': '姉戸川温泉'
};

const YAMAGATA = {
  'onsen-028': '東屋', 'onsen-029': '湯守の宿三之亟', 'onsen-030': '湯宿元河原湯', 'onsen-031': '福島屋', 'onsen-032': '桝形屋', 'onsen-033': '吾妻屋'
};

const MIYAGI = {
  'onsen-024': '峩々温泉', 'onsen-026': '時音の宿 湯主一條', 'onsen-027': '旅館大沼'
};

const FUKUSHIMA = {
  'onsen-034': '旅館玉子湯', 'onsen-035': '安達屋旅館', 'onsen-036': '野地温泉ホテル', 'onsen-037': '柏屋旅館', 'onsen-039': '御宿 万葉亭'
};

const IWATE = {
  'onsen-006': '峡雲荘', 'onsen-007': '藤三旅館', 'onsen-008': '山水閣', 'onsen-009': '元湯夏油', 'onsen-010': '石塚旅館', 'onsen-011': 'ほっとゆだ', 'onsen-012': '彩雲荘'
};

test('feature baths: data is keyed by existing facility IDs and covers exactly the 11 Akita, 7 Iwate, 4 Aomori, 6 Yamagata, 3 Miyagi and 5 Fukushima facilities', () => {
  assert.equal(data.length, 67);
  assert.deepEqual(Object.keys(feature).sort(), [...Object.keys(YAMAGATA), ...Object.keys(AOMORI), ...Object.keys(IWATE), ...Object.keys(AKITA), ...Object.keys(MIYAGI), ...Object.keys(FUKUSHIMA)].sort());
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
  for (const [id, name] of Object.entries(AOMORI)) {
    const x = data.find(v => v.id === id);
    assert.ok(x, id);
    assert.equal(x.facility, name);
    assert.equal(x.prefecture, '青森県');
  }
  assert.deepEqual(data.filter(x => x.prefecture === '青森県').map(x => x.id).sort(), Object.keys(AOMORI));
  for (const [id, name] of Object.entries(YAMAGATA)) {
    const x = data.find(v => v.id === id);
    assert.ok(x, id);
    assert.equal(x.facility, name);
    assert.equal(x.prefecture, '山形県');
  }
  assert.deepEqual(data.filter(x => x.prefecture === '山形県').map(x => x.id).sort(), Object.keys(YAMAGATA));
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
  const COLORED = { 'onsen-030': ['かわら湯', '展望風呂(地蔵の湯・観音の湯)'], 'onsen-031': ['岩風呂', '檜露天風呂', '混浴内風呂'], 'onsen-002': ['玉の湯'], 'onsen-018': ['神経痛の湯'], 'onsen-006': ['混浴露天風呂'], 'onsen-012': ['混浴露天風呂', '男女別内湯'] };
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

test('feature baths: Aomori 4 facilities publish only officially confirmed content (9 baths)', () => {
  const names = id => feature[id].baths.map(b => b.name);
  assert.deepEqual(names('onsen-002'), ['ヒバ千人風呂', '玉の湯']);
  assert.deepEqual(names('onsen-003'), ['久安の湯', '泉響の湯', '貸切風呂']);
  assert.deepEqual(names('onsen-004'), ['海辺の露天風呂', '不老ふ死の湯', '黄金の湯']);
  assert.deepEqual(names('onsen-005'), ['大浴場']);
  assert.equal(Object.keys(AOMORI).reduce((n, id) => n + feature[id].baths.length, 0), 9);
  // 酸ヶ湯: 白濁は玉の湯だけ。千人風呂には色を付けない。足元湧出は環境省計画書の「自然湧出(源泉の湧出状況)」からは確認できず載せない。4源泉と施設全体の源泉数を混同しない
  assert.equal(feature['onsen-002'].baths[1].color, '白濁(乳白色)');
  assert.equal(feature['onsen-002'].baths[0].color, undefined);
  assert.ok(!JSON.stringify(feature['onsen-002']).includes('足元'));
  assert.ok(!/5つ|五つ|5本|５つ/.test(JSON.stringify(feature['onsen-002'])));
  assert.ok(feature['onsen-002'].baths[0].note.includes('4つ'));
  // 蔦温泉: 足元湧出は3浴場それぞれ。湯の色(県観光サイトの「無色透明の湯玉」)は載せない
  assert.ok(feature['onsen-003'].baths.every(b => b.tags.includes('足元湧出')));
  assert.ok(!/無色|透明|色/.test(JSON.stringify(feature['onsen-003'])));
  // 黄金崎: 海辺の露天風呂は混浴・女性専用の2浴槽を1項目にまとめ、形態は付けない。湯の色は施設全体の補足に書き、浴槽へは付けない
  assert.equal(feature['onsen-004'].baths[0].form, undefined);
  assert.match(feature['onsen-004'].baths[0].note, /混浴と女性専用/);
  assert.ok(feature['onsen-004'].baths.every(b => !b.color));
  assert.match(feature['onsen-004'].note, /赤褐色/);
  // 姉戸川温泉: 「大浴場」は説明用名称。確認できていない内湯・男女別・湯の色を付けない
  const aneto = feature['onsen-005'].baths[0];
  assert.equal(aneto.kind, undefined);
  assert.equal(aneto.form, undefined);
  assert.equal(aneto.color, undefined);
  assert.ok(!/透明/.test(JSON.stringify(feature['onsen-005'])));
});

test('feature baths: Yamagata 6 facilities publish only confirmed, currently usable baths (15 baths)', () => {
  const names = id => feature[id].baths.map(b => b.name);
  assert.deepEqual(names('onsen-028'), ['滝風呂', '石風呂', '露天風呂']);
  assert.deepEqual(names('onsen-029'), ['大岩風呂', 'ひょうたん風呂']);
  assert.deepEqual(names('onsen-030'), ['かわら湯', '展望風呂(地蔵の湯・観音の湯)']);
  assert.deepEqual(names('onsen-031'), ['岩風呂', '檜露天風呂', '混浴内風呂']);
  assert.deepEqual(names('onsen-032'), ['混浴露天風呂', '女性専用露天風呂', '檜造りの内風呂']);
  assert.deepEqual(names('onsen-033'), ['根っこ風呂', '眺望露天風呂']);
  assert.equal(Object.keys(YAMAGATA).reduce((n, id) => n + feature[id].baths.length, 0), 15);
  // 休止中の浴槽(三之亟の露天風呂・吾妻屋の滝見露天風呂)は代表的な湯に含めない
  assert.ok(!feature['onsen-029'].baths.some(b => b.name === '露天風呂'));
  assert.ok(!JSON.stringify(feature['onsen-033']).includes('滝見'));
  // 足元湧出は三之亟の大岩風呂(深湯・中湯)だけ。範囲を補足で限定している
  const foot = Object.entries(feature).filter(([id]) => YAMAGATA[id]).flatMap(([id, e]) => e.baths.filter(b => (b.tags || []).includes('足元湧出')).map(b => id + '/' + b.name));
  assert.deepEqual(foot, ['onsen-029/大岩風呂']);
  assert.match(feature['onsen-029'].baths[0].note, /深湯・中湯/);
  // 源泉の無色透明(白布・三之亟・吾妻屋)を湯の色にしない。施設全体の色を浴槽へ広げない
  for (const id of ['onsen-028', 'onsen-029', 'onsen-033']) assert.ok(!/無色|透明/.test(JSON.stringify(feature[id])) && feature[id].baths.every(b => !b.color), id);
  assert.equal(feature['onsen-032'].baths.filter(b => b.color).length, 0);
  assert.equal(feature['onsen-030'].baths[0].color, '微かに茶褐色');
  assert.equal(feature['onsen-030'].baths[1].color, '微かに黄色');
  assert.ok(feature['onsen-031'].baths.every(b => b.color === '乳白色の濁り湯'));
});

test('feature baths: Miyagi publishes 8 confirmed baths for 3 facilities; Okazaki Ryokan is held until its operation is confirmed', () => {
  const names = id => feature[id].baths.map(b => b.name);
  assert.deepEqual(names('onsen-024'), ['大浴場(あつ湯・ぬる湯)', '混浴露天風呂', '貸切露天風呂(天空の湯)']);
  assert.deepEqual(names('onsen-026'), ['薬湯', '露天風呂付き大浴場(洞窟の湯)']);
  assert.deepEqual(names('onsen-027'), ['母里の湯', '薬師千人風呂', '天女風呂']);
  assert.equal(Object.keys(MIYAGI).reduce((n, id) => n + feature[id].baths.length, 0), 8);
  for (const id of Object.keys(MIYAGI)) assert.equal(data.find(x => x.id === id).prefecture, '宮城県');
  assert.equal(feature['onsen-025'], undefined);
  // 研究用ID(bth-*)を公開データに持ち込まない
  assert.ok(!JSON.stringify(feature).includes('bth-'));
  // 峩々温泉: 混浴と男女別を1つの属性にまとめない。大浴場の男女別は第三者記載のため公開しない
  assert.equal(feature['onsen-024'].baths[0].form, undefined);
  assert.equal(feature['onsen-024'].baths[1].form, '混浴');
  // 湯の色は feature-baths には書かない(bath-colors.js が正本)
  assert.ok(Object.keys(MIYAGI).every(id => feature[id].baths.every(b => !b.color)));
});

test('feature baths: Fukushima publishes 15 baths for 5 facilities; Nikaido (onsen-038) is held but stays in the facility master', () => {
  const names = id => feature[id].baths.map(b => b.name);
  assert.deepEqual(names('onsen-034'), ['萱ぶき湯小屋「玉子湯」', '天渓の湯', '瀬音']);
  assert.deepEqual(names('onsen-035'), ['大気の湯(東・西)', '薬師の湯', '東の湯・西の湯']);
  assert.deepEqual(names('onsen-036'), ['鬼面の湯', '天狗の湯', '千寿の湯']);
  assert.deepEqual(names('onsen-037'), ['自噴巌風呂', '滝の湯', '檜風呂']);
  assert.deepEqual(names('onsen-039'), ['大浴場(内湯)', '男女別露天風呂', '貸切露天風呂(陶器2槽)']);
  assert.equal(Object.keys(FUKUSHIMA).reduce((n, id) => n + feature[id].baths.length, 0), 15);
  for (const id of Object.keys(FUKUSHIMA)) assert.equal(data.find(x => x.id === id).prefecture, '福島県');
  assert.ok(data.some(x => x.id === 'onsen-038'));
  assert.equal(feature['onsen-038'], undefined);
  assert.ok(!JSON.stringify(feature).includes('research-fukushima'));
  // 瀬音は現行公式の貸切。天翔の湯は独立に追加しない。流失した旧対岸の野天風呂を復活させない
  assert.equal(feature['onsen-034'].baths[2].form, '貸切');
  assert.ok(!JSON.stringify(feature['onsen-034']).includes('天翔'));
  assert.ok(!JSON.stringify(feature['onsen-037']).includes('対岸'));
  // 安達屋: 旧混浴・旧名(不動の湯・姫の湯)を使わない
  assert.equal(feature['onsen-035'].baths[0].form, '男女別');
  assert.ok(!/不動の湯|姫の湯|混浴/.test(feature['onsen-035'].baths.map(b => b.name + (b.form || '')).join('')));
  // 万葉亭の3名称は説明用であることを明記
  assert.match(feature['onsen-039'].note, /説明用/);
  // 湯色は feature-baths に書かない
  assert.ok(Object.keys(FUKUSHIMA).every(id => feature[id].baths.every(b => !b.color)));
});
