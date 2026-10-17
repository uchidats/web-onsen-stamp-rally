// 「代表的な湯」の公開データ。施設ID(data.js の id)をキーにする。
// 追加方法: 施設IDのキーを足し、baths に湯を書く(表示は1施設につき最大3つ、タグは1つの湯につき最大3つ)。
// 掲載する値は、施設公式サイト(川原毛大湯滝のみ湯沢市の公式ページ、石塚旅館は公式パンフレットの画像)の原文で確認できたものだけ。料金・営業時間は載せない。未確認の項目はキーごと省く(表示されない)。
//   name  湯の名称(公式の名称。公式に固有名がないものは説明用の名称)   kind 区分: 内湯 / 露天 / 半露天 / 蒸し風呂 / 岩盤浴
//   form  入浴形態: 男女別 / 混浴 / 貸切 / 女性専用   color 湯の色・透明度(その湯自体についての公式記載のみ。施設全体の色を流用しない)
//   tags  特徴(短い語)                  note 短い補足(湯ごと)。施設全体の補足は entry.note
// source は表示しない管理用の情報(公式ページ・確認日)。
window.ONSEN_FEATURE_BATHS = {
  'onsen-006': {
    baths: [
      { name: '混浴露天風呂', kind: '露天', form: '混浴', color: '乳白色(わずかに緑をふくむ)', tags: ['源泉かけ流し', '原生林の眺め'] },
      { name: '女性専用露天風呂', kind: '露天', form: '女性専用', tags: ['源泉かけ流し'] },
      { name: '内湯', kind: '内湯', form: '男女別', note: 'シャワーはなく、樋の源泉を汲んで使います' }
    ],
    source: { url: 'https://kyounso.jp/', checkedAt: '2026-10-17' }
  },
  'onsen-007': {
    note: '公式: 館内4浴場すべて源泉100%掛け流しです。',
    baths: [
      { name: '白猿の湯', form: '混浴', tags: ['足元湧出', '立ち湯', '女性専用時間あり'], note: '深さ平均1.25mの立居浴専用' },
      { name: '桂の湯', form: '男女別', tags: ['内湯と露天', '渓流の眺め'], note: '川岸にもう一つ露天風呂があります' },
      { name: '白糸の湯', kind: '半露天', tags: ['時間で男女入替', '白糸の滝の眺め'] }
    ],
    source: { url: 'https://namari-onsen-ryokan.com/spa/', checkedAt: '2026-10-17' }
  },
  'onsen-008': {
    baths: [
      { name: '大沢の湯', kind: '露天', form: '混浴', tags: ['名物', '女性専用時間あり', '源泉かけ流し'], note: '湯治屋の浴場です' },
      { name: '豊沢の湯', kind: '半露天', form: '男女別', tags: ['豊沢川の眺め', '日帰り入浴可'], note: '冬期は内湯になります' },
      { name: '山水の湯', tags: ['内湯と露天', '宿泊者専用'] }
    ],
    source: { url: 'https://www.oosawaonsen.com/sansui/spa/', checkedAt: '2026-10-17' }
  },
  'onsen-009': {
    note: '公式: 冬は豪雪のため利用できなくなります。',
    baths: [
      { name: '大湯', kind: '露天', form: '混浴', tags: ['足元湧出', '源泉100%', '女性専用時間あり'], note: '季節により47〜48℃と熱めです' },
      { name: '滝の湯', kind: '露天', form: '女性専用', tags: ['足元湧出', '源泉100%'] },
      { name: '真湯', kind: '露天', form: '混浴', tags: ['足元湧出', '源泉100%', '女性専用時間あり'] }
    ],
    source: { url: 'https://www.motoyugeto.com/%E6%B8%A9%E6%B3%89/', checkedAt: '2026-10-17' }
  },
  'onsen-010': {
    note: '公式: 湯色は緑色(黄緑色)で、まれに青色に変わることもあります。',
    baths: [
      { name: '薬師の湯', form: '男女別' },
      { name: '混浴露天風呂', kind: '露天', form: '混浴' },
      { name: '小浴場', form: '男女別' }
    ],
    source: { url: 'http://www5.famille.ne.jp/~kunimihp/pf-6.pdf', checkedAt: '2026-10-17' }
  },
  'onsen-011': {
    baths: [
      { name: '大浴場', tags: ['列車接近の信号機', '駅舎併設', '源泉かけ流し'] },
      { name: '貸切風呂', form: '貸切' }
    ],
    source: { url: 'https://www.nishiwaga.biz/hot-spring/hotto-yuda/', checkedAt: '2026-10-17' }
  },
  'onsen-012': {
    note: '公式: 湯床に湧き出した温泉成分を含む泥で泥パックができます。',
    baths: [
      { name: '混浴露天風呂', kind: '露天', form: '混浴', color: '乳白色', tags: ['源泉100%', '女性専用時間あり', '八幡平の景観'] },
      { name: '宿泊者専用露天風呂', kind: '露天', form: '男女別', tags: ['宿泊者専用', '岩手山の眺め', '源泉100%'] },
      { name: '男女別内湯', kind: '内湯', form: '男女別', color: '乳白色', tags: ['源泉100%', '源泉かけ流し'] }
    ],
    source: { url: 'https://toushichi.com/onsen/', checkedAt: '2026-10-17' }
  },
  'onsen-013': {
    baths: [
      { name: '大浴場', tags: ['15種類の浴槽', '源泉100%浴槽'] },
      { name: '新緑の露天風呂', kind: '露天', tags: ['ぶなの森の眺め', '源泉30%'] },
      { name: '貸切浴場', form: '貸切', tags: ['宿泊者限定'] }
    ],
    source: { url: 'https://www.shintamagawa.jp/care/', checkedAt: '2026-10-17' }
  },
  'onsen-014': {
    baths: [
      { name: '大浴場', tags: ['11種類の浴槽', '源泉100%浴槽'] },
      { name: '箱蒸し湯', kind: '蒸し風呂', tags: ['源泉100%'] },
      { name: '天然岩盤浴', kind: '岩盤浴', tags: ['屋外', '地熱'], note: '自然研究路脇の岩盤にゴザを敷いて横になる' }
    ],
    source: { url: 'https://www.tamagawa-onsen.jp/care/', checkedAt: '2026-10-17' }
  },
  'onsen-017': {
    note: '公式: 湯の色は季節や気温で茶褐色・緑・白色に変わります。',
    baths: [
      { name: '温泉露天浴場', kind: '露天', form: '男女別' },
      { name: '温泉大浴場', form: '男女別' }
    ],
    source: { url: 'https://yuuzankaku.co.jp/spa/', checkedAt: '2026-10-17' }
  },
  'onsen-019': {
    note: '公式: 役内川の河原で湧く源泉は「清流のように澄んでいて」肌ざわりがやわらかいとされています。',
    baths: [
      { name: '大浴場', tags: ['名物', '立ち湯', '時間で男女入替'], note: '明治の創業当時からの名残をとどめる湯' },
      { name: '河原野天風呂', kind: '露天', form: '混浴', tags: ['宿泊者限定', '100%源泉かけ流し', 'ぬる湯'] },
      { name: '混浴半露天風呂', kind: '半露天', form: '混浴', tags: ['役内川の眺め'], note: '湯あみ着の着用可' }
    ],
    source: { url: 'http://takanoyuonsen.com/温泉/', checkedAt: '2026-10-17' }
  },
  'onsen-020': {
    baths: [
      { name: '混浴野天風呂', kind: '露天', form: '混浴', note: '男女別の野天風呂もあります' }
    ],
    source: { url: 'https://r.goope.jp/fukenoyu/', checkedAt: '2026-10-17' }
  },
  'onsen-021': {
    note: '公式: 「白濁の湯」と紹介されています(浴槽ごとの色の記載はありません)。',
    baths: [
      { name: '大露天風呂', kind: '露天', tags: ['単純泉', '冬期休業'] },
      { name: '混浴露天風呂', kind: '露天', form: '混浴', tags: ['硫黄泉'] },
      { name: '女性専用露天風呂', kind: '露天', form: '女性専用', tags: ['硫黄泉', '硫化水素型'] }
    ],
    source: { url: 'https://www.doroyu.com/hotspring/hotspring.html', checkedAt: '2026-10-17' }
  },
  'onsen-022': {
    baths: [
      { name: '川原毛大湯滝', kind: '露天', tags: ['滝湯', '天然の露天', '水着着用'], note: '強酸性。肌の弱い方は短時間の利用を' }
    ],
    source: { url: 'https://www.city-yuzawa.jp/site/yuzawatrip/711.html', checkedAt: '2026-10-17' }
  },
  'onsen-023': {
    baths: [
      { name: '仙人の湯', form: '男女別', tags: ['湯瀬渓谷の眺め'], note: '男性大浴場。露天風呂あり' },
      { name: '美人の湯', form: '男女別', tags: ['庭園の眺め'], note: '女性大浴場。露天風呂あり' },
      { name: '瞑想 森の湯', form: '男女別', tags: ['大人専用', '少人数', '熱湯とぬる湯'] }
    ],
    source: { url: 'https://www.yuzehotel.jp/hot_spring.html', checkedAt: '2026-10-17' }
  },
  'onsen-015': {
    note: '公式: 4つの源泉は湯の色が同じに見えるものの、効能や肌触りが異なるとされています。',
    baths: [
      { name: '混浴露天風呂', kind: '露天', form: '混浴' },
      { name: '白湯', note: '美人の湯。別名 冷えの湯' },
      { name: '黒湯', note: 'ぬぐだまりの湯・子宝の湯' }
    ],
    source: { url: 'http://www.tsurunoyu.com/FONDMENT/t-onsen.html', checkedAt: '2026-10-17' }
  },
  'onsen-016': {
    baths: [
      { name: 'やわらぎの湯－銀の湯', form: '貸切', note: '宿泊の方は滞在中ご利用いただけます。日帰りは要予約' }
    ],
    source: { url: 'https://taenoyu.com/bath/', checkedAt: '2026-10-17' }
  },
  'onsen-018': {
    baths: [
      { name: '神経痛の湯', form: '男女別', color: '灰白色のにごり湯', tags: ['メイン浴槽', '熱め・濃いめ'] },
      { name: '箱蒸し風呂', kind: '蒸し風呂', form: '男女別', tags: ['名物', '天然蒸気'], note: '木箱から首だけ出して温まる' },
      { name: '火山風呂', form: '男女別', tags: ['気泡', 'ややぬるめ'] }
    ],
    source: { url: 'https://www.goshougake.com/hotspring.html', checkedAt: '2026-10-17' }
  }
};
