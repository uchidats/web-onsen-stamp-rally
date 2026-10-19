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
  },
  'onsen-034': {
    baths: [
      { name: '萱ぶき湯小屋「玉子湯」', form: '男女別', tags: ['萱ぶき屋根', '湯治場の趣'], note: '明治元年創業の趣を残す湯小屋。男女別に脱衣所と浴槽があります' },
      { name: '天渓の湯', kind: '露天', form: '男女別', tags: ['巨岩', '1日おきに男女入替'], note: '巨岩を屏風にした大小2つの浴槽があります' },
      { name: '瀬音', kind: '露天', form: '貸切', tags: ['川のせせらぎ'], note: '野天風呂ならではの解放感のある貸切露天風呂' }
    ],
    source: { url: 'https://tamagoyu.jp/spa/spa2/', checkedAt: '2026-10-18' }
  },
  'onsen-035': {
    baths: [
      { name: '大気の湯(東・西)', kind: '露天', form: '男女別', tags: ['2025年改修', '男女入替'], note: '2025年7月の改修で混浴から男女別になり、東と西がチェックイン日とチェックアウト日で男女入れ替え制です' },
      { name: '薬師の湯', kind: '露天', form: '貸切', tags: ['木造りの湯小屋'], note: '壱ノ湯・弐ノ湯の貸切露天風呂が2つあります' },
      { name: '東の湯・西の湯', kind: '内湯', form: '男女別', tags: ['露天と一体', '男女入替'], note: '露天風呂と一体になった大浴場。東と西で雰囲気が異なります' }
    ],
    source: { url: 'https://www.adachiya.jp/hotspring/taikinoyu/index.html', checkedAt: '2026-10-18' }
  },
  'onsen-036': {
    note: '公式: 毎日1か所の湯殿が清掃のため利用できません。鬼面の湯・天狗の湯・千寿の湯は3時間ごとに男女が入れ替わります。',
    baths: [
      { name: '鬼面の湯', kind: '露天', form: '男女別', tags: ['夜のライトアップ', '時間で男女入替'], note: '四季の景色を楽しめる露天風呂' },
      { name: '天狗の湯', form: '男女別', tags: ['内湯と露天', '時間で男女入替'], note: '内湯から露天風呂へ入浴したまま移動できます' },
      { name: '千寿の湯', kind: '内湯', form: '男女別', tags: ['檜造り', '時間で男女入替'], note: '温度の異なる3つの浴槽がある伝統の檜風呂' }
    ],
    source: { url: 'https://www.nojionsen.com/spa/', checkedAt: '2026-10-18' }
  },
  'onsen-037': {
    baths: [
      { name: '自噴巌風呂', form: '貸切', tags: ['足元湧出'], note: 'タガネでくり抜いた岩の湯船。足元から源泉が湧き出します' },
      { name: '滝の湯', form: '男女別', tags: ['時間で男女入替'], note: '建設時に出てきた自然岩をそのまま利用した浴場' },
      { name: '檜風呂', form: '男女別', tags: ['檜造り', '時間で男女入替'], note: '浴槽と壁が檜でできた浴場' }
    ],
    source: { url: 'https://kashiwayaryokan.com/hotsprings/', checkedAt: '2026-10-18' }
  },
  'onsen-039': {
    note: '3つの湯の名称は公式の固有名ではなく、種類を示す説明用の名称です。',
    baths: [
      { name: '大浴場(内湯)', kind: '内湯', form: '男女別', tags: ['檜の湯船', 'ヒバの床と壁'] },
      { name: '男女別露天風呂', kind: '露天', form: '男女別', tags: ['渓流沿い'] },
      { name: '貸切露天風呂(陶器2槽)', kind: '露天', form: '貸切', tags: ['陶器の湯船2つ'] }
    ],
    source: { url: 'https://www.manyoutei.jp/hotspa.html', checkedAt: '2026-10-18' }
  },
  'onsen-048': {
    note: '古式風呂はメンテナンスのため、いずれか1か所が利用できない場合があります。',
    baths: [
      { name: '古式風呂 一乃湯', kind: '内湯', form: '貸切', tags: ['石造り', '常盤之湯'], note: '専用の源泉から自然流下で約5mの経路を通して給湯する家族風呂' },
      { name: '古式風呂 二乃湯・三乃湯', kind: '内湯', form: '貸切', tags: ['檜造り', '塩之湯'], note: '各2〜3名向きの檜造りの家族風呂です' },
      { name: '山里乃湯', kind: '露天', form: '貸切', tags: ['山里の風情', '3つの湯船'], note: '裏山へ上ったところにある、木の塀で仕切られた1組ずつ使う露天風呂です' }
    ],
    source: { url: 'http://www.naf.co.jp/shojukan/onsentop.stm', checkedAt: '2026-10-18' }
  },
  'onsen-053': {
    note: '宿泊者専用の貸切風呂です。空いていれば予約なしで利用できます。',
    baths: [
      { name: '福寿草', form: '貸切', tags: ['内湯と露天', '円形の露天風呂'], note: '円形の露天風呂と内湯を楽しめます' },
      { name: '都忘れ', kind: '半露天', form: '貸切', tags: ['窓を開放'], note: '窓を開けると半露天、閉めると内風呂になる浴場です' },
      { name: '水芭蕉', kind: '露天', form: '貸切', tags: ['寝湯', '2024年改修'], note: '2024年3月にリニューアルした、寝湯としても楽しめる露天風呂です' }
    ],
    source: { url: 'https://www.yado-mikawaya.com/spa/index.html', checkedAt: '2026-10-18' }
  },
  'onsen-040': {
    baths: [
      { name: '川岸露天風呂(混浴)', kind: '露天', form: '混浴', tags: ['川岸', '女性専用時間あり'], note: '朝7時〜8時は女性専用です。館内から88段の階段を下りた川岸にあります' },
      { name: '女性専用川岸露天風呂', kind: '露天', form: '女性専用', tags: ['川岸'] },
      { name: 'やすらぎの湯・太古の湯', kind: '内湯', form: '男女別', tags: ['2系統の温泉'], note: 'やすらぎの湯が女性、太古の湯が男性です' }
    ],
    source: { url: 'http://www.myogaya.com/onsen.stm', checkedAt: '2026-10-18' }
  },
  'onsen-041': {
    baths: [
      { name: '第三露天風呂', kind: '露天', form: '混浴' },
      { name: '第一露天風呂', kind: '露天', form: '女性専用' },
      { name: '利き湯 ロマンの湯', tags: ['5源泉を入り比べ'], note: '5つの湯船に別々の源泉を引き、わざと熱い湯船とぬるい湯船があります' }
    ],
    source: { url: 'http://www.naf.co.jp/kaniyu/onsen.stm', checkedAt: '2026-10-18' }
  },
  'onsen-042': {
    baths: [
      { name: '雪見の湯', kind: '露天', form: '混浴', tags: ['開業時からの野天'], note: '昭和4(1929)年の開業時からある野天風呂です' },
      { name: '滝見の湯', kind: '露天', form: '混浴', tags: ['滝を正面に望む'], note: '岩肌を縫うように流れ落ちる滝を正面に仰ぎます' },
      { name: '石楠花の湯', kind: '露天', form: '混浴', tags: ['滝の真横'], note: '滝のすぐ真横に位置する野天風呂です' }
    ],
    source: { url: 'https://www.8tyo-no-yu.co.jp/spa/', checkedAt: '2026-10-18' }
  },
  'onsen-043': {
    baths: [
      { name: '高尾の湯(渓流露天風呂)', kind: '露天', form: '男女別', tags: ['赤川渓谷', '夜間ライトアップ'] },
      { name: '邯鄲の湯', kind: '内湯', form: '混浴', tags: ['岩肌湧出', '女性専用時間あり'], note: '館内の岩風呂。女性専用の時間帯があります' },
      { name: '宝の湯', kind: '内湯', form: '男女別', tags: ['檜風呂', '間欠泉'], note: '宿泊者向けの館内檜風呂です' }
    ],
    source: { url: 'https://gensenkan.com/onsen.htm', checkedAt: '2026-10-18' }
  },
  'onsen-044': {
    note: '男湯・女湯の名称は公式の固有名ではなく、浴槽の構成を示す説明用の名称です。',
    baths: [
      { name: '男湯(41〜48℃)', form: '男女別', tags: ['温度別浴槽', '短熱浴'], note: '41・42・43・44・46・48度の6種類の浴槽があります' },
      { name: '女湯(41〜46℃)', form: '男女別', tags: ['温度別浴槽', '短熱浴'], note: '女湯には48度の浴槽がありません' }
    ],
    source: { url: 'https://www.shikanoyu.jp/hotspa/', checkedAt: '2026-10-18' }
  },
  'onsen-045': {
    baths: [
      { name: '露天の湯', kind: '露天', tags: ['那珂川のせせらぎ', '2023年改修'] },
      { name: 'たいようの湯', tags: ['陽光'] },
      { name: 'ひのきの湯', tags: ['檜造り', '熱め・ぬるめの2槽'] }
    ],
    source: { url: 'https://www.itamuro-daikokuya.com/onsen/', checkedAt: '2026-10-18' }
  },
  'onsen-060': {
    note: '「山の湯・里の湯」は2つの貸切風呂をまとめた表示です。「ほんやらの湯（露天）」の括弧は、循環式の内湯を除いた露天風呂だけを指す説明用の表記です。',
    baths: [
      { name: '月見の湯', kind: '露天', form: '男女別', tags: ['あつ湯・ぬる湯の仕切り', '雪見', '時間で男女入替'], note: '湯舟をあつ湯とぬる湯に仕切った露天風呂。2024年に改修されました' },
      { name: 'ほんやらの湯（露天）', kind: '露天', form: '男女別', note: '露天風呂付き大浴場の男女別の露天風呂です' },
      { name: '山の湯・里の湯', form: '貸切', note: '2つの貸切風呂です。宿泊者のみ利用できます' }
    ],
    source: { url: 'https://chitose.tv/bath/', checkedAt: '2026-10-19' }
  },
  'onsen-061': {
    note: '共同浴場の「したの湯」「うえの湯」「おくの湯」を載せています。別の源泉を使う貸切風呂は含みません。',
    baths: [
      { name: 'したの湯', kind: '内湯', form: '男女別', tags: ['1日ごとに男女入替', 'ぬる湯', '長湯文化'] },
      { name: 'うえの湯', kind: '内湯', form: '男女別', tags: ['1日ごとに男女入替', 'ぬる湯', '長湯文化'] },
      { name: 'おくの湯', kind: '内湯', form: '男女別', tags: ['1日ごとに男女入替', 'ぬる湯', '長湯文化'] }
    ],
    source: { url: 'https://www.jizaikan.jp/furo.html', checkedAt: '2026-10-19' }
  },
  'onsen-062': {
    note: '3つの湯の名称は公式の固有名ではなく、温度と内外を示す説明用の名称です。',
    baths: [
      { name: '内湯（源泉ぬる湯）', kind: '内湯', form: '男女別', tags: ['ぬる湯', '長湯文化'] },
      { name: '露天風呂（源泉ぬる湯）', kind: '露天', form: '男女別', tags: ['岩造り', 'ぬる湯'] },
      { name: '露天風呂（加温湯）', kind: '露天', form: '男女別', note: '加熱した湯の露天風呂です' }
    ],
    source: { url: 'https://kaikake.jp/?page_id=932', checkedAt: '2026-10-19' }
  },
  'onsen-063': {
    note: '共用の大浴場3つを載せています。客室付きの露天風呂は含みません。',
    baths: [
      { name: '眺', tags: ['8階の展望大浴場', '時間で男女入替'] },
      { name: '熱の湯', form: '男女別', tags: ['7階', '檜風呂'], note: '男湯・女湯ともにひのき材をたっぷり使った浴場です' },
      { name: '望', tags: ['3階の大浴場', '時間で男女入替'] }
    ],
    source: { url: 'https://senamionsen.com/hotspa/', checkedAt: '2026-10-19' }
  },
  'onsen-064': {
    note: '「山の湯［石湯］」「山の湯［深湯］」は日中は男女別、夕方以降は宿泊者の貸切です。',
    baths: [
      { name: '大浴場', kind: '内湯', form: '男女別' },
      { name: '山の湯［石湯］', form: '男女別', tags: ['川石の湯船', '夜は宿泊者貸切'], note: '五十嵐川の石で組んだ湯船です' },
      { name: '山の湯［深湯］', kind: '露天', form: '男女別', tags: ['深さ約130cm', '夜は宿泊者貸切'] }
    ],
    source: { url: 'https://www.rankei.com/spa/', checkedAt: '2026-10-19' }
  }
};
