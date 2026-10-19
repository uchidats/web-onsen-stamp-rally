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

test('kakenagashi: the card icon facilities are exactly the confirmed ones (50); unconfirmed facilities get none', () => {
  assert.deepEqual(Object.keys(kake).sort(), [
    'onsen-003', 'onsen-004', 'onsen-005', 'onsen-006', 'onsen-007', 'onsen-008', 'onsen-009', 'onsen-010', 'onsen-011', 'onsen-012',
    'onsen-015', 'onsen-016', 'onsen-017', 'onsen-018', 'onsen-019', 'onsen-020', 'onsen-021', 'onsen-023', 'onsen-024', 'onsen-026', 'onsen-027',
    'onsen-028', 'onsen-029', 'onsen-030', 'onsen-031', 'onsen-032', 'onsen-033',
    'onsen-034', 'onsen-035', 'onsen-036', 'onsen-037', 'onsen-038', 'onsen-039', 'onsen-040', 'onsen-041', 'onsen-042', 'onsen-043', 'onsen-044', 'onsen-045', 'onsen-048', 'onsen-054', 'onsen-055', 'onsen-056', 'onsen-057', 'onsen-058', 'onsen-060', 'onsen-061', 'onsen-065', 'onsen-066', 'onsen-067'
  ]);
  // 酸ヶ湯・新玉川・玉川・川原毛は、かけ流しを明記した資料を確認できていない
  for (const id of ['onsen-002', 'onsen-013', 'onsen-014', 'onsen-022']) assert.equal(kake[id], undefined, id);
  // 一部の浴槽だけの施設は施設全体と断定しない(partial)
  for (const id of ['onsen-004', 'onsen-008', 'onsen-011', 'onsen-019', 'onsen-023', 'onsen-024', 'onsen-026', 'onsen-027', 'onsen-035', 'onsen-060', 'onsen-061', 'onsen-054', 'onsen-055', 'onsen-057', 'onsen-058', 'onsen-065', 'onsen-066', 'onsen-067']) assert.equal(kake[id].scope, 'partial', id);
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
  assert.equal(n, 85);
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

test('kakenagashi: Tochigi 6 facilities, 13 bath-level waves, each with the scope recorded', () => {
  assert.deepEqual(kake['onsen-040'].baths, ['川岸露天風呂(混浴)', '女性専用川岸露天風呂', 'やすらぎの湯・太古の湯']);
  assert.deepEqual(kake['onsen-041'].baths, ['第三露天風呂', '第一露天風呂', '利き湯 ロマンの湯']);
  assert.match(kake['onsen-041'].evidence.note, /客室ユニットバス/);
  assert.deepEqual(kake['onsen-042'].baths, ['雪見の湯', '滝見の湯', '石楠花の湯']);
  // 元泉館: 渓流露天の高尾の湯だけ。邯鄲の湯・宝の湯は施設全体の記述から広げない
  assert.deepEqual(kake['onsen-043'].baths, ['高尾の湯(渓流露天風呂)']);
  assert.equal(kake['onsen-043'].scope, 'partial');
  // 鹿の湯: 団体文章は「かけ流し」が男湯・女湯のどの浴槽群かを明示していないため施設カードだけ(浴槽別の波なし)
  assert.deepEqual(kake['onsen-044'].baths, []);
  assert.equal(kake['onsen-044'].evidence.type, 'third_party');
  assert.equal(kake['onsen-044'].evidence.confidence, 'third_party_reported');
  assert.ok(!('perBathEvidence' in kake['onsen-044']));
  // 大黒屋: 本館の3浴場に限定
  assert.deepEqual(kake['onsen-045'].baths, ['露天の湯', 'たいようの湯', 'ひのきの湯']);
  assert.match(kake['onsen-045'].evidence.note, /本館の3浴場以外には広げない/);
  let n = 0;
  for (const id of ['onsen-040', 'onsen-041', 'onsen-042', 'onsen-043', 'onsen-044', 'onsen-045']) n += kake[id].baths.length;
  assert.equal(n, 13);
});

const GENSEI = (() => { const sb = { window: {} }; vm.runInNewContext(fs.readFileSync('kakenagashi.js', 'utf8'), sb); return sb.window.ONSEN_GENSEI; })();

test('kakenagashi: Niigata has 6 bath groups (Chitose 3, Jizaikan 3); Kaikake, Haginoya and Rankeiso get no wave', () => {
  assert.deepEqual(kake['onsen-060'].baths, ['月見の湯', 'ほんやらの湯（露天）', '山の湯・里の湯']);
  assert.deepEqual(kake['onsen-061'].baths, ['したの湯', 'うえの湯', 'おくの湯']);
  for (const id of ['onsen-062', 'onsen-063', 'onsen-064']) assert.equal(kake[id], undefined, id);
  // ちとせは全浴槽に加水があるため源生の湯にしない。自在館は冬季加温の併存と無加水の未確認で保留
  for (const id of ['onsen-060', 'onsen-061']) {
    assert.equal(GENSEI.certifiedBaths(kake[id]).length, 0, id);
    for (const b of kake[id].baths) assert.notEqual(GENSEI.evaluate(kake[id], b).result, 'certified', b);
  }
  assert.equal(GENSEI.evaluate(kake['onsen-060'], '月見の湯').water, 'yes');
  assert.equal(GENSEI.evaluate(kake['onsen-061'], 'したの湯').heating, 'unknown');
});

test('kakenagashi: Nagano has 9 bath-level waves (Nakadanaso 3, Naraya 2, Saito 3, Nanakusa guest-room 1); Takamine is card-only; Kamino-yu has no wave', () => {
  assert.deepEqual(kake['onsen-055'].baths, ['大浴場（内湯）', '大浴場（露天風呂）', '源泉かけ流し貸切風呂']);
  assert.deepEqual(kake['onsen-056'].baths, ['男女別内湯', '露天風呂']);
  assert.deepEqual(kake['onsen-057'].baths, ['湯元館（龍神の湯・薬師の湯）', '鬼ケ城 野天風呂', '仙人の湯']);
  assert.deepEqual(kake['onsen-058'].baths, ['客室露天風呂（朝霧草・小町草）']);
  // 高峰: 冷泉槽だけの部分候補で加熱槽には循環併用があるため、浴場群の波は付けず施設カードだけ
  assert.deepEqual(kake['onsen-054'].baths, []);
  assert.equal(kake['onsen-054'].evidence.type, 'official_text');
  // 神乃湯: 冷鉱泉槽のかけ流しは個人記事のみで、施設公式で浴槽別の現行運用を確認できるまで施設カードにも個別にも波を付けない
  assert.equal(kake['onsen-059'], undefined);
  // 源生の湯は新規認定なし。齋藤は公式の加温あり(非該当)、奈良屋・中棚・七草は未判定
  for (const id of ['onsen-054', 'onsen-055', 'onsen-056', 'onsen-057', 'onsen-058']) assert.equal(GENSEI.certifiedBaths(kake[id]).length, 0, id);
  for (const b of kake['onsen-057'].baths) assert.equal(GENSEI.evaluate(kake['onsen-057'], b).result, 'excluded', b);
  for (const id of ['onsen-055', 'onsen-056', 'onsen-058']) for (const b of kake[id].baths) assert.equal(GENSEI.evaluate(kake[id], b).result, 'pending', b);
  assert.equal(kake['onsen-056'].treatment, undefined); // 季節加水の浴槽別範囲が不明なため規則を作らない
  assert.equal(GENSEI.evaluate(kake['onsen-058'], 'サウナ').result, 'not_applicable');
});

test('kakenagashi: Toyama has 3 card waves and 3 bath-level waves (Mikurigaike 1, Ogawa cave + main bath); Oomaki and Rengenoyu get no bath wave', () => {
  assert.deepEqual(kake['onsen-065'].baths, []); // 施設総論のみ。個別3群へ広げない
  assert.deepEqual(kake['onsen-066'].baths, ['男女別の展望内湯']);
  assert.deepEqual(kake['onsen-067'].baths, ['天然洞窟野天風呂', '大浴場']);
  assert.ok(!kake['onsen-067'].baths.includes('蓮華の湯'));
  for (const id of ['onsen-065', 'onsen-066', 'onsen-067']) assert.equal(kake[id].evidence.type, 'official_text', id);
  // 源生の湯: みくりが池の展望内湯だけを既存の自動判定で認定。小川は加水の公式矛盾のため規則を作らない
  assert.deepEqual(Array.from(GENSEI.certifiedBaths(kake['onsen-066'])), ['男女別の展望内湯']);
  assert.equal(kake['onsen-066'].treatment.water[0].status, 'none');
  assert.equal(kake['onsen-066'].treatment.heating[0].status, 'none');
  assert.equal(kake['onsen-067'].treatment, undefined);
  assert.match(kake['onsen-067'].dilution.note, /矛盾/);
  for (const id of ['onsen-065', 'onsen-067']) assert.equal(GENSEI.certifiedBaths(kake[id]).length, 0, id);
  for (const b of kake['onsen-067'].baths) assert.equal(GENSEI.evaluate(kake['onsen-067'], b).result, 'pending', b);
});
