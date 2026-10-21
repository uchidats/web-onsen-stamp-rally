const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ctx = { btoa: s => Buffer.from(s, 'latin1').toString('base64') };
vm.runInNewContext(fs.readFileSync('stay-search.js', 'utf8'), Object.assign(ctx, { globalThis: ctx }));
const S = ctx.OnsenStaySearch;
const mem = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), keys: () => [...m.keys()] }; };
const NOW = new Date(2026, 9, 21, 12);

test('defaults are 1 night, 1 adult, 1 room, no date', () => {
  assert.deepEqual({ ...S.load(mem()) }, { checkIn: '', nights: 1, adults: 1, rooms: 1 });
});
test('save then load round-trips in the stay key only; rooms stay 1', () => {
  const s = mem();
  const r = S.save(s, { checkIn: '2026-12-05', nights: 2, adults: 1, rooms: 5 }, NOW);
  assert.equal(r.ok, true);
  assert.deepEqual(s.keys(), ['onsen-rally-stay-search-v1']);
  assert.deepEqual({ ...S.load(s) }, { checkIn: '2026-12-05', nights: 2, adults: 1, rooms: 1 });
});
test('rejects empty, invalid and past dates without writing', () => {
  for (const checkIn of ['', '2026-02-30', 'abc', '2026-10-20']) {
    const s = mem();
    assert.equal(S.save(s, { checkIn, nights: 1, adults: 1 }, NOW).ok, false, checkIn);
    assert.deepEqual(s.keys(), []);
  }
  assert.equal(S.save(mem(), { checkIn: '2026-10-21', nights: 1, adults: 1 }, NOW).ok, true, 'today is allowed');
});
test('corrupt or out-of-range stored values fall back to defaults', () => {
  const s = mem(); s.setItem(S.KEY, '{broken');
  assert.deepEqual({ ...S.load(s) }, { checkIn: '', nights: 1, adults: 1, rooms: 1 });
  s.setItem(S.KEY, JSON.stringify({ checkIn: '2026-12-05', nights: 99, adults: 0, rooms: 3, extra: 'x' }));
  assert.deepEqual({ ...S.load(s) }, { checkIn: '2026-12-05', nights: 1, adults: 1, rooms: 1 });
  assert.deepEqual({ ...S.load({ getItem() { throw Error('blocked'); } }) }, { checkIn: '', nights: 1, adults: 1, rooms: 1 });
});
// ts を読み戻す(Googleが出力する構造): 08 01 | 12{(0a 02 08 03)×大人, 10 01} | 1a{12{12{0a{in}12{out}}...}}
function decode(ts) {
  const b = [...Buffer.from(ts, 'base64')];
  assert.deepEqual(b.slice(0, 2), [0x08, 0x01]);
  assert.equal(b[2], 0x12);
  const glen = b[3], g = b.slice(4, 4 + glen);
  let adults = 0, i = 0;
  while (g[i] === 0x0a) { assert.deepEqual(g.slice(i, i + 4), [0x0a, 0x02, 0x08, 0x03]); adults++; i += 4; }
  assert.deepEqual(g.slice(i), [0x10, 0x01]);
  const rd = (arr, at) => { let n = 0, sh = 0, p = at; for (;;) { const x = arr[p++]; n += (x & 127) * 2 ** sh; sh += 7; if (x < 128) break; } return [n, p]; };
  const date = (arr, at) => { const [y, p1] = rd(arr, at + 1), [m, p2] = rd(arr, p1 + 1), [d, p3] = rd(arr, p2 + 1); return [[y, m, d], p3]; };
  const rest = b.slice(4 + glen);
  assert.equal(rest[0], 0x1a);
  const body = rest.slice(2); // 12 L 12 L2 0a ...
  assert.deepEqual([body[0], body[2]], [0x12, 0x12]);
  const r = body.slice(4);
  assert.equal(r[0], 0x0a);
  const [din, p] = date(r, 2);
  assert.equal(r[p], 0x12);
  const [dout] = date(r, p + 2);
  return { adults, checkIn: din, checkOut: dout };
}
test('Google ts encoder reproduces the value Google itself produced for 1 adult, 2026-12-05..06', () => {
  assert.equal(S.googleTs('2026-12-05', 1, 1), 'CAESBgoCCAMQARoaEhgSEgoHCOoPEAwYBRIHCOoPEAwYBjICCAAqCQoFOgNKUFkaAA');
});
test('ts carries adults 1 and 3, multiple nights and a year rollover; out-of-range values fall back safely', () => {
  assert.deepEqual(decode(S.googleTs('2026-12-05', 1, 1)), { adults: 1, checkIn: [2026, 12, 5], checkOut: [2026, 12, 6] });
  assert.deepEqual(decode(S.googleTs('2026-12-05', 1, 3)), { adults: 3, checkIn: [2026, 12, 5], checkOut: [2026, 12, 6] });
  assert.deepEqual(decode(S.googleTs('2026-12-31', 2, 1)), { adults: 1, checkIn: [2026, 12, 31], checkOut: [2027, 1, 2] });
  assert.deepEqual(decode(S.googleTs('2028-02-28', 3, 2)), { adults: 2, checkIn: [2028, 2, 28], checkOut: [2028, 3, 2] }, 'leap year');
  assert.deepEqual(decode(S.googleTs('2026-12-05', 99, 0)), { adults: 1, checkIn: [2026, 12, 5], checkOut: [2026, 12, 6] }, 'invalid nights/adults use the defaults');
  assert.equal(S.googleTs('bad', 1, 1), '');
});
test('Google link uses the facility name only (prefecture/lodging words turn it into an area search), only for verified facilities', () => {
  assert.ok(S.GOOGLE_VERIFIED_IDS.length > 0);
  const id = S.GOOGLE_VERIFIED_IDS[0], f = { id, facility: '酸ヶ湯温泉旅館', prefecture: '青森県' };
  const u = new URL(S.googleHotelsUrl(f, { checkIn: '2026-12-31', nights: 2, adults: 3 }, NOW));
  assert.equal(u.origin + u.pathname, 'https://www.google.com/travel/search');
  assert.equal(u.searchParams.get('q'), '酸ヶ湯温泉旅館');
  assert.deepEqual(decode(u.searchParams.get('ts')), { adults: 3, checkIn: [2026, 12, 31], checkOut: [2027, 1, 2] });
  assert.equal(S.googleHotelsUrl({ ...f, id: 'onsen-unverified' }, { checkIn: '2026-12-31', nights: 1, adults: 1 }, NOW), null);
  assert.equal(S.googleHotelsUrl(f, { checkIn: '', nights: 1 }, NOW), null);
  assert.equal(S.googleHotelsUrl(f, { checkIn: '2026-10-01', nights: 1 }, NOW), null);
});
test('verified Google facility ids exist in the master data, are unique and exclude day-only facilities', () => {
  const dctx = {}; vm.runInNewContext(fs.readFileSync('data.js', 'utf8'), Object.assign(dctx, { window: dctx }));
  const ids = new Map(dctx.ONSEN_DATA.map(x => [x.id, x]));
  assert.equal(new Set(S.GOOGLE_VERIFIED_IDS).size, S.GOOGLE_VERIFIED_IDS.length);
  for (const id of S.GOOGLE_VERIFIED_IDS) { assert.ok(ids.has(id), id); assert.notEqual(ids.get(id).category, '日帰り旅名湯', id); }
});
test('query overrides: only for verified facilities, never add a prefecture or lodging word, and are used in the link', () => {
  for (const [id, q] of Object.entries(S.GOOGLE_QUERY_OVERRIDES)) {
    assert.ok(S.googleVerified(id), id);
    assert.ok(!/県|都|道|府|宿泊/.test(q.replace(/北海道/g, '')), id + ' ' + q);
  }
  const f = { id: 'onsen-008', facility: '山水閣' };
  const u = new URL(S.googleHotelsUrl(f, { checkIn: '2026-12-05', nights: 1, adults: 1 }, NOW));
  assert.equal(u.searchParams.get('q'), '大沢温泉 山水閣');
  assert.equal(S.googleVerified('onsen-015'), false, 'tsuru-no-yu resolves to another hotel on phones');
  assert.equal(S.googleVerified('onsen-005'), false);
});
test('stay-search.js never touches visit records, sync or Firebase', () => {
  const src = fs.readFileSync('stay-search.js', 'utf8').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/firebase|OnsenRecords|OnsenSync|onsen-rally-v3|userData|visits|fetch\(|XMLHttp|sendBeacon/i.test(src));
});
