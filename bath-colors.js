// 湯の色の丸(◯)用の公開データ。施設カード(施設名の右)と詳細画面「代表的な湯」(湯名の右)の両方がこのファイルだけを参照する。
// 表示にlocalStorage・訪問記録は使わない。
//
// ONSEN_COLOR_DEFS: 色の分類(id)ごとの共通定義。label=正式な色名(ツールチップ・読み上げに使う)、
//   fill/ring=丸の表示用の近似色(CSSカラーコード。実際の湯の色そのものではない)、hollow=true は中抜きの丸(無色透明)。
// ONSEN_BATH_COLORS: 施設ID(data.js の id)をキーにした湯色データ。根拠が十分な色だけを載せる(未登録の施設は丸を出さない)。
//   colors[] は施設カードに左から順に並ぶ丸(同じ色は重複表示しない・最大3個)。並びは資料の記載順で、色の変化の順序や頻度を意味しない。
//   1つの色の項目:
//     color       色の分類(ONSEN_COLOR_DEFS のid)       expression 資料での色の表現(原文の語)
//     scope       'facility'=施設全体について書かれた色 / 'bath'=特定の浴槽について書かれた色(scopeNames に浴槽名)
//                 ・カードには scope に関わらず登録された色が並ぶ。詳細画面の湯名の右には、scope:'bath' で scopeNames にその湯が
//                   含まれる色だけが出る(施設全体の色を個々の湯へ自動適用しない)。
//     scopeLabel  任意。scope:'facility' の色が施設の一部(浴場の一つの槽など)についての記載のとき、ツールチップの「(施設全体)」の代わりに出す適用範囲の語。
//                 施設カードだけに出る(詳細画面の湯名には出ない)。部分範囲を個別の湯の丸で表せないときに使う。
//     evidence    根拠。{ type: 'official_text'(公式文章)|'official_photo'(公式サイト・パンフレットの浴槽写真)|'third_party'(日本秘湯を守る会・
//                 観光協会・専門誌などの第三者資料), confidence: 'confirmed'(確認済み)|'photo_inferred'(写真からの推定)|'third_party_reported'(第三者資料の記載),
//                 note }  省略時は official_text / confirmed。
//                 ・写真の場合は必ず confidence:'photo_inferred' とし、浴槽の底・照明・撮影条件の色を湯色と混同していないことを note に書く。
//                 ・confirmed 以外はツールチップに「写真からの推定」「第三者資料の記載」と明記される。
//     change      色が変化する場合の説明。{ kind: 'tint'(色味)|'rare'(まれ)|'seasonal'(季節・気温), note: 説明文 }
//     role        'base'(基本の色)|'variant'(変化して現れる色)。変化する色が複数確認されている場合に区別する。省略可。
//     listed      true=資料が複数の色を列挙している(丸の並びは資料の記載順)。
//     source      管理用(資料のURLと確認日。画面には出さない。項目に無ければ施設の source を使う)
// ルール: 源泉の色(玉川温泉の「無色透明」など)を浴槽・施設の色として載せない。泉質から色を推測しない。
//         施設全体の色を個別の浴槽へ、個別の浴槽の色を施設全体へ、広げない。異なる浴槽の色を混同しない。根拠が不十分な色は載せない。
window.ONSEN_COLOR_DEFS = {
  colorless: { label: '無色透明', fill: 'transparent', ring: '#8a8677', hollow: true },
  milky_white: { label: '乳白色', fill: '#f1e9d3', ring: '#b4a888' },
  white: { label: '白', fill: '#fffdf8', ring: '#a9a38f' },
  gray_white: { label: '灰白色', fill: '#d3d1c6', ring: '#98958a' },
  green: { label: '緑', fill: '#86a05f', ring: '#6d8449' },
  blue: { label: '青', fill: '#6f97ae', ring: '#587d93' },
  yellow: { label: '黄', fill: '#d3b45b', ring: '#b39a45' },
  brown: { label: '茶褐色', fill: '#98694a', ring: '#7b5239' },
  black: { label: '黒', fill: '#44403b', ring: '#2f2c28' },
  other: { label: 'その他', fill: '#b9b3a6', ring: '#8f8a7e' }
};

