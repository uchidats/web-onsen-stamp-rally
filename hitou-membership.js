// 「秘♨」ラベル(日本秘湯を守る会 加盟宿)の公開データ。施設ID(data.js の id)をキーにし、加盟が確認できた施設だけを載せる。
// 載っていない施設(非加盟・休会・未確定を含む)にはラベルを出さない。「載っていない=非加盟」という意味ではない。
// 表示に訪問記録や端末の保存データは使わない。公式ロゴ画像は使わず、文字の「秘♨」だけを使う。
//   officialName   団体の現行会員一覧での宿名(data.js の施設名と表記が違う場合がある。名寄せは所在地・電話で確認済み)
//   url            ラベルのリンク先。団体(nihon-hitou.org)の公式の加盟宿詳細ページ。クリック・タップで開く
//   checkedAt      加盟を確認した日(一覧・ページの更新日ではない)
//   reservationUrl 任意。秘湯Web(予約サービス)の宿詳細。管理用で画面には出さない
//   note           任意。同定・誤認防止のための管理用メモ(画面には出さない)
// 根拠: 団体の会員一覧(https://nihon-hitou.org/member)と秘湯Web会員宿一覧(https://www.hitou.or.jp/provider/list)の両方に同じ施設が掲載されていること、
//        所在地・電話の照合。営業中・宿泊可・予約受付を保証するものではない(石塚旅館の宿泊営業休止は加盟休会ではない)。
// 白布温泉の東屋(onsen-028)は2025年3月12日付で退会しているため載せない。新高湯温泉の吾妻屋(onsen-033)は別施設で加盟。
window.ONSEN_HITOU_MEMBERSHIP = {
  'onsen-001': { officialName: '知内温泉旅館', url: 'https://nihon-hitou.org/member/1541', checkedAt: '2026-10-19', reservationUrl: 'https://www.hitou.or.jp/provider/645' },
  'onsen-006': { officialName: '峡雲荘', url: 'https://nihon-hitou.org/member/1433', checkedAt: '2026-10-19', reservationUrl: 'https://www.hitou.or.jp/provider/649' },
  'onsen-009': { officialName: '元湯夏油', url: 'https://nihon-hitou.org/member/1428', checkedAt: '2026-10-19', reservationUrl: 'https://www.hitou.or.jp/provider/650' },
  'onsen-010': { officialName: '石塚旅館', url: 'https://nihon-hitou.org/member/1447', checkedAt: '2026-10-19', note: '団体の2025年宿泊営業休止告知と現行一覧の日帰り利用案内を記録。宿泊営業休止は休会・加盟停止ではない' },
  'onsen-012': { officialName: '彩雲荘', url: 'https://nihon-hitou.org/member/1440', checkedAt: '2026-10-19', reservationUrl: 'https://www.hitou.or.jp/provider/653' },
  'onsen-015': { officialName: '鶴の湯温泉', url: 'https://nihon-hitou.org/member/1499', checkedAt: '2026-10-19', reservationUrl: 'https://www.hitou.or.jp/provider/598', note: '同一覧の鶴の湯別館 山の宿は別項目。本結果は鶴の湯温泉の登録施設のみ' },
  'onsen-017': { officialName: '元湯 雄山閣', url: 'https://nihon-hitou.org/member/1453', checkedAt: '2026-10-19', reservationUrl: 'https://www.hitou.or.jp/provider/592' },
  'onsen-019': { officialName: '鷹の湯温泉', url: 'https://nihon-hitou.org/member/1526', checkedAt: '2026-10-19', reservationUrl: 'https://www.hitou.or.jp/provider/597' },
  'onsen-020': { officialName: 'ふけの湯', url: 'https://nihon-hitou.org/member/1485', checkedAt: '2026-10-19', reservationUrl: 'https://www.hitou.or.jp/provider/590', note: '公開名「蒸ノ湯温泉」と公式一覧「ふけの湯」は源泉・秘湯の宿ふけの湯の住所・電話で照合' },
  'onsen-021': { officialName: '奥山旅館', url: 'https://nihon-hitou.org/member/1471', checkedAt: '2026-10-19', reservationUrl: 'https://www.hitou.or.jp/provider/593' },
  'onsen-024': { officialName: '峩々温泉', url: 'https://nihon-hitou.org/member/1413', checkedAt: '2026-10-19', reservationUrl: 'https://www.hitou.or.jp/provider/667' },
  'onsen-027': { officialName: '百年ゆ宿 旅館大沼', url: 'https://nihon-hitou.org/member/1382', checkedAt: '2026-10-19', reservationUrl: 'https://www.hitou.or.jp/provider/669' },
  'onsen-030': { officialName: '湯宿 元河原湯', url: 'https://nihon-hitou.org/member/1353', checkedAt: '2026-10-19', reservationUrl: 'https://www.hitou.or.jp/provider/748' },
  'onsen-031': { officialName: '福島屋', url: 'https://nihon-hitou.org/member/1335', checkedAt: '2026-10-19', reservationUrl: 'https://www.hitou.or.jp/provider/739' },
  'onsen-032': { officialName: '桝形屋', url: 'https://nihon-hitou.org/member/1329', checkedAt: '2026-10-19', reservationUrl: 'https://www.hitou.or.jp/provider/742' },
  'onsen-033': { officialName: '奥白布 吾妻屋旅館', url: 'https://nihon-hitou.org/member/1344', checkedAt: '2026-10-19', reservationUrl: 'https://www.hitou.or.jp/provider/736', note: '新高湯・山形県米沢市の吾妻屋。高湯・福島県の吾妻屋の退会告知は適用しない。施設公式と一覧で住所表記差があるが電話0238-55-2031・温泉地・予約リンクが一致' },
  'onsen-038': { officialName: '旅館二階堂', url: 'https://nihon-hitou.org/member/1244', checkedAt: '2026-10-19', note: '公開マスターに施設公式URLなし。両会員一覧・団体の施設別ページで同名・所在地・ぬる湯を確認' },
  'onsen-039': { officialName: '大人の旅籠 御宿万葉亭', url: 'https://nihon-hitou.org/member/1248', checkedAt: '2026-10-19', reservationUrl: 'https://www.hitou.or.jp/provider/611' },
  'onsen-042': { officialName: '八丁湯', url: 'https://nihon-hitou.org/member/879', checkedAt: '2026-10-19', reservationUrl: 'https://www.hitou.or.jp/provider/721', note: '八丁湯／八丁の湯の表記差。日光市川俣876の住所が一致。近隣の加仁湯（川俣871）とは別 / 団体一覧「八丁湯」／予約一覧「八丁の湯」。同じ住所の表記差として保存' },
  'onsen-047': { officialName: '法師温泉長寿館', url: 'https://nihon-hitou.org/member/855', checkedAt: '2026-10-19', reservationUrl: 'https://www.hitou.or.jp/provider/626', note: '公開名は長寿館、公式一覧は法師温泉長寿館。みなかみ町永井650で照合' },
  'onsen-054': { officialName: 'ランプの宿 高峰温泉', url: 'https://nihon-hitou.org/member/1031', checkedAt: '2026-10-19', reservationUrl: 'https://www.hitou.or.jp/provider/704', note: 'ランプの宿高峰温泉／ランプの宿 高峰温泉は空白差。小諸市高峰高原・電話で照合' },
  'onsen-059': { officialName: '神乃湯', url: 'https://nihon-hitou.org/member/939', checkedAt: '2026-10-19', reservationUrl: 'https://www.hitou.or.jp/provider/684', note: '神乃湯／神の湯の表記差。下諏訪町社7083・電話0266-27-5526が一致。郵便番号393-0091と393-0000は資料差として保存 / 団体一覧「神乃湯」／予約一覧「神の湯」。同じ住所の表記差として保存' },
  'onsen-061': { officialName: '自在館', url: 'https://nihon-hitou.org/member/1112', checkedAt: '2026-10-19', reservationUrl: 'https://www.hitou.or.jp/provider/709' },
  'onsen-062': { officialName: '貝掛温泉', url: 'https://nihon-hitou.org/member/1106', checkedAt: '2026-10-19', reservationUrl: 'https://www.hitou.or.jp/provider/681' },
  'onsen-064': { officialName: '嵐渓荘', url: 'https://nihon-hitou.org/member/1126', checkedAt: '2026-10-19', reservationUrl: 'https://www.hitou.or.jp/provider/694' },
  'onsen-066': { officialName: '室堂平 みくりが池温泉', url: 'https://nihon-hitou.org/member/630', checkedAt: '2026-10-19', reservationUrl: 'https://www.hitou.or.jp/provider/725', note: '室堂平 みくりが池温泉は修飾語追加。施設の季節営業・休館と加盟休会は別判定' }
};
