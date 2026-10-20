/* Leaflet adapter; personal state stays in records.js. No geolocation requests. */
(function(root){'use strict';
const JAPAN=[[24,122],[46,146]];
const config={tileUrl:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | 温泉位置: <a href="assets/coordinate-credits.html" target="_blank" rel="noopener noreferrer">Overture / Meta / Foursquare・利用条件</a>'};
const checkedDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const verified=x=>x.coordinateVerified===true&&Number.isFinite(x.latitude)&&Number.isFinite(x.longitude)&&x.latitude>=-90&&x.latitude<=90&&x.longitude>=-180&&x.longitude<=180&&typeof x.coordinateSource==='string'&&/^https?:\/\//.test(x.coordinateSource)&&checkedDate(x.coordinateCheckedAt);
function selection(data,status,pref,isVisited){return data.filter(x=>verified(x)&&(!pref||x.prefecture===pref)&&(!status||(status==='visited'?isVisited(x):!isVisited(x))))}
// Regional viewport centers only; never used to position facility markers.
const centers=[[43.3,142.5],[40.7,140.8],[39.6,141.4],[38.4,140.9],[39.7,140.4],[38.4,140.1],[37.4,140.2],[36.3,140.3],[36.7,139.8],[36.5,138.9],[36,139.4],[35.5,140.2],[35.7,139.5],[35.4,139.3],[37.5,138.9],[36.6,137.2],[36.7,136.8],[35.9,136.2],[35.6,138.6],[36.2,138],[35.8,137],[35.1,138.3],[35,137.1],[34.5,136.4],[35.2,136.1],[35.2,135.5],[34.6,135.5],[35,134.8],[34.3,135.9],[33.9,135.5],[35.4,133.8],[35.1,132.6],[34.8,133.8],[34.5,132.8],[34.2,131.5],[33.9,134.3],[34.3,134],[33.7,132.9],[33.5,133.4],[33.6,130.7],[33.3,130.1],[33.1,129.5],[32.6,130.7],[33.2,131.4],[32.2,131.3],[31.6,130.6],[26.3,127.8]];
function prefBounds(pref){const i=root.JapanPrefMap.PREFECTURES.findIndex(p=>p.name===pref),c=centers[i];if(i===46)return [[24,122.9],[27.9,131.4]];if(i===45)return [[27,128.3],[32.4,131.3]];if(i===12)return [[24,138],[35.9,142.3]];if(i===41)return [[32.5,128.5],[34.8,130.4]];const d=i===0?2.5:0.75;return c?[[c[0]-d,c[1]-d],[c[0]+d,c[1]+d]]:JAPAN}
let libraries;
function loadLibraries(){if(libraries)return libraries;const css=href=>{if(document.querySelector('link[data-map-css="'+href+'"]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href=href;l.dataset.mapCss=href;document.head.appendChild(l)};const script=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>{s.remove();reject(Error('地図を読み込めませんでした。もう一度お試しください。'))};document.head.appendChild(s)});css('vendor/leaflet/leaflet.css');if(root.L)return Promise.resolve();libraries=(async()=>{if(!root.L)await script('vendor/leaflet/leaflet.js')})().catch(e=>{libraries=null;throw e});return libraries}
function create({data,isVisited,onDetail,getVisitInfo,getSelectedPref,getStatus,onSelect,onStatus}){
// 県別地図の施設マーカーの形。試作: 'spring'(♨のSVG) / 'dot'(従来の丸)。'dot' に変えるだけで従来の丸へ戻る(CSSは .onsen-map-marker--spring 配下だけ)。全国地図(japan-map.js)は別実装で影響しない。
const MARKER_STYLE='spring';
// ♨のパスは design.css の .onsen-map-marker--spring にマスクとして固定(文字要素は使わない)。
{const f=()=>document.querySelector('.map-legend')?.classList.toggle('is-spring',MARKER_STYLE==='spring');document.readyState==='loading'?document.addEventListener('DOMContentLoaded',f):f()}
const MARKER_VARIANT=MARKER_STYLE==='spring'?{cls:' onsen-map-marker--spring',html:'<span aria-hidden="true"></span>'}:{cls:'',html:'<span aria-hidden="true"></span>'};
const $=id=>document.getElementById(id);let map=null,markerLayer=null,loading=false,markers=new Map(),lastPref=null,tiles=null,tileTimer=null,tileErrors=0;
function report(rows){const pref=getSelectedPref(),regional=data.filter(x=>!pref||x.prefecture===pref),count=regional.filter(verified).length;$('mapUnverifiedCount').parentElement.hidden=regional.length===count;$('mapCount').textContent='表示 '+rows.length+'施設 / 座標確認済み '+count+'施設';$('mapUnverifiedCount').textContent='位置確認中 '+(regional.length-count)+'施設（全国 '+data.filter(x=>!verified(x)).length+'施設）';$('mapUnverified').replaceChildren();for(const x of regional.filter(x=>!verified(x))){const li=document.createElement('li'),b=document.createElement('button');b.type='button';b.textContent=x.facility+'（'+x.prefecture+'）';b.onclick=()=>onDetail(x.id);li.append(b);$('mapUnverified').append(li)}}
function refresh(fit=false){const status=getStatus(),pref=getSelectedPref();const changed=lastPref!==pref;lastPref=pref;$('japanMap').hidden=!!pref;$('prefectureMap').hidden=!pref;$('mapHeading').textContent=pref+'の温泉マップ';$('mapPref').value=pref;$('mapStatus').value=status;fit=fit||changed;const rows=selection(data,status,pref,isVisited);report(rows);$('mapEmpty').hidden=rows.length>0;if(!pref)return;if(!map){activate();return}map.invalidateSize({pan:false});clearChooser();markerLayer.clearLayers();markers=new Map();for(const x of rows){const done=isVisited(x);const m=root.L.marker([x.latitude,x.longitude],{title:x.facility+'・'+(done?'訪問済み':'未訪問'),alt:x.facility,keyboard:true,icon:root.L.divIcon({className:'onsen-map-marker '+(done?'is-visited':'is-unvisited')+MARKER_VARIANT.cls,html:MARKER_VARIANT.html,iconSize:[44,44],iconAnchor:[22,22],popupAnchor:[0,-12]})});const showDetail=()=>{clearChooser();onDetail(x.id)};m.on('click',showDetail);m.on('keypress',e=>{if(e.originalEvent.key==='Enter'||e.originalEvent.keyCode===13)showDetail()});m.on('add',()=>{const e=m.getElement();if(e){e.dataset.onsenId=x.id;e.setAttribute('aria-label',x.facility+'・'+(done?'訪問済み':'未訪問'));e.setAttribute('role','button')}});markers.set(x.id,m);markerLayer.addLayer(m)}if(fit){const regional=data.filter(x=>verified(x)&&(!pref||x.prefecture===pref));if(pref&&regional.length)map.fitBounds(root.L.latLngBounds(regional.map(x=>[x.latitude,x.longitude])),{padding:[36,36],maxZoom:13,animate:false});else map.fitBounds(prefBounds(pref),{padding:[36,36],animate:false})}}
// 県別地図のタッチ操作: ♨の当たり判定(24px円)の外でも、マーカー中心から TAP_RADIUS px 以内のタップを受け付ける。
// ブラウザのタッチ補正(近くの押せる要素へ勝手にタップを振り替える)に任せず、押した生の座標から自分で判定する。
//   円(半径 TAP_HIT)の内側: 従来どおり、その点で一番手前に描かれたマーカー(円が重なる所も従来と同じ) / 円の外で候補が1施設: その施設 / 候補が複数: 選択リスト(どの施設も勝手に選ばない)。
// タッチだけが対象。マウス・キーボード・パン・ピンチ(クリックにならない操作)・ズームボタン・ポップアップ内の操作には触れない。
const TAP_RADIUS=22,TAP_HIT=12;let touchDown=null;
function clearChooser(){document.getElementById('mapNearbyChoices')?.remove()}
function openChooser(near){clearChooser();const box=document.createElement('div');box.id='mapNearbyChoices';box.className='regional-map-choices';box.setAttribute('role','group');box.setAttribute('aria-label','近くの温泉施設');const title=document.createElement('strong');title.textContent='近くの温泉施設（'+near.length+'件）';const list=document.createElement('ul');list.className='map-choice-list';for(const c of near){const x=data.find(v=>v.id===c.id),li=document.createElement('li'),b=document.createElement('button');b.type='button';b.textContent=x.facility+'（'+(isVisited(x)?'訪問済み':'未訪問')+'）';b.onclick=()=>{clearChooser();onDetail(c.id)};li.append(b);list.append(li)}box.append(title,list);$('mapCanvas').insertAdjacentElement('afterend',box);box.scrollIntoView({block:'nearest'});list.querySelector('button')?.focus({preventScroll:true})}
function onTouchClick(ev){const d=touchDown;touchDown=null;if(!map||!d||d.moved||Date.now()-d.t>1000)return;if(ev.target.closest&&ev.target.closest('.leaflet-control,.leaflet-popup'))return;
  const p=map.mouseEventToContainerPoint({clientX:d.x,clientY:d.y}),near=[...markers].map(([id,m])=>({id,m,d:p.distanceTo(map.latLngToContainerPoint(m.getLatLng()))})).filter(c=>c.d<=TAP_RADIUS).sort((a,b)=>a.d-b.d);if(!near.length)return;
  const top=document.elementFromPoint(d.x,d.y),topId=top&&top.closest&&top.closest('.onsen-map-marker')?.dataset.onsenId,direct=topId&&near.find(c=>c.id===topId&&c.d<=TAP_HIT),target=direct||(!near.some(c=>c.d<=TAP_HIT)&&near.length===1?near[0]:null);ev.stopPropagation();ev.preventDefault();
  if(target){clearChooser();onDetail(target.id)}else openChooser(near)}
function watchTouch(){const el=map.getContainer();
  el.addEventListener('pointerdown',ev=>{touchDown=ev.pointerType==='touch'?{x:ev.clientX,y:ev.clientY,t:Date.now(),moved:false}:null},true);
  el.addEventListener('pointermove',ev=>{if(touchDown&&Math.hypot(ev.clientX-touchDown.x,ev.clientY-touchDown.y)>10)touchDown.moved=true},true);
  el.addEventListener('pointercancel',()=>{touchDown=null},true);el.addEventListener('keydown',()=>{touchDown=null},true);
  el.addEventListener('click',onTouchClick,true)}
function tileNotice(message){$('mapTileNotice').hidden=false;$('mapTileNotice').textContent=message;$('mapRetryBtn').hidden=false;}
function watchTiles(){clearTimeout(tileTimer);tileErrors=0;tileTimer=setTimeout(()=>tileNotice('背景地図の読み込みに時間がかかっています。ネットワーク接続を確認して再読み込みしてください。施設マーカーと詳細は利用できます。'),12000);}
function attachTiles(){
  if(!['http:','https:'].includes(location.protocol)){
    tileNotice('ファイルを直接開いているため背景地図は表示できません。VS Codeでindex.htmlを右クリックし「Open with Live Server」で開くか、GitHub Pagesの公開URLを利用してください。URLがhttp://localhostまたはhttp://127.0.0.1で始まることを確認してください。');
    return;
  }
  if(tiles)map.removeLayer(tiles);
  $('mapTileNotice').hidden=true;$('mapRetryBtn').hidden=true;
  tiles=root.L.tileLayer(config.tileUrl,{maxZoom:19,attribution:config.attribution,updateWhenIdle:true,keepBuffer:1});
  tiles.on('loading',watchTiles);
  tiles.on('tileerror',()=>{tileErrors++;tileNotice('背景地図を取得できませんでした。ネットワーク接続やブラウザの通信制限を確認し、背景地図を再読み込みしてください。施設マーカーと詳細は利用できます。');});
  tiles.on('load',()=>{clearTimeout(tileTimer);if(!tileErrors){$('mapTileNotice').hidden=true;$('mapRetryBtn').hidden=true;}});
  watchTiles();tiles.addTo(map);
}
async function activate(){
  if(map){map.invalidateSize({pan:false});return;}
  if(loading)return;loading=true;$('mapLoadBtn').disabled=true;$('mapLoadBtn').textContent='地図を読み込み中…';
  try{
    await loadLibraries();$('mapCanvas').hidden=false;
    map=root.L.map('mapCanvas',{scrollWheelZoom:false,tap:true,zoomControl:true,minZoom:3,maxZoom:19});
    map.attributionControl.addAttribution(config.attribution);
    // Keep every facility visible at its verified coordinate, at every zoom level.
    markerLayer=root.L.layerGroup();
    map.addLayer(markerLayer);$('mapIdle').hidden=true;
    if(MARKER_STYLE==='spring')watchTouch();
    // Size and prefecture bounds must be established before requesting background tiles.
    refresh(true);map.invalidateSize({pan:false});attachTiles();
  }catch(e){
    if(map){map.remove();map=null;markerLayer=null;tiles=null;}
    $('mapIdle').hidden=false;tileNotice(e.message);$('mapLoadBtn').textContent='地図を再読み込み';
  }finally{loading=false;$('mapLoadBtn').disabled=false;}
}
$('mapRetryBtn').onclick=()=>{if(map){map.invalidateSize({pan:false});attachTiles();}else activate();};
$('mapPref').innerHTML+=root.JapanPrefMap.PREFECTURES.map(p=>{const o=document.createElement('option');o.value=p.name;o.textContent=p.name;return o.outerHTML}).join('');$('mapPref').onchange=()=>onSelect($('mapPref').value);$('mapStatus').onchange=()=>onStatus($('mapStatus').value);$('mapReset').onclick=()=>onSelect('');$('mapLoadBtn').onclick=activate;
const resize=()=>{if(map&&getSelectedPref()){map.invalidateSize({pan:false});refresh(true)}};if(root.ResizeObserver)new root.ResizeObserver(resize).observe($('mapCanvas'));root.addEventListener('resize',resize);refresh();
return {activate,refresh};}
root.OnsenMap={create,verified,selection,config};
})(typeof window==='undefined'?globalThis:window);
