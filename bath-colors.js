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
  }
};
