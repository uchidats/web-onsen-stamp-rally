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
  assert.deepEqual(Object.keys(colors).sort(), ['onsen-006', 'onsen-010', 'onsen-012', 'onsen-017', 'onsen-018', 'onsen-021']);
  for (const [id, e] of Object.entries(colors)) {
    assert.ok(ids.has(id), id);
    assert.ok(e.colors.length >= 1 && e.colors.length <= 3, id);
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
  for (const id of ['onsen-013', 'onsen-014', 'onsen-015', 'onsen-016']) assert.equal(colors[id], undefined, id);
  assert.ok(!JSON.stringify(colors).includes('colorless'));
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
          assert.ok(b.color && b.color.includes(label), `${id}/${n}: detail color must mention ${label}`);
        }
      }
    }
  }
  // 詳細画面で個別の湯に色が出る施設は、カードの丸にも同じ湯が載っている
  for (const [id, e] of Object.entries(feature)) {
    const colored = e.baths.filter(b => b.color).map(b => b.name).sort();
    const onCard = (colors[id] ? colors[id].colors.filter(c => c.scope === 'bath').flatMap(c => c.scopeNames) : []).sort();
    assert.deepEqual(onCard, colored, id);
  }
  // 施設全体の色は詳細画面の補足文にも出ている
  const FACILITY_WORD = { 'onsen-010': ['緑色', '青色'], 'onsen-017': ['茶褐色', '緑', '白色'], 'onsen-021': ['白濁'] };
  for (const [id, words] of Object.entries(FACILITY_WORD)) for (const w of words) assert.ok(feature[id].note.includes(w), `${id}: ${w}`);
  // 色が変化する湯は代表色を1個だけ登録している
  assert.equal(colors['onsen-017'].colors.length, 1);
  assert.equal(colors['onsen-010'].colors.length, 1);
  assert.equal(colors['onsen-006'].colors.length, 1);
});
