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
const kake = load('kakenagashi.js').ONSEN_KAKENAGASHI;

test('kakenagashi: every entry is keyed by an existing facility and records scope, evidence, dilution and source', () => {
  const ids = new Set(data.map(x => x.id));
  for (const [id, e] of Object.entries(kake)) {
    assert.ok(ids.has(id), id);
    assert.ok(['facility', 'partial'].includes(e.scope), id);
    assert.ok(Array.isArray(e.baths), id);
    assert.ok(['official_text', 'third_party'].includes(e.evidence.type), id);
    assert.ok(['confirmed', 'third_party_reported'].includes(e.evidence.confidence), id);
    assert.equal(e.evidence.type === 'official_text', e.evidence.confidence === 'confirmed', id);
    assert.ok(e.evidence.note && e.evidence.note.length > 15, id);
    assert.ok(['none', 'for_temperature', 'added', 'unknown'].includes(e.dilution.water), id);
    assert.match(e.source.url, /^https?:\/\//);
    assert.match(e.source.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('kakenagashi: the card icon facilities are exactly the confirmed ones (34); unconfirmed facilities get none', () => {
  assert.deepEqual(Object.keys(kake).sort(), [
    'onsen-003', 'onsen-004', 'onsen-005', 'onsen-006', 'onsen-007', 'onsen-008', 'onsen-009', 'onsen-010', 'onsen-011', 'onsen-012',
    'onsen-015', 'onsen-016', 'onsen-017', 'onsen-018', 'onsen-019', 'onsen-020', 'onsen-021', 'onsen-023', 'onsen-024', 'onsen-026', 'onsen-027',
    'onsen-028', 'onsen-029', 'onsen-030', 'onsen-031', 'onsen-032', 'onsen-033',
    'onsen-034', 'onsen-035', 'onsen-036', 'onsen-037', 'onsen-038', 'onsen-039', 'onsen-048'
  ]);
  // 酸ヶ湯・新玉川・玉川・川原毛は、かけ流しを明記した資料を確認できていない
  for (const id of ['onsen-002', 'onsen-013', 'onsen-014', 'onsen-022']) assert.equal(kake[id], undefined, id);
  // 一部の浴槽だけの施設は施設全体と断定しない(partial)
  for (const id of ['onsen-004', 'onsen-008', 'onsen-011', 'onsen-019', 'onsen-023', 'onsen-024', 'onsen-026', 'onsen-027', 'onsen-035']) assert.equal(kake[id].scope, 'partial', id);
  // 福島: 安達屋は大気の湯だけ(薬師の湯・東の湯・西の湯は個別のかけ流しの記載なし)、二階堂は施設カードのみ(浴槽名・稼働が未確認)
  assert.deepEqual(kake['onsen-034'].baths, ['萱ぶき湯小屋「玉子湯」', '天渓の湯', '瀬音']);
  assert.deepEqual(kake['onsen-035'].baths, ['大気の湯(東・西)']);
  assert.deepEqual(kake['onsen-036'].baths, ['鬼面の湯', '天狗の湯', '千寿の湯']);
  assert.deepEqual(kake['onsen-037'].baths, ['自噴巌風呂', '滝の湯', '檜風呂']);
  assert.deepEqual(kake['onsen-038'].baths, []);
  assert.equal(kake['onsen-038'].evidence.type, 'third_party');
  assert.deepEqual(kake['onsen-039'].baths, ['大浴場(内湯)', '男女別露天風呂', '貸切露天風呂(陶器2槽)']);
  // 宮城: 峩々温泉は大浴場だけ(混浴露天・天空の湯へ施設全体の記述を広げない)、時音の宿は薬湯だけ(洞窟の湯は循環の記載)、大沼は3湯
  assert.deepEqual(kake['onsen-024'].baths, ['大浴場(あつ湯・ぬる湯)']);
  assert.deepEqual(kake['onsen-026'].baths, ['薬湯']);
  assert.deepEqual(kake['onsen-027'].baths, ['母里の湯', '薬師千人風呂', '天女風呂']);
  assert.equal(kake['onsen-025'], undefined); // 岡崎旅館は営業確認待ちで未登録
});

test('kakenagashi: per-bath icons use only bath-level evidence and match 代表的な湯 names', () => {
  let n = 0;
  for (const [id, e] of Object.entries(kake)) {
    const names = (feature[id] ? feature[id].baths : []).map(b => b.name);
    for (const b of e.baths) { assert.ok(names.includes(b), `${id}: ${b} is not a registered 代表的な湯`); n++; }
    // 第三者団体の一覧(施設単位)だけでは、個々の浴槽に広げない
    if (e.evidence.type === 'third_party') assert.deepEqual(e.baths, [], id);
  }
  assert.equal(n, 54);
  // 施設全体の記述だけの施設・かけ流しが明記されていない浴槽には付けない
  assert.deepEqual(kake['onsen-008'].baths, ['大沢の湯']); // 山水の湯・豊沢の湯は公式FAQのかけ流しの列挙に含まれない
  assert.deepEqual(kake['onsen-011'].baths, ['大浴場']); // 貸切風呂は記載なし
  assert.ok(!kake['onsen-018'].baths.includes('箱蒸し風呂')); // 蒸し風呂は湯ではない
  for (const id of ['onsen-010', 'onsen-015', 'onsen-017', 'onsen-020', 'onsen-021', 'onsen-028', 'onsen-032', 'onsen-033']) assert.deepEqual(kake[id].baths, [], id);
  // 妙乃湯: 「8つの湯舟に掛け流し」と湯舟全体を対象にした記述のため、貸切風呂にも表示する
  assert.deepEqual(kake['onsen-016'].baths, ['やわらぎの湯－銀の湯']);
  // 桝形屋は公式の基本情報(利用形態: 源泉かけ流し)で確認できるため公式扱い。浴槽ごとの記載はなく施設のみ
  assert.equal(kake['onsen-032'].evidence.type, 'official_text');
});

test('kakenagashi: the wave icon replaces the plain 源泉かけ流し tag; different tags (源泉100%, 足元湧出) stay', () => {
  for (const [id, e] of Object.entries(feature)) for (const b of e.baths) {
    assert.ok(!(b.tags || []).some(t => /かけ流し|掛け流し|掛流/.test(t)), `${id}/${b.name}: use the wave icon instead of a tag`);
  }
  const tags = Object.values(feature).flatMap(e => e.baths.flatMap(b => b.tags || []));
  assert.ok(tags.includes('源泉100%'));
  assert.ok(tags.includes('足元湧出'));
  // 「源泉100%」だけでは、かけ流しと判定しない(源泉100%を挙げる浴槽でも、かけ流しの根拠が無ければアイコンなし)
  assert.ok(!(kake['onsen-014'] || { baths: [] }).baths.length);
});
