// 「源泉かけ流し」の波アイコン用の公開データ。施設ID(data.js の id)をキーにする。表示にlocalStorage・訪問記録は使わない。
//
// 施設カード: この表に施設があれば、施設名(と湯色の丸)の右に波アイコンを出す(ツールチップ「源泉かけ流しの浴槽あり」)。
//   一部の浴槽だけが該当する施設でも、施設全体が該当するとは断定しない(scope:'partial')。
// 詳細画面: baths に名前が載った「代表的な湯」だけ、湯名の右に波アイコンを出す(ツールチップ「源泉かけ流し」)。
//   施設全体の記述(scope:'facility')だけでは、個々の湯へは広げない。baths には公式等が浴槽について書いた湯だけを入れる。
//
// 項目:
//   scope     'facility'=施設(の温泉・全浴槽)が源泉かけ流しと書かれている / 'partial'=特定の浴槽だけ、または例外がある
//   baths     個別に確認できた浴槽名(feature-baths.js の name と同じ)。無ければ空配列
//   evidence  { type: 'official_text'(公式・自治体の文章)|'third_party'(日本秘湯を守る会・日本温泉協会などの団体),
//               confidence: 'confirmed'|'third_party_reported', note: 根拠の原文と適用範囲 }
//   dilution  加水・加温の情報。かけ流しかどうかとは別に管理する(画面には出さない)。water: 'none'|'for_temperature'|'added'|'unknown'
//   source    管理用(URLと確認日)
//   treatment 任意。「源生の湯」(源泉かけ流し・加水なし・加温なし)の判定用に、加水(water)・加温(heating)・消毒(disinfection)を
//             かけ流しとは独立した規則の配列で持つ。規則: { status:'none'|'yes', scope:'all'(コメントの coverage が全浴槽を対象と明記)|'baths'(baths の湯だけ),
//             baths, coverage:適用範囲, quote:原文, url, checkedAt }。規則が無い・当てはまらない湯は「未確認」。施設全体の記述だけでは個々の湯に広げない。
//   nonBathing 任意。{ name, reason } の配列。足湯・蒸し風呂など、全身を湯に浸す通常の入浴用浴槽ではないもの。名前に「足湯」「蒸し風呂」「蒸し湯」「砂湯」「サウナ」を含む浴槽も同じ扱い。
//             3条件が揃っていても「源生の湯」の対象外(判定結果 not_applicable。非該当・未判定とは別)。かけ流しの波アイコンの対象には影響しない
//   otherBaths 任意。代表的な湯に載っていないが、浴槽単位でかけ流しを確認できた浴槽名(今は無し)
// 判定の基準: 「源泉かけ流し」「源泉掛け流し」「源泉掛流し」「源泉湧き流し(蔦温泉が自ら『かけ流し』と説明)」など、かけ流しを明記した記述だけ。
//   「源泉100%」「天然温泉」「自家源泉」「加水なし」「循環なし」だけの記述からは判定しない。
window.ONSEN_KAKENAGASHI = {
  'onsen-003': {
    scope: 'facility', baths: ['久安の湯', '泉響の湯', '貸切風呂'],
    evidence: { type: 'official_text', confidence: 'confirmed', note: '公式FAQ「温泉は源泉かけ流しですか？ はい。…湯船の底から源泉が湧き出してくる『源泉湧き流し』の温泉」。久安の湯は利用形態「浴底より源泉湧き流し」、泉響の湯は公式トップが久安の湯とともに「源泉湧き流し」と記載、貸切風呂は青森県公式観光サイトが「貸切風呂で源泉湧き流しの湯は蔦温泉だけ」と記載' },
    dilution: { water: 'for_temperature', note: '温度調節のため蔦の森の湧水を入れている(久安の湯。公式)' },
    source: { url: 'https://tsutaonsen.com/faq/', checkedAt: '2026-10-18' },
    treatment: {
      water: [{ status: 'yes', scope: 'baths', baths: ['久安の湯'], coverage: '久安の湯', quote: '温度調節のため蔦の森の湧水を入れている', url: 'https://tsutaonsen.com/faq/', checkedAt: '2026-10-18' }]
    }
  },
  'onsen-004': {
    scope: 'partial', baths: ['海辺の露天風呂'],
    evidence: { type: 'official_text', confidence: 'confirmed', note: '公式「当館の温泉は、源泉かけ流し」「赤褐色の源泉かけ流し温泉」。ただし新館大浴場の内湯には源泉かけ流しの浴槽と真水の沸かし湯の浴槽があり、施設の全浴槽とは断定しない。海辺の露天風呂は源泉のみ(沸かし湯の記載なし)' },
    dilution: { water: 'for_temperature', note: '公式「温度調整のため加水…」' },
    source: { url: 'https://www.furofushi.com/hotspring/', checkedAt: '2026-10-18' }
  },
  'onsen-005': {
    scope: 'facility', baths: ['大浴場'],
    evidence: { type: 'official_text', confidence: 'confirmed', note: '東北町公式「町内全湯源泉掛け流し」。姉戸川温泉は町内の温泉の一つ(自治体の資料)' },
    dilution: { water: 'unknown' },
    source: { url: 'https://www.town.tohoku.lg.jp/kankou/onsen.html', checkedAt: '2026-10-18' }
  },
  'onsen-006': {
    scope: 'facility', baths: ['混浴露天風呂', '女性専用露天風呂', '内湯'],
    evidence: { type: 'official_text', confidence: 'confirmed', note: '公式「単純硫化水素泉の源泉かけ流しです。…内湯(男湯・女湯)と露天風呂(混浴・女性専用)」と浴槽を挙げて明記' },
    dilution: { water: 'unknown' },
    source: { url: 'https://kyounso.jp/', checkedAt: '2026-10-17' }
  },
  'onsen-007': {
    scope: 'facility', baths: ['白猿の湯', '桂の湯', '白糸の湯'],
    evidence: { type: 'official_text', confidence: 'confirmed', note: '公式「館内全4浴場すべて『源泉100％掛流し』」「加熱や循環・差し水などを一切していない掛け流しの100％天然温泉」' },
    dilution: { water: 'none', note: '公式「加熱や循環・差し水などを一切していない」' },
    source: { url: 'https://namari-onsen-ryokan.com/spa/', checkedAt: '2026-10-17' },
    treatment: {
      water: [{ status: 'none', scope: 'all', coverage: '館内全4浴場', scopeNote: '再確認: 「館内全4浴場すべて源泉100％掛流し」に続く※注記で、同じ4浴場(白猿の湯・桂の湯・白糸の湯ほか)について述べている', quote: '※加熱や循環・差し水などを一切していない掛け流しの100％天然温泉です。', url: 'https://namari-onsen-ryokan.com/spa/', checkedAt: '2026-10-18' }],
      heating: [{ status: 'none', scope: 'all', coverage: '館内全4浴場', scopeNote: '再確認: 「館内全4浴場すべて源泉100％掛流し」に続く※注記で、同じ4浴場(白猿の湯・桂の湯・白糸の湯ほか)について述べている', quote: '※加熱や循環・差し水などを一切していない掛け流しの100％天然温泉です。／沸かさず、薄めず、循環させずとも、皆様に適温の温泉をお愉しみいただけるように、湯守がいて管理をしています。', url: 'https://namari-onsen-ryokan.com/spa/', checkedAt: '2026-10-18' }]
    }
  },
  'onsen-008': {
    scope: 'partial', baths: ['大沢の湯'],
    evidence: { type: 'official_text', confidence: 'confirmed', note: '公式FAQ「湯治屋『大沢の湯』・『薬師の湯』・『かわべの湯』、山水閣『貸切家族風呂』は源泉掛け流しです」。山水の湯・豊沢の湯はこの記載に含まれないため対象外' },
    dilution: { water: 'unknown' },
    source: { url: 'https://www.oosawaonsen.com/sansui/faq/', checkedAt: '2026-10-17' }
  },
  'onsen-009': {
    scope: 'facility', baths: ['大湯', '滝の湯', '真湯'],
    evidence: { type: 'official_text', confidence: 'confirmed', note: '公式「温泉は全て100％源泉掛け流しとなっております」。露天風呂はすべて湯船そのものが源泉の足元湧出泉' },
    dilution: { water: 'none', note: '公式「一切お湯に手を加えて…」(露天)' },
    source: { url: 'https://www.motoyugeto.com/%E6%B8%A9%E6%B3%89/', checkedAt: '2026-10-17' },
    treatment: {
      water: [{ status: 'none', scope: 'baths', baths: ['大湯', '滝の湯', '真湯'], coverage: '全ての露天風呂(3湯とも露天)', scopeNote: '再確認(2026-10-18): 公式「館内施設」ページが露天風呂として大湯・疝気の湯・真湯・女(目)の湯・滝の湯を挙げ、白猿の湯・小天狗の湯は内風呂。よって「全ての露天風呂」に大湯・滝の湯・真湯の3湯とも含まれる。直前の「温泉は全て100％源泉掛け流し」と合わせてかけ流しも確認。「一切お湯に手を加えておりません」は同ページが「加水や加温など人の手が加えられ」と対比しており、加水・加温の両方がないという意味。内風呂は「直接源泉を湯船に引く」とだけあり対象外', quote: '全ての露天風呂は温泉が発見されて以来、湯船そのものが源泉であり…そのため一切お湯に手を加えておりません', url: 'https://www.motoyugeto.com/%E6%B8%A9%E6%B3%89/', checkedAt: '2026-10-18' }],
      heating: [{ status: 'none', scope: 'baths', baths: ['大湯', '滝の湯', '真湯'], coverage: '全ての露天風呂(3湯とも露天)', scopeNote: '再確認(2026-10-18): 公式「館内施設」ページが露天風呂として大湯・疝気の湯・真湯・女(目)の湯・滝の湯を挙げ、白猿の湯・小天狗の湯は内風呂。よって「全ての露天風呂」に大湯・滝の湯・真湯の3湯とも含まれる。直前の「温泉は全て100％源泉掛け流し」と合わせてかけ流しも確認。「一切お湯に手を加えておりません」は同ページが「加水や加温など人の手が加えられ」と対比しており、加水・加温の両方がないという意味。内風呂は「直接源泉を湯船に引く」とだけあり対象外', quote: '全ての露天風呂は…湯船そのものが源泉…そのため一切お湯に手を加えておりません(同ページが「加水や加温など人の手が加えられ」と対比して述べている)', url: 'https://www.motoyugeto.com/%E6%B8%A9%E6%B3%89/', checkedAt: '2026-10-18' }]
    }
  },
  'onsen-010': {
    scope: 'facility', baths: [],
    evidence: { type: 'official_text', confidence: 'confirmed', note: '公式トップ「源泉100%掛け流し」(施設の温泉についての記載。浴槽ごとの記載はないため個々の湯には付けない)' },
    dilution: { water: 'unknown' },
    source: { url: 'http://www5.famille.ne.jp/~kunimihp/', checkedAt: '2026-10-17' }
  },
  'onsen-011': {
    scope: 'partial', baths: ['大浴場'],
    evidence: { type: 'official_text', confidence: 'confirmed', note: '西和賀町観光協会(data.jsの公式URL)「大浴場には信号機があり…源泉かけ流しのちょっと不思議な温泉」。貸切風呂については記載がない' },
    dilution: { water: 'unknown' },
    source: { url: 'https://www.nishiwaga.biz/hot-spring/hotto-yuda/', checkedAt: '2026-10-17' }
  },
  'onsen-012': {
    scope: 'facility', baths: ['混浴露天風呂', '宿泊者専用露天風呂', '男女別内湯'],
    evidence: { type: 'official_text', confidence: 'confirmed', note: '公式「単純硫黄泉の源泉かけ流しを、内湯・露天・混浴それぞれでお楽しみ」「薄めたり循環させたりすることなく全ての浴槽にそのまま用い」「露天風呂同様…源泉掛け流し」' },
    dilution: { water: 'none', note: '公式「薄めたり循環させたりすることなく全ての浴槽に」' },
    source: { url: 'https://toushichi.com/onsen/', checkedAt: '2026-10-17' }
  },
  'onsen-015': {
    scope: 'facility', baths: [],
    evidence: { type: 'third_party', confidence: 'third_party_reported', note: '日本秘湯を守る会の宿紹介「利用形態: 源泉かけ流し」。公式サイトに記載がなく、浴槽ごとの記載もないため個々の湯には付けない' },
    dilution: { water: 'unknown' },
    source: { url: 'https://www.hitou.or.jp/', checkedAt: '2026-10-18' }
  },
  'onsen-016': {
    scope: 'facility', baths: ['やわらぎの湯－銀の湯'],
    evidence: { type: 'official_text', confidence: 'confirmed', note: '公式「単純泉(銀の湯)とマグネシウム・カルシウム硫酸塩泉(金の湯)2つの自然湧出温泉は8つの湯舟に今も変わらず掛け流しで注がれ」(冬期一部使用不可)。宿の湯舟の全体(8つ)を対象にした記述で、貸切風呂やわらぎの湯－銀の湯もその湯舟の一つとして個別にも表示する(再確認で適用範囲を判断)' },
    dilution: { water: 'unknown' },
    source: { url: 'https://taenoyu.com/bath/', checkedAt: '2026-10-17' }
  },
  'onsen-017': {
    scope: 'facility', baths: [],
    evidence: { type: 'official_text', confidence: 'confirmed', note: '公式「源泉: 源泉かけ流し。加水・加温なし」(自館専用の源泉についての記載。浴槽ごとの記載はないため個々の湯には付けない)' },
    dilution: { water: 'none', note: '公式「加水・加温なし」' },
    source: { url: 'https://yuuzankaku.co.jp/spa/', checkedAt: '2026-10-17' }
  },
  'onsen-018': {
    scope: 'facility', baths: ['神経痛の湯', '火山風呂'],
    evidence: { type: 'official_text', confidence: 'confirmed', note: '公式「大小浴場・全浴槽共に100%源泉かけ流し(温度調節の為の加水のみ・源泉は共通です)」。箱蒸し風呂は蒸し風呂のため個別の湯には付けない' },
    dilution: { water: 'for_temperature', note: '公式「温度調節の為の加水のみ」' },
    source: { url: 'https://www.goshougake.com/hotspring.html', checkedAt: '2026-10-17' },
    nonBathing: [{ name: '箱蒸し風呂', reason: '蒸し風呂は湯に浸かる浴槽ではないため認定の対象外' }],
    treatment: {
      water: [{ status: 'yes', scope: 'all', coverage: '大小浴場・全浴槽', quote: '大小浴場・全浴槽共に100%源泉かけ流し(温度調節の為の加水のみ・源泉は共通です)', url: 'https://www.goshougake.com/hotspring.html', checkedAt: '2026-10-17' }]
    }
  },
  'onsen-019': {
    scope: 'partial', baths: ['大浴場', '河原野天風呂', '混浴半露天風呂'],
    evidence: { type: 'official_text', confidence: 'confirmed', note: '公式温泉ページの各浴場に「かけ流し／加水」(大浴場・内湯・半露天)「かけ流し／加水なし」(河原野天風呂・足湯)と浴場ごとに明記' },
    dilution: { water: 'added', note: '大浴場・内湯・半露天は加水あり、河原野天風呂・足湯は加水・加温なし(公式)' },
    source: { url: 'http://takanoyuonsen.com/温泉/', checkedAt: '2026-10-17' },
    nonBathing: [{ name: '足湯', reason: '足湯は全身を湯に浸す入浴用の浴槽ではないため、公式に「かけ流し／加水なし／加温なし」とあっても認定の対象外(代表的な湯にも載せない)' }],
    treatment: {
      water: [{ status: 'yes', scope: 'baths', baths: ['大浴場', '混浴半露天風呂'], coverage: '浴場ごとの表示', quote: '大浴場・内湯・半露天「かけ流し／加水」', url: 'http://takanoyuonsen.com/温泉/', checkedAt: '2026-10-17' },
              { status: 'none', scope: 'baths', baths: ['河原野天風呂'], coverage: '浴場ごとの表示', quote: '河原野天風呂「かけ流し／加水なし」', url: 'http://takanoyuonsen.com/温泉/', checkedAt: '2026-10-17' }]
    }
  },
  'onsen-020': {
    scope: 'facility', baths: [],
    evidence: { type: 'third_party', confidence: 'third_party_reported', note: '日本秘湯を守る会の宿紹介「利用形態: 源泉かけ流し(加水あり)」。公式サイトに記載がなく、浴槽ごとの記載もない' },
    dilution: { water: 'added', note: '日本秘湯を守る会「加水あり」' },
    source: { url: 'https://www.hitou.or.jp/provider/detail?providerId=590', checkedAt: '2026-10-18' }
  },
  'onsen-021': {
    scope: 'facility', baths: [],
    evidence: { type: 'official_text', confidence: 'confirmed', note: '公式温泉ページ「おもな利用形態: 源泉かけ流し」(加水あり)。浴槽ごとの記載はないため個々の湯には付けない' },
    dilution: { water: 'added', note: '公式「加水あり」、泉温67度' },
    source: { url: 'https://www.doroyu.com/hotspring/hotspring.html', checkedAt: '2026-10-17' }
  },
  'onsen-023': {
    scope: 'partial', baths: ['瞑想 森の湯'],
    evidence: { type: 'official_text', confidence: 'confirmed', note: '公式「瞑想(meditation)と掛け流しの源泉をお楽しみください」(瞑想 森の湯)、貸切風呂「源泉かけ流しのお風呂」、分析表の見出し「天然温泉 かけ流しの湯」。大浴場など他の浴場の個別記載はない' },
    dilution: { water: 'unknown' },
    source: { url: 'https://www.yuzehotel.jp/hot_spring.html', checkedAt: '2026-10-17' }
  },
  'onsen-028': {
    scope: 'facility', baths: [],
    evidence: { type: 'official_text', confidence: 'confirmed', note: '公式トップ「源泉かけ流しの湯は、絶えることなく湧き出し」。滝風呂の打たせ湯は温度調整の加水がある旨の記載があり、浴槽ごとの確認はできないため個々の湯には付けない' },
    dilution: { water: 'for_temperature', note: '滝風呂の打たせ湯のみ温度調整のため加水(公式)' },
    source: { url: 'https://www.shirabu-higashiya.com/', checkedAt: '2026-10-18' }
  },
  'onsen-029': {
    scope: 'facility', baths: ['大岩風呂', 'ひょうたん風呂'],
    evidence: { type: 'official_text', confidence: 'confirmed', note: '公式温泉ページ「全風呂源泉かけ流し」(露天風呂も「常時源泉かけ流し」)' },
    dilution: { water: 'unknown' },
    source: { url: 'https://3nojo.com/hotspring/', checkedAt: '2026-10-18' }
  },
  'onsen-030': {
    scope: 'facility', baths: ['かわら湯', '展望風呂(地蔵の湯・観音の湯)'],
    evidence: { type: 'official_text', confidence: 'confirmed', note: '公式「加水、加温せず100％かけ流しで注いで」、浴槽別の表にもかわら湯・展望風呂とも「源泉100％かけ流し」' },
    dilution: { water: 'none', note: '公式「加水、加温せず」' },
    source: { url: 'https://irori.in/hotspa/', checkedAt: '2026-10-18' }
  },
  'onsen-031': {
    scope: 'facility', baths: ['岩風呂', '檜露天風呂', '混浴内風呂'],
    evidence: { type: 'official_text', confidence: 'confirmed', note: '公式「当館のお風呂は全て源泉掛け流し」(全ての浴槽について明記)' },
    dilution: { water: 'none', note: '公式「加水・加温・循環なし」' },
    source: { url: 'https://www.namegawa-fukushimaya.com/', checkedAt: '2026-10-18' },
    treatment: {
      water: [{ status: 'none', scope: 'all', coverage: '当館のお風呂は全て(岩風呂・檜露天風呂・混浴内風呂・女性用内風呂)', scopeNote: '再確認(2026-10-18): 公式トップ施設紹介の1つの段落に「当館のお風呂は全て源泉掛け流し。」「3つの自家源泉からは…浴槽に注がれ」「自然のものを自然のままに、加水･加温・循環消毒は一切行っていません。」と続けて書かれ、主語は同じ「当館のお風呂」(岩風呂・檜露天風呂・混浴内風呂・女性用内風呂の4浴槽)。例外の記載はなく、各浴槽の個別説明にも加水・加温の記載は無く矛盾しない。ただし「全浴槽」という語が加水・加温の文にあるわけではなく、同じ段落の流れから同じ浴槽群への記述と判断した', quote: '当館のお風呂は全て源泉掛け流し。…自然のものを自然のままに、加水･加温・循環消毒は一切行っていません。', url: 'https://www.namegawa-fukushimaya.com/', checkedAt: '2026-10-18' }],
      heating: [{ status: 'none', scope: 'all', coverage: '当館のお風呂は全て(岩風呂・檜露天風呂・混浴内風呂・女性用内風呂)', scopeNote: '再確認(2026-10-18): 公式トップ施設紹介の1つの段落に「当館のお風呂は全て源泉掛け流し。」「3つの自家源泉からは…浴槽に注がれ」「自然のものを自然のままに、加水･加温・循環消毒は一切行っていません。」と続けて書かれ、主語は同じ「当館のお風呂」(岩風呂・檜露天風呂・混浴内風呂・女性用内風呂の4浴槽)。例外の記載はなく、各浴槽の個別説明にも加水・加温の記載は無く矛盾しない。ただし「全浴槽」という語が加水・加温の文にあるわけではなく、同じ段落の流れから同じ浴槽群への記述と判断した', quote: '当館のお風呂は全て源泉掛け流し。…自然のものを自然のままに、加水･加温・循環消毒は一切行っていません。', url: 'https://www.namegawa-fukushimaya.com/', checkedAt: '2026-10-18' }]
    }
  },
  'onsen-032': {
    scope: 'facility', baths: [],
    evidence: { type: 'official_text', confidence: 'confirmed', note: '公式温泉ページの基本情報「加水・加温なし」「利用形態: 源泉かけ流し」(浴槽は露天2・内湯2と同じ表に並ぶ施設の基本情報。日本秘湯を守る会「源泉かけ流し」、日本温泉協会「掛け流し浴槽: 有」も一致)。「全浴槽」などの明記や浴槽ごとの記載はないため個々の湯には付けない' },
    dilution: { water: 'none', note: '公式「加水・加温なし」' },
    source: { url: 'http://www.ubayuonsen.com/hotspring.html', checkedAt: '2026-10-18' }
  },
  'onsen-033': {
    scope: 'facility', baths: [],
    evidence: { type: 'third_party', confidence: 'third_party_reported', note: '日本秘湯を守る会「利用形態: 源泉かけ流し」。公式サイトはリニューアル中で記載がなく、浴槽ごとの記載もない' },
    dilution: { water: 'unknown' },
    source: { url: 'https://www.hitou.or.jp/provider/736', checkedAt: '2026-10-18' }
  },
  'onsen-024': {
    scope: 'partial', baths: ['大浴場(あつ湯・ぬる湯)'],
    evidence: { type: 'official_text', confidence: 'confirmed', note: '公式「鮮度の高い源泉温泉かけ流し」の段落が「当宿では100%源泉かけ流し」と述べ、「本館大浴場には、あつ湯とぬる湯、男女別露天風呂とございます」と浴場を挙げている。大浴場(あつ湯・ぬる湯)だけを対象にする。混浴露天風呂・貸切露天風呂(天空の湯)は段落に挙がっておらず、天空の湯はサイフォン式で湯が溢れ出ない旨の記載もあるため、施設全体の記述から広げない' },
    dilution: { water: 'unknown' },
    source: { url: 'https://gagaonsen.com/hotspring/', checkedAt: '2026-10-18' }
  },
  'onsen-026': {
    scope: 'partial', baths: ['薬湯'],
    evidence: { type: 'official_text', confidence: 'confirmed', note: '公式FAQ「鎌先の湯「薬湯」(源泉かけ流し)(男女)」と薬湯を名指しで明記。露天風呂付き大浴場(洞窟の湯)は第三者誌に「こちらの大浴場は循環」の記載があり、かけ流しの記載がないため対象外' },
    dilution: { water: 'none', note: 'Discover Japan「薬湯は源泉掛け流し／加温あり／加水なし」(加温あり)' },
    source: { url: 'https://www.ichijoh.co.jp/contact/faq/', checkedAt: '2026-10-18' },
    treatment: {
      water: [{ status: 'none', scope: 'baths', baths: ['薬湯'], coverage: '薬湯', scopeNote: '専門誌Discover Japanが薬湯を名指しして書いた第三者の記載。公式は加水・加温を書いていない', quote: '薬湯は源泉掛け流し／加温あり／加水なし', url: 'https://discoverjapan-web.com/article/15652', checkedAt: '2026-10-18' }],
      heating: [{ status: 'yes', scope: 'baths', baths: ['薬湯'], coverage: '薬湯', scopeNote: '専門誌Discover Japanが薬湯を名指しして書いた第三者の記載(源泉温度27.8度のため加温)。加温ありのため源生の湯の対象外', quote: '薬湯は源泉掛け流し／加温あり／加水なし', url: 'https://discoverjapan-web.com/article/15652', checkedAt: '2026-10-18' }]
    }
  },
  'onsen-027': {
    scope: 'partial', baths: ['母里の湯', '薬師千人風呂', '天女風呂'],
    evidence: { type: 'official_text', confidence: 'confirmed', note: '公式「全て源泉掛け流しでご提供しています」。さらに2020-05-07の純温泉認定書が母里の湯(浴槽f)・薬師仙人風呂=公式の薬師千人風呂(浴槽a)・天女風呂(浴槽b)を「完全放流式」と記載。公式が掲載する各浴場を対象とし、足湯・ふかし風呂は含めない' },
    dilution: { water: 'none', note: '2020-05-07の認定書は加水なし。現在も同一処理かは未確認' },
    source: { url: 'https://www.ohnuma.co.jp/hotspring/', checkedAt: '2026-10-18' },
    nonBathing: [{ name: '足湯', reason: '足湯は全身を湯に浸す入浴用の浴槽ではないため認定の対象外' }, { name: 'ふかし風呂', reason: '蒸し風呂は湯に浸かる浴槽ではないため認定の対象外' }],
    treatment: {
      water: [{ status: 'none', scope: 'baths', baths: ['母里の湯', '薬師千人風呂', '天女風呂'], coverage: '浴槽f(母里の湯)・a(薬師仙人風呂=公式の薬師千人風呂)・b(天女風呂)', scopeNote: '2020-05-07の純温泉認定書に限定した記載。加温は同団体本文の「加温あり」と認定書の「加温なし」が矛盾しており未解決のため、加温の規則は設けない(源生の湯は未判定のまま)', quote: '浴槽a・f 加水:なし／浴槽b・c・d・e 加水:なし', url: 'https://realonsen.com/higashinaruko-oonuma/', checkedAt: '2026-10-18' }]
    }
  }
};

