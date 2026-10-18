const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function load(file) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  return sandbox.window;
}
const kakeWin = load('kakenagashi.js');
const kake = JSON.parse(JSON.stringify(kakeWin.ONSEN_KAKENAGASHI));
const plain = v => JSON.parse(JSON.stringify(v));
const evaluate = (e, n) => plain(kakeWin.ONSEN_GENSEI.evaluate(e, n));
const certifiedBaths = e => plain(kakeWin.ONSEN_GENSEI.certifiedBaths(e));
const feature = JSON.parse(JSON.stringify(load('feature-baths.js').ONSEN_FEATURE_BATHS));
const rule = (status, extra = {}) => ({ status, scope: 'all', coverage: '全浴槽', quote: 'q', url: 'https://example.com/', checkedAt: '2026-10-18', ...extra });
const entry = (over = {}) => ({ scope: 'facility', baths: ['A湯'], treatment: { water: [rule('none')], heating: [rule('none')] }, ...over });

test('gensei: certified only when kake, no added water and no heating are all confirmed', () => {
  assert.equal(evaluate(entry(), 'A湯').result, 'certified');
  // いずれかが未確認 -> 認定しない(未判定)
  assert.equal(evaluate(entry({ treatment: { water: [rule('none')] } }), 'A湯').result, 'pending', 'heating unknown');
  assert.equal(evaluate(entry({ treatment: { heating: [rule('none')] } }), 'A湯').result, 'pending', 'water unknown');
  assert.equal(evaluate(entry({ treatment: undefined }), 'A湯').result, 'pending');
  assert.equal(evaluate(entry({ baths: [] }), 'A湯').result, 'pending', 'kake not confirmed for this bath');
  assert.equal(evaluate(null, 'A湯').result, 'pending');
  // いずれかが否定された -> 非該当
  assert.equal(evaluate(entry({ treatment: { water: [rule('yes')], heating: [rule('none')] } }), 'A湯').result, 'excluded');
  assert.equal(evaluate(entry({ treatment: { water: [rule('none')], heating: [rule('yes')] } }), 'A湯').result, 'excluded');
  // 「源泉100%」だけ・消毒の記載は認定に影響しない
  assert.equal(evaluate(entry({ treatment: { water: [rule('none')], heating: [rule('none')], disinfection: [rule('yes')] } }), 'A湯').result, 'certified');
  assert.equal(evaluate(entry({ treatment: { disinfection: [rule('none')] } }), 'A湯').result, 'pending');
});

test('gensei: bath-level and facility-level judgements are not mixed up', () => {
  // 浴槽を指定した規則は、その浴槽だけに効く
  const e = entry({ baths: ['A湯', 'B湯'], treatment: { water: [rule('none')], heating: [rule('none', { scope: 'baths', baths: ['A湯'] })] } });
  assert.equal(evaluate(e, 'A湯').result, 'certified');
  assert.equal(evaluate(e, 'B湯').result, 'pending');
  assert.deepEqual(certifiedBaths(e), ['A湯']);
  // 加水ありの浴槽だけが非該当で、同じ施設の他の浴槽には波及しない
  const f = entry({ baths: ['A湯', 'B湯'], treatment: { water: [rule('yes', { scope: 'baths', baths: ['B湯'] }), rule('none', { scope: 'baths', baths: ['A湯'] })], heating: [rule('none')] } });
  assert.equal(evaluate(f, 'A湯').result, 'certified');
  assert.equal(evaluate(f, 'B湯').result, 'excluded');
  // 浴槽が特定できない施設全体の記述(baths が空)だけでは、金の印を付けない
  const g = entry({ baths: [] });
  assert.deepEqual(certifiedBaths(g), []);
  // 代表的な湯以外でも、浴槽単位の根拠(otherBaths)があれば認定できる
  const h = entry({ baths: [], otherBaths: ['離れの湯'] });
  assert.deepEqual(certifiedBaths(h), ['離れの湯']);
  // 同じ範囲に「あり」と「なし」が両方ある場合は安全側(非該当)
  assert.equal(evaluate(entry({ treatment: { water: [rule('none'), rule('yes')], heating: [rule('none')] } }), 'A湯').result, 'excluded');
});

