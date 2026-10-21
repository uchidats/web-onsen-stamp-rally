// 宿泊の検索条件(チェックイン日・泊数・大人人数)を端末のlocalStorageにだけ保存し、施設詳細の料金確認リンクへ反映する。
// ・訪問記録・メモ・クラウド同期(records.js / sync*.js)には触れない。専用キーは onsen-rally-stay-search-v1 の1つだけ。
// ・Firestore・バックアップJSONには含めない(この端末だけの設定)。
// ・料金の自動取得はしない。リンクを開くだけ。
// ・Google ホテルの ts= は非公式のURLパラメータ(2026-10-21にPC・Android相当で日付・泊数・大人人数の引き継ぎを確認)。
//   仕様変更で効かなくなる可能性がある。Google Mapsアプリ・Googleアプリ経由での挙動は未確認。
(function (root) {
  'use strict';
  const KEY = 'onsen-rally-stay-search-v1';
  const DEFAULTS = Object.freeze({ checkIn: '', nights: 1, adults: 1, rooms: 1 });
  const MAX_NIGHTS = 14, MAX_ADULTS = 6;

  const parseDate = s => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof s === 'string' ? s : '');
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3], t = new Date(Date.UTC(y, mo - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d && y >= 2000 && y <= 2100 ? { y, mo, d } : null;
  };
  const addDays = (p, n) => { const t = new Date(Date.UTC(p.y, p.mo - 1, p.d + n)); return { y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate() }; };
  const iso = p => p.y + '-' + String(p.mo).padStart(2, '0') + '-' + String(p.d).padStart(2, '0');
  const todayLocal = (now = new Date()) => iso({ y: now.getFullYear(), mo: now.getMonth() + 1, d: now.getDate() });
  const intIn = (v, lo, hi, fallback) => Number.isInteger(v) && v >= lo && v <= hi ? v : fallback;

  // 保存値を検証して返す。壊れた値・未知の項目は初期値に戻す(例外は出さない)。
  function normalize(raw) {
    const o = raw && typeof raw === 'object' ? raw : {};
    return { checkIn: parseDate(o.checkIn) ? o.checkIn : DEFAULTS.checkIn, nights: intIn(o.nights, 1, MAX_NIGHTS, DEFAULTS.nights), adults: intIn(o.adults, 1, MAX_ADULTS, DEFAULTS.adults), rooms: 1 };
  }
  function load(storage) {
    try { const text = storage.getItem(KEY); return normalize(text ? JSON.parse(text) : null); } catch { return { ...DEFAULTS }; }
  }
  // 日付が空、または過去なら保存しない。保存できたら true。
  function save(storage, cond, now) {
    const c = normalize(cond);
    if (!c.checkIn) return { ok: false, error: 'チェックイン日を入力してください' };
    if (c.checkIn < todayLocal(now)) return { ok: false, error: '過去の日付は保存できません' };
    try { storage.setItem(KEY, JSON.stringify({ v: 1, ...c })); } catch { return { ok: false, error: 'この端末に保存できませんでした' }; }
    return { ok: true, cond: c };
  }

  const varint = n => { const o = []; while (n > 127) { o.push((n & 127) | 128); n = Math.floor(n / 128); } o.push(n); return o; };
  const dateMsg = p => [0x08, ...varint(p.y), 0x10, ...varint(p.mo), 0x18, ...varint(p.d)];
  // Google ホテルの ts パラメータ(チェックイン・チェックアウト日・大人の人数)。Googleが自分で出力する値と同じ構造:
  // 08 01 | 12{ (0a 02 08 03)×大人の人数, 10 01 } | 1a{ 12{ 12{ 0a{in} 12{out} } 32 02 08 00 } } | 2a 09 0a 05 3a 03 'JPY' 1a 00
  function googleTs(checkIn, nights, adults) {
    const a = parseDate(checkIn);
    if (!a) return '';
    const n = intIn(adults, 1, MAX_ADULTS, DEFAULTS.adults);
    const b = addDays(a, intIn(nights, 1, MAX_NIGHTS, DEFAULTS.nights)), am = dateMsg(a), bm = dateMsg(b);
    const guests = [];
    for (let i = 0; i < n; i++) guests.push(0x0a, 0x02, 0x08, 0x03);
    guests.push(0x10, 0x01);
    const range = [0x0a, am.length, ...am, 0x12, bm.length, ...bm];
    const inner = [0x12, range.length, ...range, 0x32, 0x02, 0x08, 0x00];
    const wrap = [0x12, inner.length, ...inner];
    const bytes = [0x08, 0x01, 0x12, guests.length, ...guests, 0x1a, wrap.length, ...wrap, 0x2a, 0x09, 0x0a, 0x05, 0x3a, 0x03, 0x4a, 0x50, 0x59, 0x1a, 0x00];
    return btoa(String.fromCharCode(...bytes)).replace(/=+$/, '');
  }
  // Googleで「施設の料金比較ページ」が開くと実際に確認できた施設ID(確認日は VERIFIED_AT)。確認の条件:
  //  ・PC(Edge)とAndroid相当(Pixel 8のChrome表示)の両方で、検索結果の先頭が目的の施設である
  //  ・PCで開いた施設の住所が、登録の都道府県と一致する
  // 検索語は原則「施設名だけ」。都道府県や「宿泊」を足すと施設ではなく地域の検索結果になることがある。
  // 施設名だけでは別の施設・地域が開く施設は、温泉名や市町村を足した検索語で再確認できたものだけを OVERRIDES に入れる。
  // 確認できない施設(地域の検索結果になる・Googleに掲載がない・PCとスマホで結果が違う)にはリンクを出さない。
  const VERIFIED_AT = '2026-10-21';
  const GOOGLE_VERIFIED_IDS = Object.freeze([
    'onsen-001', 'onsen-002', 'onsen-003', 'onsen-004', 'onsen-006', 'onsen-007',
    'onsen-008', 'onsen-009', 'onsen-012', 'onsen-013', 'onsen-014', 'onsen-016',
    'onsen-017', 'onsen-018', 'onsen-019', 'onsen-020', 'onsen-021', 'onsen-023',
    'onsen-024', 'onsen-025', 'onsen-026', 'onsen-027', 'onsen-028', 'onsen-030', 'onsen-031', 'onsen-032', 'onsen-033', 'onsen-034', 'onsen-035',
    'onsen-036', 'onsen-037', 'onsen-038', 'onsen-039', 'onsen-040', 'onsen-041',
    'onsen-042', 'onsen-043', 'onsen-045', 'onsen-046', 'onsen-047', 'onsen-048',
    'onsen-049', 'onsen-050', 'onsen-052', 'onsen-054', 'onsen-055', 'onsen-056',
    'onsen-057', 'onsen-058', 'onsen-059', 'onsen-060', 'onsen-061', 'onsen-062',
    'onsen-063', 'onsen-064', 'onsen-065', 'onsen-066', 'onsen-067'
  ]);
  const GOOGLE_QUERY_OVERRIDES = Object.freeze({
    'onsen-006': '松川温泉 峡雲荘',
    'onsen-007': '藤三旅館 花巻',
    'onsen-008': '大沢温泉 山水閣',
    'onsen-012': '藤七温泉 彩雲荘',
    'onsen-014': '玉川温泉 秋田',
    'onsen-025': '青根温泉 岡崎旅館',
    'onsen-028': '白布温泉 東屋',
    'onsen-031': '滑川温泉 福島屋',
    'onsen-033': '新高湯温泉 吾妻屋',
    'onsen-037': '二岐温泉 柏屋旅館',
    'onsen-045': '板室温泉 大黒屋',
    'onsen-050': '草津温泉 大阪屋旅館',
    'onsen-054': '高峰温泉 ランプの宿高峰温泉',
    'onsen-056': '奈良屋旅館 野沢温泉村',
    'onsen-059': '毒沢鉱泉 神乃湯'
  });
  const googleVerified = id => GOOGLE_VERIFIED_IDS.includes(id);
  // 保存済みの条件(有効なもの)から Google ホテルのリンクを作る。条件や施設が対象外なら null。
  function googleHotelsUrl(facility, cond, now) {
    const c = normalize(cond);
    if (!facility || !googleVerified(facility.id) || !c.checkIn || c.checkIn < todayLocal(now)) return null;
    return 'https://www.google.com/travel/search?q=' + encodeURIComponent(GOOGLE_QUERY_OVERRIDES[facility.id] || facility.facility) + '&hl=ja&gl=jp&ts=' + googleTs(c.checkIn, c.nights, c.adults);
  }

  root.OnsenStaySearch = { KEY, GOOGLE_VERIFIED_IDS, GOOGLE_QUERY_OVERRIDES, googleVerified, DEFAULTS, MAX_NIGHTS, MAX_ADULTS, normalize, load, save, googleTs, googleHotelsUrl, todayLocal, addDays, parseDate, iso };
})(typeof window !== 'undefined' ? window : globalThis);
