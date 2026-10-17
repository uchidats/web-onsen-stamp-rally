// 温泉カードの「湯の色」の丸(◯)用の公開データ。表示にlocalStorage・訪問記録は使わない。
//
// ONSEN_COLOR_DEFS: 色の分類(id)ごとの共通定義。label=正式な色名(ツールチップ・読み上げに使う)、
//   fill/ring=丸の表示用の近似色(CSSカラーコード。実際の湯の色そのものではない)、hollow=true は中抜きの丸(無色透明)。
// ONSEN_BATH_COLORS: 施設ID(data.js の id)をキーにした湯色データ。公式資料で確認できた色だけを載せる(未登録の施設は丸を出さない)。
//   colors[] は独立した湯色で最大3個。1つの色の項目:
//     color       色の分類(ONSEN_COLOR_DEFS のid)  expression 公式の表現(原文の語)
//     scope       'facility'=施設全体について公式に書かれた色 / 'bath'=特定の浴槽について書かれた色(scopeNames に浴槽名)
//     change      色が変化する場合のみ。{ kind: 'tint'(色味)|'rare'(まれ)|'seasonal'(季節・気温), note: 説明文 }。
//                 色が変わる湯は、基本となる代表色を color に1個だけ登録し、変化は note で伝える。
//     source      管理用(公式資料のURLと確認日。画面には出さない)
// ルール: 源泉の色(玉川温泉の「無色透明」など)を浴槽・施設の色として載せない。泉質から色を推測しない。
//         施設全体の色を個別の浴槽へ、個別の浴槽の色を施設全体へ、広げない(scope と scopeNames で範囲を明示する)。
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
  'onsen-006': {
    colors: [{
      color: 'milky_white', expression: 'わずかに緑をふくんだ乳白色', scope: 'bath', scopeNames: ['混浴露天風呂'],
      change: { kind: 'tint', note: 'わずかに緑をふくみます' }
    }],
    source: { url: 'https://kyounso.jp/higaeri', checkedAt: '2026-10-17' }
  },
  'onsen-010': {
    colors: [{
      color: 'green', expression: '珍しい緑色(黄緑色)', scope: 'facility',
      change: { kind: 'rare', note: 'まれに青色に変わることがあります' }
    }],
    source: { url: 'http://www5.famille.ne.jp/~kunimihp/onsen.html', checkedAt: '2026-10-17' }
  },
  'onsen-012': {
    colors: [{ color: 'milky_white', expression: '乳白色', scope: 'bath', scopeNames: ['混浴露天風呂', '男女別内湯'] }],
    source: { url: 'https://toushichi.com/onsen/', checkedAt: '2026-10-17' }
  },
  'onsen-017': {
    colors: [{
      color: 'brown', expression: '茶褐色、緑、白色', scope: 'facility',
      change: { kind: 'seasonal', note: '季節や気温で茶褐色・緑・白色に変わります' }
    }],
    source: { url: 'https://yuuzankaku.co.jp/spa/', checkedAt: '2026-10-17' }
  },
  'onsen-018': {
    colors: [{ color: 'gray_white', expression: '灰白色の「にごり湯」', scope: 'bath', scopeNames: ['神経痛の湯'] }],
    source: { url: 'https://www.goshougake.com/hotspring.html', checkedAt: '2026-10-17' }
  },
  'onsen-021': {
    colors: [{ color: 'white', expression: '白濁の湯', scope: 'facility' }],
    source: { url: 'https://www.doroyu.com/', checkedAt: '2026-10-17' }
  }
};
