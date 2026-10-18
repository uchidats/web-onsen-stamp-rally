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
  assert.deepEqual(Object.keys(colors).sort(), ['onsen-002', 'onsen-004', 'onsen-006', 'onsen-010', 'onsen-012', 'onsen-015', 'onsen-017', 'onsen-018', 'onsen-020', 'onsen-021', 'onsen-026', 'onsen-030', 'onsen-031', 'onsen-032']);
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
      if (c.change) { assert.ok(KINDS.includes(c.change.kind), id); assert.ok(c.change.note, id); }
    }
  }
  // 源泉の「無色透明」(玉川・新玉川)や泉質からの推測を色として載せない。無色透明の丸は今回どの施設にも使わない
  for (const id of ['onsen-003', 'onsen-005', 'onsen-007', 'onsen-008', 'onsen-009', 'onsen-011', 'onsen-013', 'onsen-014', 'onsen-016', 'onsen-019', 'onsen-022', 'onsen-023', 'onsen-024', 'onsen-025', 'onsen-027', 'onsen-028', 'onsen-029', 'onsen-033']) assert.equal(colors[id], undefined, id);
  // 無色透明の丸は時音の宿「洞窟の湯」(第三者誌の記載)だけ
  assert.deepEqual(Object.entries(colors).filter(([, e]) => e.colors.some(c => c.color === 'colorless')).map(([id]) => id), ['onsen-026']);
});

test('bath colors: consistent with the 代表的な湯 data (no contradiction between card and detail)', () => {
  const baths = id => Object.fromEntries(feature[id].baths.map(b => [b.name, b]));
  for (const [id, e] of Object.entries(colors)) {
    for (const c of e.colors) {
      const label = defs[c.color].label;
      if (c.scope === 'bath') {
        for (const n of c.scopeNames) {
          const b = baths(id)[n];
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
  assert.deepEqual(bathScoped, { 'onsen-002': ['玉の湯', 'ヒバ千人風呂'], 'onsen-004': [], 'onsen-006': ['混浴露天風呂', '内湯'], 'onsen-010': ['薬師の湯', '混浴露天風呂', '小浴場'], 'onsen-012': ['混浴露天風呂', '男女別内湯', '宿泊者専用露天風呂'], 'onsen-015': [], 'onsen-017': [], 'onsen-018': ['神経痛の湯'], 'onsen-020': [], 'onsen-021': ['大露天風呂'], 'onsen-026': ['露天風呂付き大浴場(洞窟の湯)'], 'onsen-030': ['かわら湯', '展望風呂(地蔵の湯・観音の湯)'], 'onsen-031': ['岩風呂', '檜露天風呂', '混浴内風呂'], 'onsen-032': ['混浴露天風呂', '女性専用露天風呂'] });
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
  assert.deepEqual(third, ['onsen-002/ヒバ千人風呂', 'onsen-015/facility', 'onsen-020/facility', 'onsen-021/大露天風呂', 'onsen-026/露天風呂付き大浴場(洞窟の湯)']);
  // 写真から「無色透明」は登録しない(透明と無色の区別、浴槽の底・照明の影響で断定できない)。洞窟の湯は文章による第三者記載
  assert.ok(!photo.some(p => /onsen-026/.test(p)));
  // 天女風呂(公式の源泉紹介からの間接候補)・峩々温泉の施設色・源泉分析書の色は登録しない
  assert.equal(colors['onsen-027'], undefined);
  assert.equal(colors['onsen-024'], undefined);
  // 玉川・新玉川は複数浴槽の色を取り違えないため登録しない
  assert.equal(colors['onsen-013'], undefined);
  assert.equal(colors['onsen-014'], undefined);
});