test('gensei: every treatment rule carries its source, scope and quote; no manual certification list exists', () => {
  const src = fs.readFileSync('kakenagashi.js', 'utf8');
  assert.ok(!/gensei\s*:|certified\s*:/.test(src.replace(/\/\/.*$/gm, '')), 'certification is computed, never listed by hand');
  for (const [id, e] of Object.entries(kake)) {
    for (const kind of ['water', 'heating', 'disinfection']) for (const r of (e.treatment && e.treatment[kind]) || []) {
      assert.ok(['none', 'yes'].includes(r.status), `${id}/${kind}`);
      assert.ok(['all', 'baths'].includes(r.scope), `${id}/${kind}`);
      assert.ok(r.quote && r.quote.length > 10 && r.coverage, `${id}/${kind}: quote and coverage are required`);
      assert.match(r.url, /^https?:\/\//);
      assert.match(r.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
      if (r.scope === 'baths') assert.ok(r.baths.length, id);
      // 規則が名指しする浴槽は、代表的な湯として登録されている
      const names = (feature[id] ? feature[id].baths : []).map(b => b.name);
      for (const n of r.baths || []) assert.ok(names.includes(n), `${id}: ${n}`);
    }
    // 画面に出さない dilution と、規則の内容が食い違わない
    const w = (e.treatment && e.treatment.water) || [];
    if (w.some(r => r.status === 'none' && r.scope === 'all')) assert.ok(['none', 'unknown'].includes(e.dilution.water), id);
    if (w.some(r => r.status === 'yes')) assert.ok(['added', 'for_temperature'].includes(e.dilution.water), `${id}: dilution must record the added water`);
  }
  // 第三者資料だけの施設は、浴槽単位の根拠が無いので認定されない
  for (const [id, e] of Object.entries(kake)) if (e.evidence.type === 'third_party') assert.deepEqual(certifiedBaths(e), [], id);
});

test('gensei: current certification (5 facilities, 13 baths) and the reasons others stay undecided or excluded', () => {
  const certified = Object.fromEntries(Object.entries(kake).map(([id, e]) => [id, certifiedBaths(e)]).filter(([, b]) => b.length));
  assert.deepEqual(certified, {
    'onsen-007': ['白猿の湯', '桂の湯', '白糸の湯'],
    'onsen-009': ['大湯', '滝の湯', '真湯'],
    'onsen-031': ['岩風呂', '檜露天風呂', '混浴内風呂'],
    'onsen-034': ['萱ぶき湯小屋「玉子湯」', '天渓の湯', '瀬音'],
    'onsen-035': ['大気の湯(東・西)']
  });
  // 認定された湯は、必ず源泉かけ流しの湯(深緑の波)でもある
  for (const [id, names] of Object.entries(certified)) for (const n of names) assert.ok(kake[id].baths.includes(n), `${id}/${n}`);
  const result = (id, n) => evaluate(kake[id], n).result;
  // 施設全体の「加水・加温なし」だけで浴槽の記載がない施設は認定しない
  for (const id of ['onsen-017', 'onsen-032']) assert.deepEqual(certifiedBaths(kake[id]), [], id);
  // 湯ごとの「加温なし」の記載が無い、または加水ありの湯は認定しない
  assert.equal(result('onsen-030', 'かわら湯'), 'pending'); // 「加水、加温せず」は源泉全体の記述で、全浴槽とは書かれていない
  assert.equal(result('onsen-012', '混浴露天風呂'), 'pending'); // 加水・循環なしは明記、加温の記載なし
  assert.equal(result('onsen-019', '河原野天風呂'), 'pending'); // 加水なしは明記、加温の記載なし
  assert.equal(result('onsen-019', '大浴場'), 'excluded');
  assert.equal(result('onsen-018', '神経痛の湯'), 'excluded');
  assert.equal(result('onsen-003', '久安の湯'), 'excluded');
  assert.equal(result('onsen-003', '泉響の湯'), 'pending');
});

test('gensei: foot baths and steam baths are never certified, even when all three conditions are confirmed', () => {
  // 名前に足湯・蒸し風呂などを含む浴槽、または nonBathing に載せた浴槽は、3条件が揃っていても対象外(not_applicable)
  for (const name of ['足湯', '〇〇の足湯', '箱蒸し風呂', '箱蒸し湯', '砂湯', 'サウナ']) {
    const e = entry({ baths: [name], otherBaths: [name] });
    assert.equal(evaluate(e, name).result, 'not_applicable', name);
    assert.deepEqual(certifiedBaths(e), [], name);
  }
  const e = entry({ baths: ['A湯', '離れ'], nonBathing: [{ name: '離れ', reason: '入浴用ではない' }] });
  assert.equal(evaluate(e, '離れ').result, 'not_applicable');
  assert.deepEqual(certifiedBaths(e), ['A湯'], 'the other bath of the facility is still certified');
  // 足湯しか該当がない施設には、施設カードの金色の波も付かない
  assert.deepEqual(certifiedBaths(entry({ baths: [], otherBaths: ['足湯'] })), []);
  // 高湯温泉の足湯(公式に「かけ流し／加水なし／加温なし」)は認定対象外として記録されている
  assert.ok(kake['onsen-019'].nonBathing.some(n => n.name === '足湯' && n.reason));
  assert.ok(!kake['onsen-019'].baths.includes('足湯') && !(kake['onsen-019'].otherBaths || []).includes('足湯'));
  assert.deepEqual(certifiedBaths(kake['onsen-019']), []);
  // 代表的な湯に載っている蒸し風呂・足湯は、どの施設でも認定されない
  for (const [id, f] of Object.entries(feature)) for (const b of f.baths) {
    if (b.kind === '蒸し風呂' || /足湯|蒸し/.test(b.name)) assert.ok(!certifiedBaths(kake[id]).includes(b.name), `${id}/${b.name}`);
  }
});

test('gensei: the judgement behind 元湯夏油 and 福島屋 is recorded in the data', () => {
  const rules = id => [...kake[id].treatment.water, ...kake[id].treatment.heating];
  for (const id of ['onsen-007', 'onsen-009', 'onsen-031']) for (const r of rules(id)) assert.ok(r.scopeNote && r.scopeNote.length > 30, `${id}: scopeNote`);
  // 元湯夏油: 3湯はいずれも公式「館内施設」で露天風呂として挙げられている(「全ての露天風呂」に含まれる)
  for (const r of rules('onsen-009')) { assert.deepEqual(r.baths, ['大湯', '滝の湯', '真湯']); assert.match(r.scopeNote, /館内施設/); assert.match(r.scopeNote, /内風呂は/); }
  assert.ok(['大湯', '滝の湯', '真湯'].every(n => feature['onsen-009'].baths.find(b => b.name === n).kind === '露天'));
  // 福島屋: 「全て源泉掛け流し」と「加水･加温・循環消毒は一切行っていません」は同じ段落・同じ「当館のお風呂」
  for (const r of rules('onsen-031')) { assert.match(r.quote, /当館のお風呂は全て源泉掛け流し/); assert.match(r.quote, /加水･加温・循環消毒は一切行っていません/); assert.match(r.scopeNote, /同じ段落/); }
});

test('gensei: Miyagi has no certified bath (Onuma heating is contradictory) and gold waves are never shown without evidence', () => {
  for (const id of ['onsen-024', 'onsen-026', 'onsen-027']) assert.deepEqual(certifiedBaths(kake[id]), [], id);
  assert.equal(evaluate(kake['onsen-026'], '薬湯').result, 'excluded'); // 加温あり(第三者誌)
  // 旅館大沼: 認定書(2020)の加温なしと団体本文の加温ありが矛盾するため、heating の規則を設けない
  assert.equal(kake['onsen-027'].treatment.heating, undefined);
  for (const n of kake['onsen-027'].baths) { const r = evaluate(kake['onsen-027'], n); assert.equal(r.heating, 'unknown', n); assert.equal(r.result, 'pending', n); }
  // 峩々温泉: 施設全体の記述から scope:all を作らない
  assert.equal(kake['onsen-024'].treatment, undefined);
});

test('gensei: Fukushima certifies only 玉子湯 (3) and 大気の湯 (1, third-party scope); other facilities stay undecided', () => {
  const rule = (id, kind) => kake[id].treatment[kind];
  // 玉子湯: 足湯は対象外
  assert.equal(evaluate(kake['onsen-034'], 'のんびり足湯').result, 'not_applicable');
  // 安達屋: 大気の湯の第三者記載に限定。薬師の湯・東の湯・西の湯・大浴場へ広げない
  for (const k of ['water', 'heating']) { assert.equal(rule('onsen-035', k).length, 1); assert.deepEqual(rule('onsen-035', k)[0].baths, ['大気の湯(東・西)']); assert.equal(rule('onsen-035', k)[0].evidenceType, 'third_party_reported'); assert.equal(rule('onsen-035', k)[0].scope, 'baths'); }
  for (const n of ['薬師の湯', '東の湯・西の湯']) assert.equal(evaluate(kake['onsen-035'], n).result, 'pending', n);
  // 野地・柏屋・二階堂・万葉亭は認定しない(加水の食い違い・夏季加水・浴槽単位の情報不足・地域説明)
  for (const id of ['onsen-036', 'onsen-037', 'onsen-038', 'onsen-039']) { assert.deepEqual(certifiedBaths(kake[id]), [], id); assert.equal(kake[id].treatment, undefined, id); }
  // 福島のどの規則にも scope:'all' を機械的に作らない
  for (const id of ['onsen-034', 'onsen-035']) for (const r of [...rule(id, 'water'), ...rule(id, 'heating')]) { assert.equal(r.scope, 'baths', id); assert.ok(r.scopeNote.length > 30, id); }
});

test('gensei: Gunma holds conflicting fill-water evidence and never certifies Mikawaya from overflow or source quality', () => {
  for (const name of ['古式風呂 一乃湯', '古式風呂 二乃湯・三乃湯']) {
    const result = evaluate(kake['onsen-048'], name);
    assert.equal(result.kake, true);
    assert.equal(result.heating, 'none');
    assert.equal(result.water, 'unknown', 'conflicting fill-water reports remain undecided');
    assert.equal(result.result, 'pending');
  }
  assert.equal(evaluate(kake['onsen-048'], '山里乃湯').result, 'excluded', 'summer cooling water precludes certification');
  assert.deepEqual(certifiedBaths(kake['onsen-048']), []);
  assert.equal(evaluate(kake['onsen-048'], '源乃湯の蒸し湯').result, 'not_applicable');
  assert.equal(kake['onsen-053'], undefined, 'overflow when entering a bath does not establish continuous spring flow');
  for (const b of feature['onsen-053'].baths) assert.equal(evaluate(kake['onsen-053'], b.name).result, 'pending');
});