window.ONSEN_BATH_COLORS = {
  'onsen-002': {
    colors: [
      { color: 'milky_white', expression: '白濁', scope: 'bath', scopeNames: ['玉の湯'], evidence: { type: 'official_text', confidence: 'confirmed', note: '公式の表現は「白濁した酸性の硫黄泉」。色の分類は、酸ヶ湯をよく知る利用者の判断で、ヒバ千人風呂(乳白色)と同じ「乳白色」に統一した' } },
      {
        color: 'milky_white', expression: '乳白色の硫黄泉', scope: 'bath', scopeNames: ['ヒバ千人風呂'],
        evidence: { type: 'third_party', confidence: 'third_party_reported', note: 'JR東日本「地・温泉」の酸ヶ湯の紹介:「ヒバ千人風呂は…乳白色の硫黄泉が肌を優しく包み込みます」。公式サイトは玉の湯を「白濁した酸性の硫黄泉」と書き、千人風呂の色は明記していない' },
        source: { url: 'https://www.jreast.co.jp/the-onsen/sukayu.html', checkedAt: '2026-10-18' }
      }
    ],
    source: { url: 'https://sukayu.jp/facility/', checkedAt: '2026-10-18' }
  },
  'onsen-004': {
    colors: [{ color: 'brown', expression: '赤褐色(茶褐色)', scope: 'facility', evidence: { type: 'official_text', confidence: 'confirmed' } }],
    source: { url: 'https://www.furofushi.com/hotspring/', checkedAt: '2026-10-18' }
  },
  'onsen-006': {
    colors: [{
      color: 'milky_white', expression: 'わずかに緑をふくんだ乳白色', scope: 'bath', scopeNames: ['混浴露天風呂'],
      evidence: { type: 'official_text', confidence: 'confirmed' },
      change: { kind: 'tint', note: 'わずかに緑をふくみます' }
    },
    {
      color: 'milky_white', expression: '乳白色の湯をたたえた内湯', scope: 'bath', scopeNames: ['内湯'],
      evidence: { type: 'official_photo', confidence: 'photo_inferred', note: '公式サイト https://kyounso.jp/ の温泉写真 <figure><img alt="乳白色の湯をたたえた内湯"><figcaption>内湯</figcaption></figure> の写真説明(2026-10-18に原文を再確認)。キャプション「内湯」が男湯・女湯の内湯に対応し、写真(uchiyu.webp)でも湯面が不透明な淡い乳白色(ほのかに青み)であることを目視確認。写真説明の文言であり本文の記載ではないため写真推定として扱う' },
      source: { url: 'https://kyounso.jp/', checkedAt: '2026-10-18' }
    }],
    source: { url: 'https://kyounso.jp/higaeri', checkedAt: '2026-10-17' }
  },
  'onsen-010': {
    colors: [
      {
        color: 'green', expression: '珍しい緑色(黄緑色)', scope: 'facility', role: 'base',
        evidence: { type: 'official_text', confidence: 'confirmed' },
        change: { kind: 'rare', note: 'まれに青色に変わることがあります' }
      },
      {
        color: 'blue', expression: 'まれにブルー色に変わることも', scope: 'facility', role: 'variant',
        evidence: { type: 'official_text', confidence: 'confirmed', note: '公式温泉ページの写真キャプション「まれにブルー色に変わることも」' },
        change: { kind: 'rare', note: 'まれに緑色から青色に変わることがあります' }
      },
      {
        color: 'green', expression: 'パンフレット写真の緑色の湯', scope: 'bath', scopeNames: ['薬師の湯', '混浴露天風呂', '小浴場'],
        evidence: { type: 'official_photo', confidence: 'photo_inferred', note: '公式パンフレット pf-6.pdf の浴槽写真(男性・女性の薬師湯、混浴露天風呂、男性・女性の小浴場)すべてで緑色の湯を目視確認。施設全体の公式記載(緑色・黄緑色)と一致し、浴槽の底や照明の色とは区別できる' },
        source: { url: 'http://www5.famille.ne.jp/~kunimihp/pf-6.pdf', checkedAt: '2026-10-18' }
      }
    ],
    source: { url: 'http://www5.famille.ne.jp/~kunimihp/onsen.html', checkedAt: '2026-10-17' }
  },
  'onsen-012': {
    colors: [
      { color: 'milky_white', expression: '乳白色', scope: 'bath', scopeNames: ['混浴露天風呂', '男女別内湯'], evidence: { type: 'official_text', confidence: 'confirmed' } },
      {
        color: 'milky_white', expression: '公式写真の乳白色の湯', scope: 'bath', scopeNames: ['宿泊者専用露天風呂'],
        evidence: { type: 'official_photo', confidence: 'photo_inferred', note: '公式温泉ページの宿泊者専用露天風呂の写真(onsen_05.jpg)で、湯面が不透明な淡い乳白色に見え、浴槽の底が見えないことを確認。雪景色・空の反射が写るため色味は断定せず「乳白色」にとどめる。公式の文章は混浴露天風呂・男女別内湯にしか色を書いていない' },
        source: { url: 'https://toushichi.com/onsen/', checkedAt: '2026-10-18' }
      }
    ],
    source: { url: 'https://toushichi.com/onsen/', checkedAt: '2026-10-17' }
  },
  'onsen-015': {
    colors: [{
      color: 'milky_white', expression: '乳白色の湯', scope: 'facility',
      evidence: { type: 'third_party', confidence: 'third_party_reported', note: 'JR東日本「地・温泉」:「乳白色の湯が特徴の「白湯」」「藩政時代から続く乳白色の湯」。公式サイトは4つの源泉について「湯の色は同じに見えますが…」とだけ書き、色名はない。浴槽ごとの色は未登録' }
    }],
    source: { url: 'https://www.jreast.co.jp/the-onsen/nyuto.html', checkedAt: '2026-10-18' }
  },
  'onsen-017': {
    colors: [
      { color: 'brown', expression: '茶褐色、緑、白色', scope: 'facility', listed: true, evidence: { type: 'official_text', confidence: 'confirmed' }, change: { kind: 'seasonal', note: '季節や気温で茶褐色・緑・白色に変わります' } },
      { color: 'green', expression: '茶褐色、緑、白色', scope: 'facility', listed: true, evidence: { type: 'official_text', confidence: 'confirmed' }, change: { kind: 'seasonal', note: '季節や気温で茶褐色・緑・白色に変わります' } },
      { color: 'white', expression: '茶褐色、緑、白色', scope: 'facility', listed: true, evidence: { type: 'official_text', confidence: 'confirmed' }, change: { kind: 'seasonal', note: '季節や気温で茶褐色・緑・白色に変わります' } }
    ],
    source: { url: 'https://yuuzankaku.co.jp/spa/', checkedAt: '2026-10-17' }
  },
  'onsen-018': {
    colors: [{ color: 'gray_white', expression: '灰白色の「にごり湯」', scope: 'bath', scopeNames: ['神経痛の湯'], evidence: { type: 'official_text', confidence: 'confirmed' } }],
    source: { url: 'https://www.goshougake.com/hotspring.html', checkedAt: '2026-10-17' }
  },
  'onsen-020': {
    colors: [{
      color: 'milky_white', expression: '溢れる乳白色の硫黄泉', scope: 'facility',
      evidence: { type: 'third_party', confidence: 'third_party_reported', note: '日本秘湯を守る会の宿紹介(hitou.or.jp)の記載。施設公式サイトに色の記載はない。浴槽ごとの色は未登録' }
    }],
    source: { url: 'https://www.hitou.or.jp/provider/detail?providerId=590', checkedAt: '2026-10-18' }
  },
  'onsen-021': {
    colors: [
      { color: 'white', expression: '白濁の湯', scope: 'facility', evidence: { type: 'official_text', confidence: 'confirmed' } },
      {
        color: 'white', expression: '青白いにごり湯', scope: 'bath', scopeNames: ['大露天風呂'],
        evidence: { type: 'third_party', confidence: 'third_party_reported', note: 'JR東日本「地・温泉」:「宿泊棟の向かいにある大露天風呂…男女別の広々とした湯船に青白いにごり湯が豊かにかけ流されています」。他の浴槽は3本の源泉との対応が不明で未登録' },
        source: { url: 'https://www.jreast.co.jp/the-onsen/doroyu.html', checkedAt: '2026-10-18' }
      }
    ],
    source: { url: 'https://www.doroyu.com/', checkedAt: '2026-10-17' }
  },
  'onsen-030': {
    colors: [
      { color: 'brown', expression: '微かに茶褐色', scope: 'bath', scopeNames: ['かわら湯'], evidence: { type: 'official_text', confidence: 'confirmed', note: '公式「温泉」ページの浴槽別の表「湯の色: 微かに茶褐色」(貸切風呂かわら湯)' } },
      { color: 'yellow', expression: '微かに黄色', scope: 'bath', scopeNames: ['展望風呂(地蔵の湯・観音の湯)'], evidence: { type: 'official_text', confidence: 'confirmed', note: '公式「温泉」ページの浴槽別の表「湯の色: 微かに黄色」(展望風呂)。2つの浴槽の色は別々に記載されている' } }
    ],
    source: { url: 'https://irori.in/hotspa/', checkedAt: '2026-10-18' }
  },
  'onsen-031': {
    colors: [{
      color: 'milky_white', expression: '乳白色の濁り湯', scope: 'bath', scopeNames: ['岩風呂', '檜露天風呂', '混浴内風呂'],
      evidence: { type: 'official_text', confidence: 'confirmed', note: '公式「当館のお風呂は全て源泉掛け流し。3つの自家源泉からは乳白色の濁り湯が絶え間なく浴槽に注がれ」。全ての浴槽について明記されている' },
      change: { kind: 'tint', note: '日本秘湯を守る会は「青白く濁る湯」と紹介しています(乳白色と同じ湯の別の表現で、別の色とは扱いません)' }
    }],
    source: { url: 'https://www.namegawa-fukushimaya.com/', checkedAt: '2026-10-18' }
  },
  'onsen-032': {
    colors: [{
      color: 'milky_white', expression: '公式写真の青みを帯びた乳白色の湯', scope: 'bath', scopeNames: ['混浴露天風呂', '女性専用露天風呂'],
      evidence: { type: 'official_photo', confidence: 'photo_inferred', note: '公式サイトの混浴露天風呂・女性専用露天風呂の写真2枚(hotspring_img01/02)で、湯面が不透明な淡い青みの乳白色であることを目視確認。日本温泉協会「色: 白色」、日本秘湯を守る会「にごり湯」と整合する。文章に浴槽の色の記載はなく、檜造りの内風呂は写真の色が判別できず未登録' },
      change: { kind: 'tint', note: '写真では青みを帯びた乳白色に見えます' },
      source: { url: 'http://www.ubayuonsen.com/hotspring.html', checkedAt: '2026-10-18' }
    }],
    source: { url: 'http://www.ubayuonsen.com/hotspring.html', checkedAt: '2026-10-18' }
  },
  'onsen-026': {
    colors: [{
      color: 'colorless', expression: '無色透明', scope: 'bath', scopeNames: ['露天風呂付き大浴場(洞窟の湯)'],
      evidence: { type: 'third_party', confidence: 'third_party_reported', note: '専門誌Discover Japanの写真説明:「敷地内にある洞窟から引湯している「洞窟の湯」。無色透明で肌にツヤがでる」。公式サイトは浴槽の色を書いていない。公式の「知覚 無色透明」は源泉分析の欄で浴槽色の根拠にしていない。薬湯の色は未登録' },
      source: { url: 'https://discoverjapan-web.com/article/15652', checkedAt: '2026-10-18' }
    }],
    source: { url: 'https://discoverjapan-web.com/article/15652', checkedAt: '2026-10-18' }
  },
  'onsen-034': {
    colors: [{
      color: 'milky_white', expression: '白濁', scope: 'facility',
      evidence: { type: 'official_text', confidence: 'confirmed', note: '公式お知らせ(2026年8月)の利用者向け紹介「高湯温泉独特の白濁した肌に優しいお湯」。施設全体の説明で、浴槽ごとの色ではない。公式の源泉紹介「青白濁の玉子湯」は源泉の説明のため浴槽色に転用していない' }
    }],
    source: { url: 'https://www.tamagoyu.jp/news/430/', checkedAt: '2026-10-18' }
  },
  'onsen-035': {
    colors: [
      { color: 'milky_white', expression: '白濁', scope: 'facility', evidence: { type: 'official_text', confidence: 'confirmed', note: '公式「自家源泉による白濁の湯」。施設全体の説明で、個別の浴槽の色ではない' }, source: { url: 'https://www.adachiya.jp/hotspring/history/index.html', checkedAt: '2026-10-18' } },
      {
        color: 'milky_white', expression: 'ミルキーブルーのにごり湯', scope: 'bath', scopeNames: ['大気の湯(東・西)'],
        evidence: { type: 'third_party', confidence: 'third_party_reported', note: '2025年7月の改修後の露天風呂を取材した記事:「ミルキーブルーのにごり湯は、加水、加温なしのかけ流し温泉」。公式の白濁と同じ白濁湯の表現の違いとして同じ乳白色にまとめ、青の丸は別に作らない。薬師の湯・東の湯・西の湯の色は未登録' },
        change: { kind: 'tint', note: '第三者の記事は青みを帯びたにごり湯と表現しています' },
        source: { url: 'https://otonano-shumatsu.com/articles/507140/3', checkedAt: '2026-10-18' }
      }
    ],
    source: { url: 'https://www.adachiya.jp/hotspring/history/index.html', checkedAt: '2026-10-18' }
  },
  'onsen-036': {
    colors: [{ color: 'milky_white', expression: '乳白色にごり湯', scope: 'facility', evidence: { type: 'official_text', confidence: 'confirmed', note: '公式温泉ページ「自慢の乳白色にごり湯柔らかい硫黄泉」。施設全体の説明で、個別の浴槽の色ではない' } }],
    source: { url: 'https://www.nojionsen.com/spa/', checkedAt: '2026-10-18' }
  },
  'onsen-039': {
    colors: [{
      color: 'milky_white', expression: '乳白色', scope: 'facility', role: 'variant',
      evidence: { type: 'official_text', confidence: 'confirmed', note: '公式「本来は透明な温泉です」「透明か白濁かはその日によって違います」「年に数回乳白色になります」。普段は透明(透明度の記載で、無色の丸は作らない)で、乳白色はまれな変化色。施設全体の説明で、個別の浴槽の色ではない' },
      change: { kind: 'rare', note: '年に数回、乳白色になります' }
    }],
    source: { url: 'https://www.manyoutei.jp/hotspa.html', checkedAt: '2026-10-18' }
  },
  'onsen-048': {
    colors: [{
      color: 'colorless', expression: '無色透明', scope: 'facility',
      evidence: { type: 'official_text', confidence: 'confirmed', note: '施設掲載のじゃらん宿泊プラン（2026年8月12日更新）が、家族風呂の利用案内に続けて「無色透明で、匂いもない天然温泉です」と説明。分析書の色ではなく利用する温泉の紹介。浴槽ごとの色は特定されていないため施設全体に限定する。施設公式サイト本文での湯色記載は確認できていない' }
    }],
    source: { url: 'https://www.jalan.net/yad324528/plan/plan02025828/', checkedAt: '2026-10-18' }
  },
  'onsen-041': {
    colors: [
      {
        color: 'milky_white', expression: '白や青白', scope: 'facility', role: 'base',
        evidence: { type: 'official_text', confidence: 'confirmed', note: '公式温泉ページ「5本とも無色透明の湯ですが、湯船にためると次第に白や青白くなります」。白と青白は同じ湯の表現の違いとして乳白色1色にまとめた。透明な「たけの湯」や灰色の湯花の色は含めない。施設全体の説明で、個別の浴槽の色ではない' },
        change: { kind: 'tint', note: '湯船にためると白や青白くなり、投入量・気温・気圧で変わります' }
      },
      {
        color: 'black', expression: '年に数回は黒くなる', scope: 'facility', role: 'variant',
        evidence: { type: 'official_text', confidence: 'confirmed', note: '公式温泉ページ「湯船の色についても、加仁湯は緑色に見えることはありませんが、年に数回は黒くなることがあります」。まれな変化色で、どの浴槽かは特定されていない' },
        change: { kind: 'rare', note: '年に数回、黒くなることがあります' }
      }
    ],
    source: { url: 'http://www.naf.co.jp/kaniyu/onsen.stm', checkedAt: '2026-10-18' }
  },
  'onsen-043': {
    colors: [
      { color: 'milky_white', expression: '白濁', scope: 'facility', listed: true, evidence: { type: 'official_text', confidence: 'confirmed', note: '公式トップの画像のalt文章「日によって温泉の色も白濁、緑色、黒色など様々」。写真の見た目からの推定ではない。色の順序・頻度・どの浴槽かは未確認' }, change: { kind: 'seasonal', note: '日によって色が変わります' } },
      { color: 'green', expression: '緑色', scope: 'facility', listed: true, evidence: { type: 'official_text', confidence: 'confirmed', note: '公式トップの画像のalt文章「日によって温泉の色も白濁、緑色、黒色など様々」。写真の見た目からの推定ではない' }, change: { kind: 'seasonal', note: '日によって色が変わります' } },
      { color: 'black', expression: '黒色', scope: 'facility', listed: true, evidence: { type: 'official_text', confidence: 'confirmed', note: '公式トップの画像のalt文章「日によって温泉の色も白濁、緑色、黒色など様々」。写真の見た目からの推定ではない' }, change: { kind: 'seasonal', note: '日によって色が変わります' } }
    ],
    source: { url: 'https://gensenkan.com/', checkedAt: '2026-10-18' }
  },
  'onsen-044': {
    colors: [{
      color: 'milky_white', expression: '白いにごり湯', scope: 'facility',
      evidence: { type: 'third_party', confidence: 'third_party_reported', note: '日本温泉協会の施設紹介「栃木県最古の湯、白いにごり湯」。分析書の色ではなく利用する湯の紹介。男湯・女湯のどの温度の浴槽かは特定されておらず、公式サイトでの確認ではない' }
    }],
    source: { url: 'https://www.spa.or.jp/search_f/detail_f/?F_ID=1685', checkedAt: '2026-10-18' }
  },
  'onsen-061': {
    colors: [
      { color: 'colorless', expression: '無色透明', scope: 'facility', evidence: { type: 'official_text', confidence: 'confirmed', note: '公式「大浴場」ページ「見た目には無色透明で一見何の変哲もない『ラジウム温泉』」。共同浴場3つの説明で、貸切風呂を含む全館の色とは断定しない。季節による色変化は未確認' } },
      { color: 'colorless', expression: '無色透明', scope: 'bath', scopeNames: ['したの湯', 'うえの湯', 'おくの湯'], evidence: { type: 'official_text', confidence: 'confirmed', note: '同ページが「したの湯」「うえの湯」「おくの湯」を挙げた直後の「これらのお風呂」「見た目には無色透明」の段落。分析書の色の転用ではない。貸切風呂・上がり湯には広げない' } }
    ],
    source: { url: 'https://www.jizaikan.jp/furo.html', checkedAt: '2026-10-19' }
  },
  'onsen-062': {
    colors: [{
      color: 'colorless', expression: '無色透明', scope: 'facility',
      evidence: { type: 'official_text', confidence: 'confirmed', note: '公式温泉ページ「無色透明で無臭の貝掛の湯」。入浴文化を説明する本文で、分析書の欄ではない。施設全体の説明で、個別の浴槽の色ではない(ぬる湯・加温湯との対応は明示されていない)' }
    }],
    source: { url: 'https://kaikake.jp/?page_id=932', checkedAt: '2026-10-19' }
  },
  'onsen-064': {
    colors: [{
      color: 'colorless', expression: '無色透明', scope: 'facility',
      evidence: { type: 'official_text', confidence: 'confirmed', note: '公式温泉ページ「色のない透明に澄んだお湯です。」入浴に適温まで加温する湯の説明で、分析書の原泉色ではない。施設全体の説明で、個別の浴槽の色ではない' }
    }],
    source: { url: 'https://www.rankei.com/spa/', checkedAt: '2026-10-19' }
  },
  'onsen-054': {
    colors: [{
      color: 'milky_white', expression: '乳白色', scope: 'facility', scopeLabel: '四季の湯・源泉槽',
      evidence: { type: 'official_text', confidence: 'confirmed', note: '公式温泉紹介「乳白色の源泉と加熱泉の２つの湯船があります。」(四季の湯)。乳白色は四季の湯の源泉槽の記載で、加熱槽や他の浴場・浴槽の色とは断定しない。部分範囲を個別の湯に表せないため、施設カードだけに載せ、詳細画面の湯名には丸を出さない(個別色は将来のUI対応か追加確認まで保留)' }
    }],
    source: { url: 'https://www.takamine.co.jp/about/hot-springs/', checkedAt: '2026-10-19' }
  },
  'onsen-057': {
    colors: [{
      color: 'milky_white', expression: '乳白色', scope: 'facility',
      evidence: { type: 'official_text', confidence: 'confirmed', note: '公式「白骨温泉と言えば…乳白色の湯。」「無色透明。空気にふれると、乳白色に変化。」旅館の温泉利用の説明で、個々の浴槽の色ではない。源泉段階の無色透明は別の色として載せない' },
      change: { kind: 'tint', note: '無色透明の湯が空気に触れて乳白色に変わると公式が説明しています' }
    }],
    source: { url: 'https://www.shirahone.net/first', checkedAt: '2026-10-19' }
  },
  'onsen-059': {
    colors: [{
      color: 'other', expression: '橙色の濁ったミネラル湯', scope: 'facility',
      evidence: { type: 'third_party', confidence: 'third_party_reported', note: '下諏訪観光協会「橙色の濁ったミネラル湯が特徴です。」既存の色分類に橙色がないため「その他」。特定の浴槽名はなく施設の内湯の説明で、公式サイトでの確認ではない。個人記事の冷鉱泉槽(ほぼ無色透明・茶褐色の湯の華)とは対応づけない' }
    }],
    source: { url: 'https://shimosuwaonsen.jp/spa/1045/', checkedAt: '2026-10-19' }
  }
};
