// 「代表的な湯」の公開データ。施設ID(data.js の id)をキーにする。
// 追加方法: 施設IDのキーを足し、baths に湯を書く(表示は1施設につき最大3つ、タグは1つの湯につき最大3つ)。
// 掲載する値は、施設公式サイト(川原毛大湯滝のみ湯沢市の公式ページ、石塚旅館は公式パンフレットの画像、黄金崎不老ふ死温泉の湯色は公式ページの原文)の原文で確認できたものだけ。料金・営業時間は載せない。未確認の項目はキーごと省く(表示されない)。
//   name  湯の名称(公式の名称。公式に固有名がないものは説明用の名称)   kind 区分: 内湯 / 露天 / 半露天 / 蒸し風呂 / 岩盤浴
//   form  入浴形態: 男女別 / 混浴 / 貸切 / 女性専用   color 湯の色・透明度(その湯自体についての公式記載のみ。施設全体の色を流用しない)
//   tags  特徴(短い語)                  note 短い補足(湯ごと)。施設全体の補足は entry.note
// source は表示しない管理用の情報(公式ページ・確認日)。
window.ONSEN_FEATURE_BATHS = {
  'onsen-028': {
    baths: [
      { name: '滝風呂', note: '東屋の象徴。約400年受け継がれる石造りの浴槽に、湯が滝のように落ちます' },
      { name: '石風呂', note: '庭石を昭和26年から2年かけて手彫りした石風呂' },
      { name: '露天風呂', kind: '露天', form: '男女別', tags: ['雪見風呂'], note: '男性用・女性用があり、男女の入れ替えはありません' }
    ],
    source: { url: 'https://www.shirabu-higashiya.com/', checkedAt: '2026-10-18' }
  },
  'onsen-029': {
    baths: [
      { name: '大岩風呂', form: '混浴', tags: ['足元湧出', '女性専用時間あり'], note: '深湯・中湯は湯舟の底から湧き出る足元湧出湯です' },
      { name: 'ひょうたん風呂', form: '貸切', note: '予約制の貸切風呂です' }
    ],
    source: { url: 'https://3nojo.com/hotspring/', checkedAt: '2026-10-18' }
  },
  'onsen-030': {
    baths: [
      { name: 'かわら湯', form: '貸切', color: '微かに茶褐色', note: '1階の貸切風呂。元河原湯源泉だけを注ぎます' },
      { name: '展望風呂(地蔵の湯・観音の湯)', form: '男女別', color: '微かに黄色', tags: ['日帰り入浴可'], note: '4階の大浴場。地蔵の湯が男湯、観音の湯が女湯です' }
    ],
    source: { url: 'https://irori.in/hotspa/', checkedAt: '2026-10-18' }
  },
  'onsen-031': {
    baths: [
      { name: '岩風呂', kind: '露天', form: '混浴', color: '乳白色の濁り湯', tags: ['女性専用時間あり'], note: '前川を見下ろす岩の露天風呂' },
      { name: '檜露天風呂', kind: '露天', color: '乳白色の濁り湯', note: '5〜6人サイズ。宿泊の方は貸切にもできます' },
      { name: '混浴内風呂', kind: '内湯', form: '混浴', color: '乳白色の濁り湯', note: '石造りで天井が高く、湯治の方に一番人気です' }
    ],
    source: { url: 'https://www.namegawa-fukushimaya.com/', checkedAt: '2026-10-18' }
  },
  'onsen-032': {
    baths: [
      { name: '混浴露天風呂', kind: '露天', form: '混浴', tags: ['奇岩の絶景'], note: '時間によって入れ替えがあります' },
      { name: '女性専用露天風呂', kind: '露天', form: '女性専用', note: '時間によって入れ替えがあります' },
      { name: '檜造りの内風呂', kind: '内湯', form: '男女別', note: '日帰り入浴は露天風呂のみです' }
    ],
    source: { url: 'http://www.ubayuonsen.com/hotspring.html', checkedAt: '2026-10-18' }
  },
  'onsen-033': {
    baths: [
      { name: '根っこ風呂', note: '巨木の根をくり抜いてつくった風呂(丸形・横型)' },
      { name: '眺望露天風呂', kind: '露天', note: '標高1126mの山懐から眺める露天風呂' }
    ],
    source: { url: 'https://www.hitou.or.jp/provider/736', checkedAt: '2026-10-18' }
  },
  'onsen-002': {
    baths: [
      { name: 'ヒバ千人風呂', form: '混浴', tags: ['名物', '女性専用時間あり', '湯滝'], note: '160畳の総ヒバ造り。4つの異なる源泉があります' },
      { name: '玉の湯', form: '男女別', color: '白濁(乳白色)', note: 'ヒバ造りの小浴場。シャワーがあります' }
    ],
    source: { url: 'https://sukayu.jp/facility/', checkedAt: '2026-10-18' }
  },
  'onsen-003': {
    note: '公式: 湯船の底板から空気に触れていない源泉が湧き出す「源泉湧き流し」の温泉です。',
    baths: [
      { name: '久安の湯', tags: ['足元湧出', '時間で男女入替'], note: '源泉が足元から湧き出る浴場。シャワーはありません' },
      { name: '泉響の湯', form: '男女別', tags: ['足元湧出'], note: '浴槽から梁までの高さが最頂部で12mある高い天井の浴場' },
      { name: '貸切風呂', form: '貸切', tags: ['足元湧出'], note: '現地予約制。シャワーがあります' }
    ],
    source: { url: 'https://tsutaonsen.com/hotspring/', checkedAt: '2026-10-18' }
  },
  'onsen-004': {
    note: '公式: 湯の色は赤褐色(茶褐色)。湧き出た瞬間は透明ですが、空気に触れて酸化します。',
    baths: [
      { name: '海辺の露天風呂', kind: '露天', tags: ['波打ち際', '日本海と夕陽の眺め'], note: '混浴と女性専用の2つの浴槽があります' },
      { name: '不老ふ死の湯', tags: ['内湯と露天', '日本海の眺め', '時間で男女入替'], note: '新館大浴場。パノラマ露天風呂があります' },
      { name: '黄金の湯', kind: '内湯', tags: ['熱湯とぬる湯'], note: '本館大浴場。2つの浴槽があります' }
    ],
    source: { url: 'https://www.furofushi.com/hotspring/', checkedAt: '2026-10-18' }
  },
  'onsen-005': {
    baths: [
      { name: '大浴場', tags: ['ぬる湯'], note: '町内一ぬるい温泉と紹介されています' }
    ],
    source: { url: 'https://www.town.tohoku.lg.jp/kankou/onsen.html', checkedAt: '2026-10-18' }
  },
  'onsen-006': {
    baths: [
      { name: '混浴露天風呂', kind: '露天', form: '混浴', color: '乳白色(わずかに緑をふくむ)', tags: ['原生林の眺め'] },
      { name: '女性専用露天風呂', kind: '露天', form: '女性専用' },
      { name: '内湯', kind: '内湯', form: '男女別', note: 'シャワーはなく、樋の源泉を汲んで使います' }
    ],
    source: { url: 'https://kyounso.jp/', checkedAt: '2026-10-17' }
  },
  'onsen-007': {
    note: '公式: 館内4浴場すべて源泉100%で、加熱・循環・差し水をしていません。',
    baths: [
      { name: '白猿の湯', form: '混浴', tags: ['足元湧出', '立ち湯', '女性専用時間あり'], note: '深さ平均1.25mの立居浴専用' },
      { name: '桂の湯', form: '男女別', tags: ['内湯と露天', '渓流の眺め'], note: '川岸にもう一つ露天風呂があります' },
      { name: '白糸の湯', kind: '半露天', tags: ['時間で男女入替', '白糸の滝の眺め'] }
    ],
    source: { url: 'https://namari-onsen-ryokan.com/spa/', checkedAt: '2026-10-17' }
  },
  'onsen-008': {
    baths: [
      { name: '大沢の湯', kind: '露天', form: '混浴', tags: ['名物', '女性専用時間あり'], note: '湯治屋の浴場です' },
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
      { name: '大浴場', tags: ['列車接近の信号機', '駅舎併設'] },
      { name: '貸切風呂', form: '貸切' }
    ],
    source: { url: 'https://www.nishiwaga.biz/hot-spring/hotto-yuda/', checkedAt: '2026-10-17' }
  },
  'onsen-012': {
    note: '公式: 湯床に湧き出した温泉成分を含む泥で泥パックができます。',
    baths: [
      { name: '混浴露天風呂', kind: '露天', form: '混浴', color: '乳白色', tags: ['源泉100%', '女性専用時間あり', '八幡平の景観'] },
      { name: '宿泊者専用露天風呂', kind: '露天', form: '男女別', tags: ['宿泊者専用', '岩手山の眺め', '源泉100%'] },
      { name: '男女別内湯', kind: '内湯', form: '男女別', color: '乳白色', tags: ['源泉100%'] }
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
      { name: '河原野天風呂', kind: '露天', form: '混浴', tags: ['宿泊者限定', '源泉100%', 'ぬる湯'] },
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
  },
  'onsen-024': {
    baths: [
      { name: '大浴場(あつ湯・ぬる湯)', kind: '内湯', tags: ['あつ湯47度', 'ぬる湯38〜42度'], note: 'あつ湯では木枕に寝そべり、竹の筒で湯を掛ける「かけ湯」が伝統です' },
      { name: '混浴露天風呂', kind: '露天', form: '混浴', note: '男女別の露天風呂から石段を下りた先にあります。厳冬期はクローズ' },
      { name: '貸切露天風呂(天空の湯)', kind: '露天', form: '貸切', tags: ['月光の入浴'], note: '天を仰いで入るための貸切露天風呂。深夜は照明を落とします' }
    ],
    source: { url: 'https://gagaonsen.com/hotspring/', checkedAt: '2026-10-18' }
  },
  'onsen-026': {
    baths: [
      { name: '薬湯', kind: '内湯', form: '男女別', tags: ['茶色い湯花'], note: '傷に鎌先の由来となった湯。茶色い湯花が浮き、タイルが茶色に染まるのは温泉の性質です' },
      { name: '露天風呂付き大浴場(洞窟の湯)', form: '男女別', tags: ['つや肌の湯', '洞窟が目の前'], note: '内湯と露天風呂から四季の森を眺められます' }
    ],
    source: { url: 'https://www.ichijoh.co.jp/hotspring/', checkedAt: '2026-10-18' }
  },
  'onsen-027': {
    baths: [
      { name: '母里の湯', kind: '露天', form: '貸切', note: '庭園貸切露天風呂。宿の裏山にあり、石鹸・シャンプーは使えません' },
      { name: '薬師千人風呂', kind: '内湯', form: '混浴', tags: ['女性専用時間あり'], note: '昔ながらの混浴大浴場。浴槽内に半身浴用の座石があります' },
      { name: '天女風呂', kind: '内湯', form: '女性専用', tags: ['婦人名湯'], note: '純重曹泉「大沼の湯」が注がれる女性専用のお風呂' }
    ],
    source: { url: 'https://www.ohnuma.co.jp/hotspring/indoorbath.php', checkedAt: '2026-10-18' }
  }
};