// 「源生の湯」: 本サイト独自の称号。次の3条件がすべて確認できた浴槽にだけ付く(泉質・効能の優劣は意味しない)。
//   1. 源泉かけ流し  2. 加水なし  3. 加温なし   消毒の有無は別属性で、この判定には使わない。
// 認定は上の表から自動で計算する(手動の認定リストは持たない)。
//   certified=3条件すべて確認済み / excluded=いずれかが「あり」と確認済み(非該当) / pending=情報不足(未判定)
//   not_applicable=足湯・蒸し風呂など入浴用浴槽ではない(3条件が揃っていても対象外)
//   各規則の scopeNote に、記述がどの浴槽群を対象にしていると判断したかの根拠を記録する
(function () {
  const NON_BATHING = /足湯|蒸し風呂|蒸し湯|砂湯|サウナ/;
  function ruleStatus(rules, name) {
    const hit = (rules || []).filter(r => r.scope === 'all' || (r.baths || []).includes(name));
    if (hit.some(r => r.status === 'yes')) return 'yes';
    if (hit.some(r => r.status === 'none')) return 'none';
    return 'unknown';
  }
  function evaluate(entry, bathName) {
    if (!entry) return { kake: false, water: 'unknown', heating: 'unknown', result: 'pending' };
    if (NON_BATHING.test(bathName) || (entry.nonBathing || []).some(n => n.name === bathName)) return { kake: (entry.baths || []).includes(bathName), water: 'unknown', heating: 'unknown', result: 'not_applicable' };
    const kake = (entry.baths || []).includes(bathName) || (entry.otherBaths || []).includes(bathName);
    const t = entry.treatment || {};
    const water = ruleStatus(t.water, bathName), heating = ruleStatus(t.heating, bathName);
    const result = water === 'yes' || heating === 'yes' ? 'excluded' : (kake && water === 'none' && heating === 'none' ? 'certified' : 'pending');
    return { kake, water, heating, result };
  }
  function certifiedBaths(entry) {
    if (!entry) return [];
    return [...new Set([...(entry.baths || []), ...(entry.otherBaths || [])])].filter(n => evaluate(entry, n).result === 'certified');
  }
  window.ONSEN_GENSEI = { evaluate, certifiedBaths };
})();
