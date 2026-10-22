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
const { ONSEN_COLOR_DEFS: defs, ONSEN_BATH_COLORS: colors } = load('bath-colors.js');
const KINDS = ['tint', 'rare', 'seasonal'];

test('bath colors: shared definitions cover every color class with a formal name and an approximate display color', () => {
  assert.deepEqual(Object.keys(defs).sort(), ['black', 'blue', 'brown', 'colorless', 'gray_white', 'green', 'milky_white', 'other', 'white', 'yellow'].sort());
  for (const [id, d] of Object.entries(defs)) {
    assert.ok(d.label, id);
    assert.match(d.ring, /^#[0-9a-f]{6}$/i, id);
    if (id === 'colorless') { assert.equal(d.hollow, true); assert.equal(d.fill, 'transparent'); }
    else { assert.match(d.fill, /^#[0-9a-f]{6}$/i, id); assert.ok(!d.hollow, id); }
  }
  assert.notEqual(defs.milky_white.fill, defs.white.fill);
  assert.equal(defs.colorless.hollow, true, 'colorless transparent is a hollow ring, distinct from filled milky white');
});

test('bath colors: keyed by existing facility IDs, up to 3 colors, source recorded, nothing for unconfirmed facilities', () => {
  const ids = new Set(data.map(x => x.id));
  assert.deepEqual(Object.keys(colors).sort(), ['onsen-002', 'onsen-003', 'onsen-004', 'onsen-006', 'onsen-008', 'onsen-010', 'onsen-012', 'onsen-015', 'onsen-016', 'onsen-017', 'onsen-018', 'onsen-019', 'onsen-020', 'onsen-021', 'onsen-026', 'onsen-027', 'onsen-028', 'onsen-030', 'onsen-031', 'onsen-032', 'onsen-034', 'onsen-035', 'onsen-036', 'onsen-039', 'onsen-040', 'onsen-041', 'onsen-043', 'onsen-044', 'onsen-046', 'onsen-048', 'onsen-051', 'onsen-052', 'onsen-054', 'onsen-057', 'onsen-059', 'onsen-061', 'onsen-062', 'onsen-064', 'onsen-065', 'onsen-066', 'onsen-067']);
  for (const [id, e] of Object.entries(colors)) {
    assert.ok(ids.has(id), id);
    assert.ok(e.colors.length >= 1, id);
    assert.ok(new Set(e.colors.map(c => c.color)).size <= 3, id + ': at most 3 distinct colors on a card');
    assert.match(e.source.url, /^https?:\/\//);
    assert.match(e.source.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
    for (const c of e.colors) {
      assert.ok(defs[c.color], `${id}: ${c.color}`);
      assert.ok(c.expression, id);
      assert.ok(['facility', 'bath'].includes(c.scope), id);
      if (c.scope === 'bath') assert.ok(c.scopeNames && c.scopeNames.length, `${id}: bath scope needs bath names`);
      else assert.equal(c.scopeNames, undefined, `${id}: facility scope has no bath names`);
      if (c.scopeLabel) assert.equal(c.scope, 'facility', `${id}: scopeLabel is only for facility-scope colors`);
      if (c.change) { assert.ok(KINDS.includes(c.change.kind), id); assert.ok(c.change.note, id); }
    }
  }
  // 源泉の「無色透明」(玉川・新玉川)や泉質からの推測を色として載せない。源泉分析値だけでは無色透明の丸を作らない
  for (const id of ['onsen-005', 'onsen-007', 'onsen-009', 'onsen-011', 'onsen-013', 'onsen-014', 'onsen-022', 'onsen-023', 'onsen-024', 'onsen-025', 'onsen-042', 'onsen-045', 'onsen-037', 'onsen-038', 'onsen-053', 'onsen-029', 'onsen-033']) assert.equal(colors[id], undefined, id);
  // 無色透明は、公式の本文または第三者資料に湯の色として書かれた施設・浴槽だけ(源泉の分析欄の「無色透明」や泉質からは作らない)
  assert.deepEqual(Object.entries(colors).filter(([, e]) => e.colors.some(c => c.color === 'colorless')).map(([id]) => id), ['onsen-026', 'onsen-048', 'onsen-061', 'onsen-062', 'onsen-064', 'onsen-003', 'onsen-008', 'onsen-016', 'onsen-019', 'onsen-027', 'onsen-028', 'onsen-046', 'onsen-065', 'onsen-067']);
});

test('bath colors: consistent with the 代表的な湯 data (no contradiction between card and detail)', () => {
  const baths = id => Object.fromEntries(feature[id].baths.map(b => [b.name, b]));
  for (const [id, e] of Object.entries(colors)) {
    for (const c of e.colors) {
      const label = defs[c.color].label;
      if (c.scope === 'bath') {
        for (const n of c.scopeNames) {
          // 浴場群の一部の槽だけの色は「浴場名＋槽名」で書く(例: 四季の湯の源泉槽)。詳細画面の湯名には丸を出さない
          const b = baths(id)[n] || (feature[id].baths.some(x => n.startsWith(x.name) && n !== x.name) ? { partial: true } : undefined);
          assert.ok(b, `${id}: ${n}`);
          if (b.color) assert.ok(b.color.includes(label), `${id}/${n}: detail color text must mention ${label}`);
        }
      }
    }
  }
  // 詳細画面で個別の湯に色が出る施設は、カードの丸にも同じ湯が載っている
  for (const [id, e] of Object.entries(feature)) {
    const colored = e.baths.filter(b => b.color).map(b => b.name);
    const withDot = colors[id] ? colors[id].colors.filter(c => c.scope === 'bath').flatMap(c => c.scopeNames) : [];
    for (const n of colored) assert.ok(withDot.includes(n), `${id}/${n}: a bath with a color text must also have a color dot entry`);
  }
  // 施設全体の色は詳細画面の補足文にも出ている
  const FACILITY_WORD = { 'onsen-010': ['緑色', '青色'], 'onsen-017': ['茶褐色', '緑', '白色'], 'onsen-021': ['白濁'], 'onsen-004': ['赤褐色'] };
  for (const [id, words] of Object.entries(FACILITY_WORD)) for (const w of words) assert.ok(feature[id].note.includes(w), `${id}: ${w}`);
  // 資料に複数の色が確認されている施設は左から順に最大3個。同じ色は重複しない
  const ids = id => colors[id].colors.map(c => c.color);
  const uniq = id => [...new Set(ids(id))];
  assert.deepEqual(uniq('onsen-017'), ['brown', 'green', 'white']);
  assert.deepEqual(uniq('onsen-010'), ['green', 'blue']);
  assert.deepEqual(uniq('onsen-030'), ['brown', 'yellow']);
  for (const id of ['onsen-031', 'onsen-032', 'onsen-002', 'onsen-004', 'onsen-006', 'onsen-012', 'onsen-015', 'onsen-018', 'onsen-020', 'onsen-021']) assert.equal(uniq(id).length, 1, id);
  // 同じ色・同じ範囲の重複登録はしない
  for (const [id, e] of Object.entries(colors)) { const keys = e.colors.map(c => c.color + '|' + c.scope + '|' + (c.scopeNames || []).join(',')); assert.equal(new Set(keys).size, keys.length, id + ': duplicate entry'); }
  // 元湯雄山閣は資料の記載順(茶褐色・緑・白色)で、変化の順序や頻度を意味しないことを説明文で伝える
  assert.ok(colors['onsen-017'].colors.every(c => c.listed && c.expression === '茶褐色、緑、白色' && c.change.kind === 'seasonal' && c.scope === 'facility'));
  // 石塚旅館: 緑が基本で、まれに青に変わる(2色とも施設全体の記載)
  assert.equal(colors['onsen-010'].colors[0].role, 'base');
  assert.equal(colors['onsen-010'].colors[1].role, 'variant');
  assert.match(colors['onsen-010'].colors[1].change.note, /まれに/);
  // 詳細画面の湯名の右に丸が出るのは scope:bath の湯だけ(施設全体の色は個々の湯へ適用しない)
  const bathScoped = Object.fromEntries(Object.entries(colors).map(([id, e]) => [id, e.colors.filter(c => c.scope === 'bath').flatMap(c => c.scopeNames)]));
  assert.deepEqual(bathScoped, { 'onsen-002': ['玉の湯', 'ヒバ千人風呂'], 'onsen-004': [], 'onsen-006': ['混浴露天風呂', '内湯'], 'onsen-010': ['薬師の湯', '混浴露天風呂', '小浴場'], 'onsen-012': ['混浴露天風呂', '男女別内湯', '宿泊者専用露天風呂'], 'onsen-015': [], 'onsen-017': [], 'onsen-018': ['神経痛の湯'], 'onsen-020': [], 'onsen-021': ['大露天風呂'], 'onsen-026': ['露天風呂付き大浴場(洞窟の湯)'], 'onsen-034': [], 'onsen-035': ['大気の湯(東・西)'], 'onsen-036': [], 'onsen-039': [], 'onsen-041': [], 'onsen-043': [], 'onsen-044': [], 'onsen-048': [], 'onsen-061': ['したの湯', 'うえの湯', 'おくの湯'], 'onsen-062': [], 'onsen-064': [], 'onsen-054': [], 'onsen-057': [], 'onsen-059': [], 'onsen-066': ['男女別の展望内湯'], 'onsen-030': ['かわら湯', '展望風呂(地蔵の湯・観音の湯)'], 'onsen-031': ['岩風呂', '檜露天風呂', '混浴内風呂'], 'onsen-032': ['混浴露天風呂', '女性専用露天風呂'], 'onsen-003': ['久安の湯', '泉響の湯'], 'onsen-008': [], 'onsen-016': ['やわらぎの湯－銀の湯'], 'onsen-019': [], 'onsen-027': [], 'onsen-028': [], 'onsen-040': [], 'onsen-046': [], 'onsen-051': [], 'onsen-052': [], 'onsen-065': [], 'onsen-067': [] });
});

test('bath colors: evidence is recorded for every color; photo-based or third-party colors can never look confirmed', () => {
  const TYPES = ['official_text', 'official_photo', 'third_party'];
  const CONF = ['confirmed', 'photo_inferred', 'third_party_reported'];
  for (const [id, e] of Object.entries(colors)) {
    for (const c of e.colors) {
      const ev = c.evidence;
      assert.ok(ev && TYPES.includes(ev.type) && CONF.includes(ev.confidence), id);
      if (ev.type === 'official_photo') { assert.equal(ev.confidence, 'photo_inferred', id); assert.ok(ev.note, id + ': photo evidence must say how bath bottom/lighting were excluded'); }
      if (ev.type === 'third_party') assert.equal(ev.confidence, 'third_party_reported', id);
      if (ev.confidence === 'confirmed') assert.equal(ev.type, 'official_text', id);
      if (c.role) assert.ok(['base', 'variant'].includes(c.role), id);
    }
  }
  // 登録済みの6施設(秋田・岩手)の色は新仕様でも失われていない
  const old = { 'onsen-006': 'milky_white', 'onsen-010': 'green', 'onsen-012': 'milky_white', 'onsen-017': 'brown', 'onsen-018': 'gray_white', 'onsen-021': 'white', 'onsen-002': 'milky_white', 'onsen-004': 'brown', 'onsen-030': 'brown', 'onsen-031': 'milky_white', 'onsen-032': 'milky_white' };
  for (const [id, color] of Object.entries(old)) assert.equal(colors[id].colors[0].color, color, id);
});

test('bath colors: photo-inferred and third-party colors are recorded as such, with a sourced reason, and every added bath name exists', () => {
  const photo = [], third = [];
  for (const [id, e] of Object.entries(colors)) for (const c of e.colors) {
    if (c.evidence.type === 'official_photo') photo.push(id + '/' + (c.scopeNames || ['facility']).join(','));
    if (c.evidence.type === 'third_party') third.push(id + '/' + (c.scopeNames || ['facility']).join(','));
    if (c.evidence.type !== 'official_text') {
      assert.ok(c.evidence.note && c.evidence.note.length > 20, id + ': non-text evidence must explain what was checked');
      assert.ok((c.source || e.source).url.startsWith('http'));
      assert.match((c.source || e.source).checkedAt, /^\d{4}-\d{2}-\d{2}$/);
    }
  }
  assert.deepEqual(photo, ['onsen-006/内湯', 'onsen-010/薬師の湯,混浴露天風呂,小浴場', 'onsen-012/宿泊者専用露天風呂', 'onsen-032/混浴露天風呂,女性専用露天風呂']);
  assert.deepEqual(third, ['onsen-002/ヒバ千人風呂', 'onsen-015/facility', 'onsen-020/facility', 'onsen-021/大露天風呂', 'onsen-026/露天風呂付き大浴場(洞窟の湯)', 'onsen-035/大気の湯(東・西)', 'onsen-044/facility', 'onsen-059/facility', 'onsen-003/久安の湯,泉響の湯', 'onsen-008/facility', 'onsen-046/facility', 'onsen-065/facility']);
  // 写真から「無色透明」は登録しない(透明と無色の区別、浴槽の底・照明の影響で断定できない)。洞窟の湯は文章による第三者記載
  assert.ok(!photo.some(p => /onsen-026/.test(p)));
  // 旅館大沼は公式の源泉紹介(自家源泉=うすい紅茶色、共同源泉=透明)を、どの浴槽かを特定せず施設の一部の範囲(scopeLabel)として登録する。浴槽名(天女風呂など)には丸を出さない。峩々温泉の施設色・源泉分析書の色は登録しない
  assert.deepEqual(colors['onsen-027'].colors.map(c => [c.color, c.scope, c.scopeLabel, c.evidence.type]), [['brown', 'facility', '自家源泉の湯', 'official_text'], ['colorless', 'facility', '共同源泉の湯', 'official_text']]);
  assert.equal(colors['onsen-024'], undefined);
  // 玉川・新玉川は複数浴槽の色を取り違えないため登録しない
  assert.equal(colors['onsen-013'], undefined);
  assert.equal(colors['onsen-014'], undefined);
});

test('bath colors: Fukushima facility colors stay facility-scoped; only 大気の湯 has a bath color (third party), no duplicate Adachiya dot', () => {
  for (const id of ['onsen-034', 'onsen-036', 'onsen-039']) assert.ok(colors[id].colors.every(c => c.scope === 'facility'), id);
  // 玉子湯の源泉の「青白濁」を浴槽色にしない・柏屋/二階堂は色を載せない
  assert.equal(colors['onsen-037'], undefined);
  assert.equal(colors['onsen-038'], undefined);
  // 安達屋: 白濁(公式・施設全体)とミルキーブルー(第三者・大気の湯)は同じ乳白色の1つの丸
  const a = colors['onsen-035'].colors;
  assert.deepEqual(a.map(c => c.scope), ['facility', 'bath']);
  assert.deepEqual([...new Set(a.map(c => c.color))], ['milky_white']);
  assert.equal(a[1].evidence.confidence, 'third_party_reported');
  assert.deepEqual(a[1].scopeNames, ['大気の湯(東・西)']);
  assert.ok(!JSON.stringify(colors['onsen-035']).includes('"blue"'));
  // 万葉亭: 乳白色は年に数回のまれな変化色(普段は透明。無色の丸は作らない)
  const m = colors['onsen-039'].colors[0];
  assert.equal(m.role, 'variant');
  assert.equal(m.change.kind, 'rare');
});

test('bath colors: Tochigi has 3 facility-level colors only (no bath-level color), merged tints and a third-party label', () => {
  for (const id of ['onsen-041', 'onsen-043', 'onsen-044']) assert.ok(colors[id].colors.every(c => c.scope === 'facility'), id);
  // 八丁の湯・大黒屋には根拠不足の色を載せない(大黒屋の「泉色」は源泉の概要欄で、浴槽色の根拠にしない)
  for (const id of ['onsen-042', 'onsen-045']) assert.equal(colors[id], undefined, id);
  // 明賀屋: 公式トップの「茶褐色のにごり湯」(施設全体)
  assert.deepEqual(colors['onsen-040'].colors.map(c => [c.color, c.scope, c.expression, c.evidence.type, c.evidence.confidence]), [['brown', 'facility', '茶褐色', 'official_text', 'confirmed']]);
  // 加仁湯: 白・青白は乳白色1色、黒はまれな変化色
  const k = colors['onsen-041'].colors;
  assert.deepEqual(k.map(c => c.color), ['milky_white', 'black']);
  assert.equal(k[1].role, 'variant'); assert.equal(k[1].change.kind, 'rare');
  assert.ok(!JSON.stringify(k).includes('"green"'));
  // 元泉館: 公式の画像alt文章(写真推定ではない)。白濁・緑・黒
  const g = colors['onsen-043'].colors;
  assert.deepEqual(g.map(c => c.color), ['milky_white', 'green', 'black']);
  assert.ok(g.every(c => c.evidence.type === 'official_text' && c.evidence.confidence === 'confirmed' && c.listed === true));
  // 鹿の湯: 第三者団体の記載
  assert.equal(colors['onsen-044'].colors[0].evidence.confidence, 'third_party_reported');
  assert.equal(colors['onsen-044'].colors[0].evidence.type, 'third_party');
});

test('bath colors: Niigata colorless is facility-level for 3 facilities; bath-level only for Jizaikan common baths', () => {
  for (const id of ['onsen-061', 'onsen-062', 'onsen-064']) assert.ok(colors[id].colors.every(c => c.color === 'colorless'), id);
  for (const id of ['onsen-060', 'onsen-063']) assert.equal(colors[id], undefined, id);
  const bathScoped = Object.entries(colors).filter(([id, e]) => /^onsen-06[0-4]$/.test(id) && e.colors.some(c => c.scope === 'bath')).map(([id]) => id);
  assert.deepEqual(bathScoped, ['onsen-061']);
  assert.deepEqual(colors['onsen-061'].colors.find(c => c.scope === 'bath').scopeNames, ['したの湯', 'うえの湯', 'おくの湯']);
  assert.ok(colors['onsen-062'].colors.every(c => c.scope === 'facility') && colors['onsen-064'].colors.every(c => c.scope === 'facility'));
});

test('bath colors: Nagano adds 3 card colors only; a partial-tank color is card-only and never appears on a bath-group name', () => {
  assert.deepEqual(['onsen-054', 'onsen-057', 'onsen-059'].map(id => colors[id].colors.map(c => c.color)), [['milky_white'], ['milky_white'], ['other']]);
  for (const id of ['onsen-055', 'onsen-056', 'onsen-058']) assert.equal(colors[id], undefined, id);
  // 高峰: 乳白色は四季の湯の源泉槽の記載。部分範囲を個別の湯に表せないため施設カードだけ(個別色は保留。浴場名に丸を出さない)
  assert.ok(colors['onsen-054'].colors.every(c => c.scope === 'facility' && c.scopeNames === undefined));
  assert.equal(colors['onsen-054'].colors[0].scopeLabel, '四季の湯・源泉槽'); // ツールチップは「(施設全体)」でなく適用範囲を出す
  // scopeLabel は施設カードの適用範囲の表示用で、現時点では高峰だけ。他の施設全体の色は「(施設全体)」のまま
  assert.deepEqual(Object.entries(colors).filter(([, e]) => e.colors.some(c => c.scopeLabel)).map(([id]) => id), ['onsen-054', 'onsen-008', 'onsen-027']);
  // 齋藤: 龍神の湯の内湯の「白さ」は群の一部のため個別色は保留。神乃湯の橙色は観光協会の施設単位の記載
  assert.ok(colors['onsen-057'].colors.every(c => c.scope === 'facility'));
  assert.equal(colors['onsen-059'].colors[0].evidence.type, 'third_party');
  assert.equal(colors['onsen-059'].colors[0].scope, 'facility');
});

test('bath colors: Toyama has Mikurigaike white (card + the single bath group); Oomaki (third-party) and Ogawa (official) are facility-level colorless only', () => {
  assert.deepEqual(colors['onsen-066'].colors.map(c => [c.color, c.scope, c.expression]), [['white', 'bath', '白く濁る']]);
  assert.deepEqual(colors['onsen-066'].colors[0].scopeNames, ['男女別の展望内湯']);
  // 乳白色など同系色を重複登録しない
  assert.equal(colors['onsen-066'].colors.length, 1);
  assert.deepEqual(colors['onsen-065'].colors.map(c => [c.color, c.scope, c.evidence.type, c.evidence.confidence]), [['colorless', 'facility', 'third_party', 'third_party_reported']]);
  assert.deepEqual(colors['onsen-067'].colors.map(c => [c.color, c.scope, c.evidence.type, c.evidence.confidence]), [['colorless', 'facility', 'official_text', 'confirmed']]);
});

test('bath colors: Hokkaido (Shiriuchi) has no color yet (conflicting sources are held)', () => {
  assert.equal(colors['onsen-001'], undefined);
});
