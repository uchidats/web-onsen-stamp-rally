
(()=>{'use strict';const DATA=window.ONSEN_DATA||[];const $=id=>document.getElementById(id);const store=window.OnsenRecords.create(localStorage);let state,visible=18,current=null,toastTimer;try{state=store.load()}catch{state=store.empty();setTimeout(()=>showToast('保存データを読み込めません。元データは保持しています。復元するまで変更できません。'),0)}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const visitInfo=id=>window.OnsenRecords.summary(state.userData.visits[id]);const visited=x=>visitInfo(x.id).visited;const mapUrl=x=>x.mapUrl;const bookUrl=x=>'https://www.google.com/search?q='+encodeURIComponent(x.facility+' '+x.prefecture+' 宿泊 予約');const showToast=s=>{const e=$('toast');e.textContent=s;e.style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.style.display='none',2600)};let prefFilter='';

function officialUrl(value){if(typeof value!=='string'||!/^https?:\/\//i.test(value.trim()))return '';try{const url=new URL(value.trim());return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:''}catch{return ''}}
function facilityMap(x,context='card'){
  const map=officialUrl(mapUrl(x)),tooltipId=context+'-map-'+x.id,label=context==='detail'?'Google Mapsで開く':x.facility+'をGoogle Mapsで表示（新しいタブで開く）',tip=context==='detail'?'Google Mapsで開く':'Google Mapsで表示';
  return map?`<a class="map-link"${context==='detail'?' id="detailMap" title="Google Mapsで開く"':''} href="${esc(map)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(label)}" aria-describedby="${esc(tooltipId)}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg><span class="map-tooltip" id="${esc(tooltipId)}" role="tooltip">${esc(tip)}</span></a>`:'';
}
function facilityName(x,context='card'){
  const url=officialUrl(x.officialUrl);
  if(context==='card'){
    const name=url?`<a class="facility-name facility-name-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(x.facility)}の公式サイト（新しいタブで開く）">${esc(x.facility)}</a>`:`<span class="facility-name">${esc(x.facility)}</span>`;
    return name;
  }
  // 詳細画面の施設名は、公式サイトが登録されていればその公式サイトへのリンクにする(新しいタブ)。登録済みのGoogle Mapsリンクは隣に配置する。
  if(url)return `<a class="facility-name facility-name-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(x.facility)}の公式サイト（新しいタブで開く）">${esc(x.facility)}<svg class="external-link-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M15 3h6v6M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg></a>`;
  return `<span class="facility-name">${esc(x.facility)}</span>`;
}
// Extend this registry with an ID, label and facility predicate for future scopes.
const PROGRESS_SCOPES = [
  {id:'all',label:'全施設',includes:()=>true},
  {id:'chi',label:'♨地・温泉',includes:x=>['現・旧','現（新規）','旧（掲載終了）'].includes(x.category)},
  {id:'kake',label:'源泉かけ流し',includes:x=>!!kakeEntry(x)},
  {id:'gensei',label:'源生の湯',includes:x=>genseiBaths(x).length>0}
];
function renderDashboard(){
  for(const scope of PROGRESS_SCOPES){
    const facilities=DATA.filter(scope.includes),done=facilities.filter(visited).length,tot=facilities.length,p=tot?Math.round(done/tot*1000)/10:0;
    const percent=$(scope.id==='all'?'totalPercent':'progress-'+scope.id+'-percent'),count=$(scope.id==='all'?'totalText':'progress-'+scope.id+'-count'),ring=$('progress-'+scope.id+'-ring');
    const percentText=p.toFixed(1)+'%',countText=done+' / '+tot+' 施設';
    if(percent.textContent!==percentText)percent.textContent=percentText;
    if(count.textContent!==countText)count.textContent=countText;
    ring.style.strokeDashoffset=String(100-p);ring.style.visibility=p?'visible':'hidden';
  }
}

function renderPrefs(){const prefs=[...new Set(DATA.map(x=>x.prefecture))];$('prefProgressMeta').textContent=prefs.length+'都道府県・'+DATA.length+'施設の訪問進捗';$('prefgrid').innerHTML=prefs.map(p=>{const a=DATA.filter(x=>x.prefecture===p),n=a.filter(visited).length,pct=Math.round(100*n/a.length);return `<button class="pref ${prefFilter===p?'selected':''}" data-pref="${esc(p)}"><strong>${esc(p)}</strong><span class="fraction">${n} / ${a.length} 施設 · ${pct}%</span><div class="mini"><i style="width:${pct}%"></i></div></button>`}).join('');$('prefgrid').querySelectorAll('[data-pref]').forEach(b=>b.onclick=()=>{prefFilter=prefFilter===b.dataset.pref?'':b.dataset.pref;$('prefSelect').value=prefFilter;visible=18;render();$('regional-progress').scrollIntoView({behavior:'smooth'})})}
// Display labels only; retain category values in the public master and saved data.
const categoryLabel=value=>({'現・旧':'地・温泉','現（新規）':'地・温泉','旧（掲載終了）':'地・温泉'}[value]||value);
// 施設カードの分類ラベル。見た目は「地♨」(読み上げ・ホバーは正式名「地・温泉」。現行認定・旧認定を区別しない)。内部の分類値と、フィルター・検索・集計の語は categoryLabel のまま
const categoryBadgeText=value=>({'現・旧':'地♨','現（新規）':'地♨','旧（掲載終了）':'地♨'}[value]||'');
function categoryBadge(x){const text=categoryBadgeText(x.category);if(!text)return x.category?'<span class="tag gold">'+esc(categoryLabel(x.category))+'</span>':'';const full='地・温泉';return '<span class="tag gold" role="img" aria-label="'+esc(full)+'" title="'+esc(full)+'">'+esc(text)+'</span>'}
// 日本秘湯を守る会の加盟宿(hitou-membership.js に載った施設だけ)。クリック・タップで団体の公式の加盟宿ページを開く
function hitouBadge(x){const m=(window.ONSEN_HITOU_MEMBERSHIP||{})[x.id],url=m&&officialUrl(m.url);return url?'<a class="tag gold hitou-tag" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer" title="日本秘湯を守る会 加盟宿" aria-label="日本秘湯を守る会 加盟宿(公式の加盟宿ページを新しいタブで開く)">秘♨</a>':''}
function filtered(){const q=$('search').value.trim().toLowerCase(),pr=prefFilter||$('prefSelect').value,st=$('statusSelect').value,cat=$('categorySelect').value;return DATA.filter(x=>(!q||[x.onsen,x.facility,x.springType,state.userData.visits[x.id]?.notes,x.category,categoryLabel(x.category),x.prefecture].join(' ').toLowerCase().includes(q))&&(!pr||x.prefecture===pr)&&(!cat||x.category===cat||categoryLabel(x.category)===cat)&&(!st||(st==='visited'?visited(x):!visited(x))))}
// Display-only groups, explicitly audited against the master. Never infer from name fragments.
const CARD_GROUPS = [
  {id:'nyuto',name:'乳頭温泉郷',prefecture:'秋田県',ids:['onsen-015','onsen-016']},
  {id:'takayu',name:'高湯温泉',prefecture:'福島県',ids:['onsen-034','onsen-035']},
  {id:'okukinu',name:'奥鬼怒温泉',prefecture:'栃木県',ids:['onsen-041','onsen-042']},
  {id:'shima',name:'四万温泉',prefecture:'群馬県',ids:['onsen-048','onsen-049']},
  {id:'kusatsu',name:'草津温泉',prefecture:'群馬県',ids:['onsen-050','onsen-051']}
];
function groupedCards(list){
  const groups=new Map();
  for(const x of list){
    const config=CARD_GROUPS.find(g=>g.ids.includes(x.id)&&g.prefecture===x.prefecture&&g.name===x.onsen);
    const key=config?config.id:x.id;
    if(!groups.has(key))groups.set(key,{id:key,name:config?config.name:x.onsen,prefecture:x.prefecture,facilities:[]});
    groups.get(key).facilities.push(x);
  }
  return [...groups.values()];
}
// 湯の色の丸。データは bath-colors.js(根拠が十分な色だけ)。施設カードと詳細画面の「代表的な湯」で同じ部品を使う。
// 無い施設・定義の無い色は何も出さない。同じ色は重複表示せず、最大3個。並びは資料の記載順。
const BATH_COLOR_LIMIT=3;
const EVIDENCE_NOTE={photo_inferred:'写真からの推定です',third_party_reported:'第三者資料の記載です'};
function bathColorText(c,def){
  const scope=c.scope==='bath'&&Array.isArray(c.scopeNames)&&c.scopeNames.length?'（'+c.scopeNames.join('・')+'）':c.scope==='facility'&&c.scopeLabel?'（'+c.scopeLabel+'）':'（施設全体）',parts=['湯の色: '+def.label+scope];
  if(c.expression&&c.expression!==def.label&&!c.listed&&c.role!=='variant')parts.push((c.evidence&&c.evidence.type&&c.evidence.type!=='official_text'?'資料の表現「':'公式の表現「')+c.expression+'」');
  if(c.change&&c.change.note)parts.push(c.change.note);
  const conf=c.evidence&&c.evidence.confidence;if(conf&&EVIDENCE_NOTE[conf])parts.push(EVIDENCE_NOTE[conf]);
  if(c.listed)parts.push('丸の並びは資料の記載順です');
  return parts.join('。')+'。';
}
function bathColorButtons(colors){
  const defs=window.ONSEN_COLOR_DEFS||{},seen=new Set(),list=(Array.isArray(colors)?colors:[]).filter(c=>{if(!c||!defs[c.color]||seen.has(c.color))return false;seen.add(c.color);return true}).slice(0,BATH_COLOR_LIMIT);
  if(!list.length)return '';
  return '<span class="bath-colors" role="group" aria-label="湯の色">'+list.map(c=>{const def=defs[c.color],text=bathColorText(c,def);return '<button type="button" class="bath-color" aria-label="'+esc(text)+'"><i class="bath-color-dot'+(def.hollow?' is-hollow':'')+'" style="--dot:'+esc(def.fill)+';--ring:'+esc(def.ring)+'" aria-hidden="true"></i><span class="bath-color-tip" role="tooltip" aria-hidden="true">'+esc(text)+'</span></button>'}).join('')+'</span>';
}
function bathColorEntry(x){const e=(window.ONSEN_BATH_COLORS||{})[x.id];return e&&Array.isArray(e.colors)?e.colors:[]}
// 施設カード: 施設で確認された湯色(施設全体・特定の浴槽)を左から並べる
function bathColorDots(x){return bathColorButtons(bathColorEntry(x))}
// 詳細画面: その湯について確認された色だけ(施設全体の色は個々の湯へ適用しない)
function bathColorDotsFor(x,bathName){return bathColorButtons(bathColorEntry(x).filter(c=>c.scope==='bath'&&Array.isArray(c.scopeNames)&&c.scopeNames.includes(bathName)))}
// 源泉かけ流しの波アイコン。データは kakenagashi.js(かけ流しを明記した記述だけ)。ツールチップ・操作は湯色の丸と共通。
const KAKE_WAVE='<svg class="kake-svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M1.5 3.5c1.5-1.8 3-1.8 4.5 0s3 1.8 4.5 0 3-1.8 4 0"/><path d="M1.5 8c1.5-1.8 3-1.8 4.5 0s3 1.8 4.5 0 3-1.8 4 0"/><path d="M1.5 12.5c1.5-1.8 3-1.8 4.5 0s3 1.8 4.5 0 3-1.8 4 0"/></svg>';
const GENSEI_DROP='<svg class="gensei-svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" stroke="none" aria-hidden="true" focusable="false"><path d="M8 1C6.8 2.9 3 6.8 3 10a5 5 0 0 0 10 0C13 6.8 9.2 2.9 8 1Z"/></svg>';
// Progress labels share the exact SVG artwork used by facility cards.
$('progress-kake-label').innerHTML='<span class="progress-label">源泉かけ流し'+KAKE_WAVE+'</span>';
$('progress-gensei-label').innerHTML='<span class="progress-label progress-help">源生の湯<button type="button" id="progressGenseiHelp" class="progress-help-button" aria-label="源生の湯の説明" aria-expanded="false" aria-controls="progressGenseiTip" aria-describedby="progressGenseiTip">'+GENSEI_DROP+'<span aria-hidden="true">ⓘ</span></button><span id="progressGenseiTip" class="progress-help-tip" role="tooltip" hidden>源泉かけ流しで、加水・加温なしが確認された湯。当サイト独自の分類です。</span></span>';
{
  const button=$('progressGenseiHelp'),tip=$('progressGenseiTip'),wrap=$('progress-gensei-label');
  const show=open=>{tip.hidden=!open;button.setAttribute('aria-expanded',String(open))};
  button.addEventListener('click',()=>show(tip.hidden));
  wrap.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')show(true)});
  wrap.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')show(false)});
  wrap.addEventListener('focusout',e=>{if(!wrap.contains(e.relatedTarget))show(false)});
  document.addEventListener('click',e=>{if(!wrap.contains(e.target))show(false)});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')show(false)});
}
function kakeButton(text){return '<span class="kake-wrap"><button type="button" class="kake-icon" aria-label="'+esc(text)+'">'+KAKE_WAVE+'<span class="bath-color-tip" role="tooltip" aria-hidden="true">'+esc(text)+'</span></button></span>'}
// 「源生の湯」(源泉かけ流し・加水なし・加温なし)の金色の水滴。認定は kakenagashi.js の表から自動計算(ONSEN_GENSEI)。深緑の波の右に並べる。
function genseiButton(text){return '<span class="gensei-wrap"><button type="button" class="gensei-icon" aria-label="'+esc(text)+'">'+GENSEI_DROP+'<span class="bath-color-tip" role="tooltip" aria-hidden="true">'+esc(text)+'</span></button></span>'}
function genseiBaths(x){const g=window.ONSEN_GENSEI;return g?g.certifiedBaths(kakeEntry(x)):[]}
function genseiForFacility(x){return genseiBaths(x).length?genseiButton('源生の湯の浴槽あり'):''}
function genseiForBath(x,bathName){return genseiBaths(x).includes(bathName)?genseiButton('源生の湯｜源泉かけ流し・加水なし・加温なし'):''}
function kakeEntry(x){return (window.ONSEN_KAKENAGASHI||{})[x.id]||null}
// 施設カード: 源泉かけ流しの浴槽が1つでも確認できる施設(施設全体とは断定しない)
function kakeForFacility(x){return kakeEntry(x)?kakeButton('源泉かけ流しの浴槽あり'):''}
// 詳細画面: その湯について確認できた場合だけ
function kakeForBath(x,bathName){const e=kakeEntry(x);return e&&Array.isArray(e.baths)&&e.baths.includes(bathName)?kakeButton('源泉かけ流し'):''}
function closeBathColorTips(except){document.querySelectorAll('.bath-color.is-open,.kake-icon.is-open,.gensei-icon.is-open').forEach(b=>{if(b!==except)b.classList.remove('is-open')})}
const VISIT_STAMP="<span class=\"onsen-stamp\" aria-hidden=\"true\"><svg width=\"66\" height=\"66\" viewBox=\"0 0 80 80\" fill=\"none\" aria-hidden=\"true\" focusable=\"false\"><circle cx=\"40\" cy=\"40\" r=\"36\" stroke=\"currentColor\" stroke-width=\"1\"/><svg x=\"16\" y=\"18\" width=\"48\" height=\"44\" fill=\"currentColor\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"-60 -60 2128 1830\"><path d=\"M1735 967Q1968 1081 1968 1261Q1968 1459 1743 1590Q1487 1739 1024 1739Q604 1739 351 1615Q80 1482 80 1259Q80 1080 313 967L369 1043Q299 1078 259 1134Q223 1186 223 1238Q223 1355 376 1451Q601 1592 1025 1592Q1408 1592 1633 1473Q1825 1372 1825 1237Q1825 1118 1679 1043ZM903 1344Q1014 1197 1014 1004Q1014 852 916 662Q823 482 823 333Q823 184 952 0L1041 37Q979 166 979 293Q979 432 1086 641Q1176 818 1176 974Q1176 1191 983 1387ZM504 1247Q584 1126 584 993Q584 869 494 684Q430 552 430 430Q430 291 551 121L631 156Q571 267 571 378Q571 503 653 670Q729 824 729 955Q729 1038 688 1130Q650 1217 582 1288ZM1352 1250Q1426 1133 1426 986Q1426 860 1348 709Q1258 534 1258 397Q1258 273 1346 127L1432 160Q1395 242 1395 346Q1395 483 1493 670Q1573 822 1573 948Q1573 1138 1434 1286Z\" fill=\"currentColor\" stroke=\"currentColor\" stroke-width=\"80\" stroke-linejoin=\"round\"/></svg></svg></span>";
function facilityRow(x){
  const info=visitInfo(x.id);
  return `<div class="facility-entry ${info.visited?'is-visited':'is-unvisited'}" data-facility-id="${esc(x.id)}" role="group" aria-label="${esc(x.facility)}: ${info.visited?'訪問済み':'未訪問'}"><div class="facility">${facilityName(x)}${bathColorDots(x)}${kakeForFacility(x)}${genseiForFacility(x)}${info.visited?'<span class="conquered-badge">制覇</span>':''}</div><div class="facility-meta">${facilityMap(x)}<button type="button" class="link facility-detail icon-text-link" data-detail="${esc(x.id)}" aria-label="${esc(x.facility)}の詳細を見る">詳細<svg class="external-link-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M15 3h6v6M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg></button>${categoryBadge(x)}${hitouBadge(x)}${x.springType?'<span class="tag">'+esc(x.springType)+'</span>':''}</div></div>`;
}
function renderCards(){
  const list=filtered(),groups=groupedCards(list);
  const completed=new Set(groupedCards(DATA).filter(g=>g.facilities.length>0&&g.facilities.every(visited)).map(g=>g.id));
  $('resultCount').textContent=`${list.length} 施設 · ${groups.length} 温泉地`;
  $('cards').innerHTML=groups.slice(0,visible).map(g=>`<article class="card${completed.has(g.id)?' is-complete':''}" data-group="${esc(g.id)}"${completed.has(g.id)?' aria-label="'+esc(g.name)+': 温泉地制覇"':''}><div class="card-top"></div><div class="card-content"><div class="tags"><span class="tag">${esc(g.prefecture)}</span></div><h3>${esc(g.name)}</h3><div class="facility-list">${g.facilities.map(facilityRow).join('')}</div></div>${completed.has(g.id)?VISIT_STAMP:''}</article>`).join('')||'<div class="panel empty">条件に合う温泉が見つかりませんでした。</div>';
  $('showMore').classList.toggle('hide',groups.length<=visible);
  document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>openDetail(b.dataset.detail));
}

const toggleBathColor=e=>{const b=e.target.closest('.bath-color,.kake-icon,.gensei-icon');if(!b)return;const open=!b.classList.contains('is-open');closeBathColorTips(b);b.classList.toggle('is-open',open)};$('cards').addEventListener('click',toggleBathColor);$('featureBathList').addEventListener('click',toggleBathColor);document.addEventListener('click',e=>{if(!e.target.closest('.bath-color,.kake-icon,.gensei-icon'))closeBathColorTips()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeBathColorTips()});
function render(){renderDashboard();renderPrefs();renderCards();$('visitMigration').hidden=!store.needsMigration();japanMap?.refresh();onsenMap?.refresh()}
function editable(){if(store.needsMigration()){showToast('旧記録のバックアップと移行を確認してください');return false}return true}
function toggleVisit(id){if(!DATA.some(x=>x.id===id)||!editable())return;const info=visitInfo(id);if(info.visited&&(info.visitCount>1||info.lastVisit)){openDetail(id);$('visitHeading').scrollIntoView({block:'nearest'});return}if(info.visited&&!confirm('日付不明の訪問記録を削除し、未訪問に戻しますか？'))return;try{state=store.setVisited(state,id,!info.visited);render();if(current===id)renderVisits();showToast(visited({id})?'訪問済み・日付不明として記録しました ♨':'未訪問に戻しました')}catch(err){showToast(err.message||'保存できませんでした。元の記録は変更していません。')}}
const visitTypeLabel=value=>({day:'日帰り',stay:'宿泊'}[value]||'');
let editingVisit=null,editingVisitBase=null;
$('memoSave').onclick=()=>{if(!current||!editable())return;try{state=store.setNotes(state,current,$('memoText').value);render();renderVisits();showToast('メモを保存しました')}catch(err){showToast(err.message||'メモを保存できませんでした。元の記録は変更していません。')}};
function selectPref(p){prefFilter=p;$('prefSelect').value=p;visible=18;render();if(!p)japanMap?.resetToInitialView()}
const japanMap=window.JapanPrefMap?.create({container:$('japanMap'),data:DATA,isVisited:visited,onDetail:openDetail,getSelectedPref:()=>prefFilter,onSelect:selectPref,onScrollToOnsens:()=>{$('onsens').scrollIntoView({behavior:'smooth'})}});
const onsenMap=window.OnsenMap?.create({data:DATA,isVisited:visited,getVisitInfo:visitInfo,onDetail:openDetail,getSelectedPref:()=>prefFilter,getStatus:()=>$('statusSelect').value,onSelect:selectPref,onStatus:s=>{$('statusSelect').value=s;visible=18;render()}});
function renderVisits(){const info=visitInfo(current),v=state.userData.visits[current],records=[...(v?.records||[])].sort((a,b)=>(b.date||'').localeCompare(a.date||''));$('visitSummary').textContent=(info.visited?'訪問済み':'未訪問')+' · 訪問'+info.visitCount+'回 · 最終訪問日：'+(info.lastVisit||'—')+(info.unknownCount?'（日付不明 '+info.unknownCount+'件）':'');$('visitMeta').innerHTML=[['初回訪問日',info.firstVisit||'—'],['訪問メモ',v?.notes||'—']].map(([a,b])=>`<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('');$('visitList').innerHTML=records.map(r=>`<li><div>${r.date?'<time datetime="'+esc(r.date)+'">'+esc(r.date)+'</time>':'<span>日付不明</span>'}${r.visitType?'<span class="visit-type">'+esc(visitTypeLabel(r.visitType))+'</span>':''}${r.legacyDate?'<small class="note">元の日付：'+esc(r.legacyDate)+'</small>':''}</div><div class="visit-row-actions"><button type="button" data-edit-visit="${esc(r.id)}" aria-label="${esc(r.date||'日付不明')}の訪問記録を編集">編集</button><button type="button" data-delete-visit="${esc(r.id)}" aria-label="${esc(r.date||'日付不明')}の訪問記録を削除">削除</button></div></li>`).join('')||'<li class="note">訪問記録はまだありません。</li>';$('visitList').querySelectorAll('[data-edit-visit]').forEach(b=>b.onclick=()=>showVisitForm(b.dataset.editVisit));$('visitList').querySelectorAll('[data-delete-visit]').forEach(b=>b.onclick=()=>{if(!editable()||!confirm('この訪問記録を削除しますか？'))return;try{state=store.deleteVisit(state,current,b.dataset.deleteVisit);$('visitForm').hidden=true;render();openDetail(current);showToast('訪問記録を削除しました')}catch(err){showToast(err.message)}});$('detailStamp').textContent=info.visited?'訪問記録を編集':'訪問済みにする';$('detailStamp').onclick=()=>{if(info.visited){$('visitHeading').scrollIntoView({block:'nearest'});$('visitAdd').focus()}else toggleVisit(current)}}
function showVisitForm(id=null){if(!editable())return;editingVisit=id;const record=id?state.userData.visits[current]?.records.find(r=>r.id===id):null;editingVisitBase=record?{date:record.date,visitType:record.visitType||''}:null;$('visitForm').hidden=false;$('visitDate').value=record?.date||'';$('visitType').value=record?.visitType||'';$('visitUnknown').checked=!!record&&record.date===null;$('visitDate').disabled=$('visitUnknown').checked;$('visitDate').required=!$('visitUnknown').checked;$('visitSave').textContent=id?'変更を保存':'訪問日を保存';$('visitError').textContent='';$('visitForm').scrollIntoView({block:'nearest'});($('visitUnknown').checked?$('visitUnknown'):$('visitDate')).focus()}
$('visitAdd').onclick=()=>showVisitForm();$('visitCancel').onclick=()=>{$('visitForm').hidden=true;editingVisit=null;$('visitAdd').focus()};$('visitUnknown').onchange=()=>{$('visitDate').disabled=$('visitUnknown').checked;$('visitDate').required=!$('visitUnknown').checked};$('visitForm').onsubmit=e=>{e.preventDefault();if(!editable())return;const date=$('visitUnknown').checked?null:$('visitDate').value;try{if(editingVisit){const latest=state.userData.visits[current]?.records.find(r=>r.id===editingVisit);if(!latest||latest.date!==editingVisitBase.date||(latest.visitType||'')!==editingVisitBase.visitType)throw Error('この訪問記録は更新されました。編集画面を開き直してください')}state=editingVisit?store.editVisit(state,current,editingVisit,date,$('visitType').value):store.addVisit(state,current,date,$('visitType').value);$('visitForm').hidden=true;editingVisit=null;render();openDetail(current);$('visitAdd').focus();showToast('訪問記録を保存しました')}catch(err){$('visitError').textContent=err.message}};
function downloadRecord(file,name){const blob=new Blob([JSON.stringify(file,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
$('migrationBackupBtn').onclick=()=>{try{downloadRecord(store.sourceBackup(),'温泉の旅-移行前の記録.json')}catch(err){showToast(err.message)}};$('migrationApplyBtn').onclick=()=>{if(!confirm('旧記録を残し、移行前の記録をブラウザ内にも退避して、新しい保存形式へ移行します。続けますか？'))return;try{state=store.migrate(state,true);render();if(current)renderVisits();showToast('訪問記録を移行しました')}catch(err){showToast(err.message)}};
// 「代表的な湯」。データは feature-baths.js(施設IDをキー)。無い施設ではセクションごと非表示。
const FEATURE_BATH_LIMIT=3,FEATURE_TAG_LIMIT=3;
function renderFeatureBaths(x){const box=$('featureBaths'),note=$('featureBathNote'),entry=(window.ONSEN_FEATURE_BATHS||{})[x.id],list=(entry&&Array.isArray(entry.baths)?entry.baths:[]).filter(b=>b&&b.name).slice(0,FEATURE_BATH_LIMIT);box.hidden=!list.length;note.hidden=!(list.length&&entry.note);note.textContent=list.length&&entry.note?entry.note:'';$('featureBathList').innerHTML=list.map(b=>{const meta=[b.kind,b.form].filter(Boolean).map(esc).join('<span aria-hidden="true"> · </span>'),tags=(Array.isArray(b.tags)?b.tags:[]).filter(Boolean).slice(0,FEATURE_TAG_LIMIT);return `<li class="feature-bath"><div class="feature-bath-head"><h4>${esc(b.name)}</h4>${bathColorDotsFor(x,b.name)}${kakeForBath(x,b.name)}${genseiForBath(x,b.name)}${meta?'<span class="feature-bath-meta">'+meta+'</span>':''}</div>${b.color?'<p class="feature-bath-color">湯の色 '+esc(b.color)+'</p>':''}${tags.length?'<ul class="feature-bath-tags">'+tags.map(t=>'<li class="tag'+(t==='名物'?' gold':'')+'">'+esc(t)+'</li>').join('')+'</ul>':''}${b.note?'<p class="feature-bath-note">'+esc(b.note)+'</p>':''}</li>`}).join('')}
function openDetail(id){const x=DATA.find(v=>v.id===id);if(!x)return;closeBathColorTips();current=id;$('modalTitle').textContent=x.onsen;$('modalSubtitle').innerHTML='<h2 class="facility" id="detailFacilityHeading">'+facilityName(x,'detail')+facilityMap(x,'detail')+'</h2>';let details=[['日帰り入浴',x.bathing||'未確認'],['最寄り駅',x.station||'未登録']];$('detailList').innerHTML=details.map(([a,b])=>`<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('');renderFeatureBaths(x);$('memoText').value=state.userData.visits[id]?.notes||'';$('detailBook').href=bookUrl(x);$('detailStamp').textContent=visited(x)?'訪問済みを解除':'訪問済みにする';$('detailStamp').onclick=()=>toggleVisit(id);$('visitForm').hidden=true;editingVisit=null;renderVisits();$('modalBg').style.display='flex'}function closeDetail(){$('modalBg').style.display='none';current=null}
const prefs=(window.JapanPrefMap?.PREFECTURES.map(x=>x.name)||[...new Set(DATA.map(x=>x.prefecture))]).filter(p=>DATA.some(x=>x.prefecture===p)),cats=[...new Set(DATA.map(x=>categoryLabel(x.category)))];$('prefSelect').innerHTML+=[...prefs].map(x=>`<option>${esc(x)}</option>`).join('');$('categorySelect').innerHTML+=cats.map(x=>`<option>${esc(x)}</option>`).join('');['search','prefSelect','statusSelect','categorySelect'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',()=>{visible=18;prefFilter=$('prefSelect').value;render()}));$('resetPref').onclick=()=>{prefFilter='';$('prefSelect').value='';render();japanMap?.resetToInitialView()};$('clearFilter').onclick=()=>{$('search').value='';$('prefSelect').value='';$('statusSelect').value='';$('categorySelect').value='';prefFilter='';visible=18;render()};$('showMore').onclick=()=>{visible+=18;renderCards()};$('modalClose').onclick=closeDetail;$('modalBg').onclick=e=>{if(e.target===$('modalBg'))closeDetail()};document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDetail()});$('loginBtn').onclick=()=>{if(window.OnsenAuth&&window.OnsenAuth.enabled())return;showToast('Googleログインは次の開発段階で追加します。現在は端末内保存です。')};$('exportBtn').onclick=()=>{try{downloadRecord(store.needsMigration()?store.sourceBackup():store.backup(state),'温泉の旅-訪問記録.json')}catch(err){showToast(err.message)}};$('importBtn').onclick=()=>$('importFile').click();$('importFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const j=JSON.parse(await f.text());const next=store.prepareImport(j,state);if(!confirm('現在の記録を置き換えます。置き換え前の記録はブラウザ内に退避します。移行用ファイルでは旧チェック変更を反映します。続けますか？'))return;state=store.replace(next,state,true);render();if(current)openDetail(current);showToast('訪問記録を復元しました')}catch(err){showToast(err.message||'復元できませんでした')}finally{e.target.value=''}};if(store.hasLegacy())$('migrationNote').hidden=false;render();window.OnsenHost={store,getState:()=>state,setState:s=>{state=s;render();if(current)renderVisits()},backup:()=>store.backup(state),download:(file,name)=>downloadRecord(file,name),toast:showToast,facilityName:id=>(DATA.find(x=>x.id===id)||{}).facility||id};
})();
