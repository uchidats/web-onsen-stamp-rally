/* Storage adapter: replace create(storage) with a cloud repository after authentication. */
(function(root){'use strict';
const KEY='onsen-rally-user-v2',LEGACY='onsen-rally-visits-v1',SAFETY='onsen-rally-before-restore-v2';
const copy=x=>JSON.parse(JSON.stringify(x));
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
function validateVisits(visits){
 if(!object(visits))throw Error('訪問記録の形式が正しくありません');
 for(const [id,v] of Object.entries(visits)){
  if(!/^onsen-[a-zA-Z0-9-]+$/.test(id)||!object(v)||typeof v.visited!=='boolean')throw Error('訪問記録の形式が正しくありません');
  if(v.visitCount!==undefined&&(!Number.isInteger(v.visitCount)||v.visitCount<0))throw Error('訪問回数が正しくありません');
  for(const k of ['firstVisit','lastVisit','notes'])if(v[k]!=null&&typeof v[k]!=='string')throw Error('訪問情報が正しくありません');
 }
}
function validate(state){
 if(!object(state)||state.schemaVersion!==2)throw Error('未対応の保存形式です');
 validateVisits(state.visits);
 if(!Array.isArray(state.rankings)||!Array.isArray(state.gpsStamps)||!['private','public'].includes(state.rankingVisibility))throw Error('個人データの形式が正しくありません');
}
function create(storage){
 let blocked=false;
 const empty=()=>({userData:{schemaVersion:2,visits:{},rankings:[],rankingVisibility:'private',gpsStamps:[]}});
 function check(state){validate(state.userData);if(state.legacyBaseline)validateVisits(state.legacyBaseline)}
 function load(){try{const raw=storage.getItem(KEY);if(raw===null)return empty();const state=JSON.parse(raw);check(state);return state}catch(e){blocked=true;throw e}}
 function persist(state){if(blocked)throw Error('既存データを復元してから変更してください');check(state);storage.setItem(KEY,JSON.stringify(state));return state}
 function legacy(){const raw=storage.getItem(LEGACY);if(raw===null)return {};const values=JSON.parse(raw);if(!object(values)||Object.values(values).some(v=>typeof v!=='boolean'))throw Error('旧チェック記録が不正です。元データは保持しています');return values}
 function applyOverrides(baseline,overrides){const result=copy(baseline);for(const [id,v] of Object.entries(overrides)){if(!/^onsen-[a-zA-Z0-9-]+$/.test(id)||typeof v!=='boolean')throw Error('旧バックアップが不正です');result[id]={...result[id],visited:v}}return result}
 function prepareImport(file,current){
  if(!object(file))throw Error('正しいバックアップファイルではありません');
  if(file.format==='onsen-stamp-rally-v1'){
   if(!object(file.overrides))throw Error('旧バックアップが不正です');
   if(!current.legacyBaseline)throw Error('旧版のバックアップは変更分のみです。先に移行用バックアップを復元してください');
   const next=copy(current);next.userData.visits=applyOverrides(next.legacyBaseline,file.overrides);check(next);return next;
  }
  if(file.format!=='onsen-stamp-rally-v2')throw Error('未対応のバックアップ形式です');
  const next={userData:copy(file.userData)};
  if(file.legacyBaseline)next.legacyBaseline=copy(file.legacyBaseline);
  check(next);
  if(file.migration===true){if(!next.legacyBaseline)throw Error('移行元の記録がありません');next.userData.visits=applyOverrides(next.legacyBaseline,legacy())}
  return next;
 }
 return {empty,load,hasLegacy:()=>storage.getItem(LEGACY)!==null,
  setVisited(state,id,value){const next=copy(state);next.userData.visits[id]={...next.userData.visits[id],visited:value};return persist(next)},
  backup(state){check(state);return {format:'onsen-stamp-rally-v2',exportedAt:new Date().toISOString(),...copy(state)}},
  prepareImport,
  replace(next,current){check(next);const existing=storage.getItem(KEY);storage.setItem(SAFETY,existing===null?JSON.stringify(current):existing);blocked=false;try{return persist(next)}catch(e){blocked=true;throw e}}
 };
}
root.OnsenRecords={create,KEY,LEGACY,SAFETY};
})(typeof window==='undefined'?globalThis:window);
