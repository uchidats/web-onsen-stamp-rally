const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c={window:{}};vm.runInNewContext(fs.readFileSync('data.js','utf8'),c);const data=c.window.ONSEN_DATA;
// Historical coordinate fixtures retain the former display name; only this name was corrected.
// 2026-11-26: Overture removed the 2026-09-23.1 STAC catalog (60-day retention); only the citation URL was changed, to the official release notes of the same release.
const OVERTURE_OLD='https://stac.overturemaps.org/2026-09-23.1/catalog.json',OVERTURE_SOURCE='https://docs.overturemaps.org/blog/2026/09/23/release-notes/';
const historicalValue=(row,key)=>row.id==='onsen-020'&&key==='facility'?'源泉・秘湯の宿 ふけの湯':key==='coordinateSource'&&row[key]===OVERTURE_OLD?OVERTURE_SOURCE:row[key];
require('../map.js');const M=globalThis.OnsenMap,audit=JSON.parse(fs.readFileSync('assets/coordinates.json','utf8'));
assert.equal(data.length,112);assert.equal(new Set(data.map(x=>x.id)).size,112);assert.equal(audit.rows.length,112);
const added1022=new Set(['onsen-068']); // 2026-10-22に追加(増富温泉 不老閣)。既存67施設は変更しない
const added1102=new Set(['onsen-069']); // 2026-11-02に追加(奈良田温泉 白根館)。既存68施設は変更しない
const added1108=new Set(['onsen-079','onsen-080','onsen-081','onsen-082','onsen-083','onsen-084','onsen-085','onsen-086','onsen-087','onsen-088','onsen-089','onsen-090','onsen-091','onsen-092','onsen-093']); // 2026-11-08に追加(十勝岳温泉 湯元 凌雲閣、横向温泉 滝川屋旅館、上笹橋温泉 東北温泉、豊富温泉 ニュー温泉閣ホテル、松代温泉 黄金の湯 松代荘、須川温泉 栗駒山荘、豊富温泉 川島旅館、乳頭温泉郷 黒湯温泉、仙仁温泉 花仙庵 岩の湯、白骨温泉 泡の湯旅館、三斗小屋温泉 煙草屋旅館・大黒屋旅館、七味温泉 紅葉館(座標未確定)、川渡温泉 山ふところの宿 みやま、青荷温泉 ランプの宿 青荷温泉)
const added1128=new Set(['onsen-110','onsen-111','onsen-112']); // 2026-11-28に追加(下風呂温泉 海峡の湯、川湯温泉 湯吉、コタンの湯)
const added1126=new Set(['onsen-109']); // 2026-11-26に追加(登別温泉 夢元さぎり湯)
const added1125=new Set(['onsen-108']); // 2026-11-25に追加(かみのやま温泉 下大湯共同浴場)
const added1124=new Set(['onsen-104','onsen-105','onsen-106','onsen-107']); // 2026-11-24に追加(喜連川早乙女温泉、野沢温泉の外湯 大湯・真湯・滝の湯)
const added1123=new Set(['onsen-103']); // 2026-11-23に追加(見市温泉旅館)
const added1122=new Set(['onsen-101','onsen-102']); // 2026-11-22に追加(蔵王温泉 すのこの湯 かわらや、丸美ヶ丘温泉ホテル)
const added1121=new Set(['onsen-098','onsen-099','onsen-100']); // 2026-11-21に追加(登別温泉 第一滝本館、豊富温泉 豊富町ふれあいセンター、帯広温泉 ローマの泉)
const added1120=new Set(['onsen-095','onsen-096','onsen-097']); // 2026-11-20に追加(加賀井温泉 一陽館、奥蓼科温泉 渋・辰野館、新津温泉)
const added1115=new Set(['onsen-094']); // 2026-11-15に追加(棧温泉 棧温泉旅館)
const added1107=new Set(['onsen-078']); // 2026-11-07に追加(蓮華温泉 白馬岳蓮華温泉ロッジ)
const added1106=new Set(['onsen-076','onsen-077']); // 2026-11-06に追加(伊東温泉 東海館・ケイズハウス伊東温泉)
const added1105=new Set(['onsen-074','onsen-075']); // 2026-11-05に追加(いわき湯本温泉 松柏館・旅館こいと)
const added1103=new Set(['onsen-070','onsen-071','onsen-072','onsen-073']); // 2026-11-03に追加(草津温泉 山本館、伊豆の湯本館・山の家・観音温泉)。既存69施設は変更しない
const additions={
  'onsen-006':['峡雲荘',39.8727646,140.9247795],
  'onsen-018':['後生掛温泉旅館',39.9720906,140.8003011],
  'onsen-026':['時音の宿 湯主一條',38.024627,140.574897],
  'onsen-034':['旅館玉子湯',37.7525452,140.3096465],
  'onsen-035':['安達屋旅館',37.7525827,140.3043635],
  'onsen-042':['八丁の湯',36.8722605,139.3983249],
  'onsen-054':['ランプの宿高峰温泉',36.410002,138.459569],
  'onsen-057':['湯元齋藤旅館',36.155515,137.625026],
  'onsen-065':['大牧温泉観光旅館',36.5004964,136.9941115]
};
const original40=JSON.parse(fs.readFileSync('tests/fixtures/verified-coordinates-2026-10-11.json','utf8'));
const original49=JSON.parse(fs.readFileSync('tests/fixtures/verified-coordinates-2026-10-13.json','utf8'));
const currentAdditions=JSON.parse(fs.readFileSync('tests/fixtures/verified-coordinates-2026-10-14.json','utf8'));
assert.equal(original49.length,49);assert.equal(currentAdditions.length,18);
const beforeFinal=JSON.parse(fs.readFileSync('tests/fixtures/verified-coordinates-before-ishizuka-2026-10-14.json','utf8'));
assert.equal(beforeFinal.length,66);
for(const original of beforeFinal){const x=data.find(x=>x.id===original.id);for(const key of Object.keys(original))assert.equal(x[key],historicalValue(original,key),original.id+' remains unchanged by final addition');}
for(const original of original49){const x=data.find(x=>x.id===original.id);for(const key of Object.keys(original))assert.equal(x[key],historicalValue(original,key),original.id+' preserves '+key);}
for(const expected of currentAdditions){const x=data.find(x=>x.id===expected.id);for(const key of ['id','facility','latitude','longitude','coordinateSource','coordinateVerified','coordinateCheckedAt','coordinateLicense'])assert.equal(x[key],historicalValue(expected,key));if(expected.sourceId)assert.equal(x.coordinateSourceId,expected.sourceId);if(expected.sourceRelease)assert.equal(x.coordinateSourceRelease,expected.sourceRelease);}
assert.equal(original40.length,40);
for(const original of original40){const x=data.find(x=>x.id===original.id);for(const key of Object.keys(original))assert.equal(x[key],historicalValue(original,key),original.id+' preserves '+key);assert.equal(x.coordinateVerified,true);}
for(const [id,[name,lat,lon]] of Object.entries(additions)){const x=data.find(x=>x.id===id);assert.equal(x.facility,name);assert.equal(x.latitude,lat);assert.equal(x.longitude,lon);assert.equal(x.coordinateVerified,true);assert.match(x.coordinateSource,/^https:\/\/www\.openstreetmap\.org\/(node|way)\/\d+$/);}
function inside(p,ring){let result=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;}
for(const [i,x] of data.entries()){
  const current=currentAdditions.some(a=>a.id===x.id);
  assert.equal(x.id,'onsen-'+String(i+1).padStart(3,'0'));assert.equal(x.coordinateCheckedAt,added1128.has(x.id)?'2026-11-28':added1126.has(x.id)?'2026-11-26':added1125.has(x.id)?'2026-11-25':added1124.has(x.id)?'2026-11-24':added1123.has(x.id)?'2026-11-23':added1122.has(x.id)?'2026-11-22':added1121.has(x.id)?'2026-11-21':added1120.has(x.id)?'2026-11-20':added1115.has(x.id)?'2026-11-15':added1108.has(x.id)?'2026-11-08':added1107.has(x.id)?'2026-11-07':added1106.has(x.id)?'2026-11-06':added1105.has(x.id)?'2026-11-05':added1103.has(x.id)?'2026-11-03':added1102.has(x.id)?'2026-11-02':added1022.has(x.id)?'2026-10-22':current?'2026-10-14':additions[x.id]?'2026-10-13':'2026-10-11');
  const r=audit.rows.find(r=>r.id===x.id);assert.equal(r.coordinateCheckedAt,x.coordinateCheckedAt);
  assert.equal(r.latitude,x.latitude);assert.equal(r.longitude,x.longitude);assert.equal(r.coordinateSource,x.coordinateSource);
  const fresh=added1128.has(x.id)||added1126.has(x.id)||added1125.has(x.id)||added1124.has(x.id)||added1123.has(x.id)||added1122.has(x.id)||added1121.has(x.id)||added1120.has(x.id)||added1115.has(x.id)||added1108.has(x.id)||added1107.has(x.id)||added1106.has(x.id)||added1105.has(x.id)||added1103.has(x.id)||added1102.has(x.id)||added1022.has(x.id)||current||additions[x.id];assert.equal(r.previousLatitude,fresh?null:x.latitude);assert.equal(r.previousLongitude,fresh?null:x.longitude);
  assert.equal(r.coordinateVerified,x.coordinateVerified);
  assert.equal(M.verified(x),x.coordinateVerified);
  if(x.coordinateVerified){
    assert.ok(x.latitude>24&&x.latitude<46&&x.longitude>122&&x.longitude<146,'WGS84 Japan bounds; catch swapped/projected coordinates');
    assert.ok(r.addressReference.startsWith('http'));assert.ok(!r.address.startsWith('未確認'));
    if(r.geometry.type==='Point'){assert.equal(r.geometry.coordinates[0],x.longitude);assert.equal(r.geometry.coordinates[1],x.latitude);}
    else assert.ok(inside([x.longitude,x.latitude],r.geometry.coordinates[0]),x.id+' must be inside its facility footprint');
  }else{assert.equal(x.latitude,null);assert.equal(x.longitude,null);assert.equal(x.coordinateSource,'');}
  for(const key of ['visits','visitCount','lastVisit','notes'])assert.equal(Object.hasOwn(x,key),false);
}
assert.equal(data.filter(M.verified).length,111);assert.equal(data.filter(x=>!M.verified(x)).map(x=>x.id).join(','),'onsen-091');
for(const id of ['onsen-106','onsen-107','onsen-110']){const r=audit.rows.find(r=>r.id===id);assert.equal(r.googleCoordinatesStored,false);assert.ok(['ODbL-1.0','PDL-1.0'].includes(r.coordinateLicense));}
assert.match(fs.readFileSync('assets/coordinate-credits.html','utf8'),/Microsoft ML Buildings[\s\S]*地理院タイル/);
{const x=data.find(x=>x.id==='onsen-091'),r=audit.rows.find(r=>r.id==='onsen-091');assert.equal(x.facility,'紅葉館');assert.equal(x.coordinateVerified,false);assert.equal(x.latitude,null);assert.equal(x.longitude,null);assert.equal(x.coordinateSource,'');assert.match(x.mapUrl,/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);assert.equal(r.geometry,null);assert.equal(r.googleCoordinatesStored,false);assert.equal(r.address,'長野県上高井郡高山村大字牧2974-45');}
{const rows=data.filter(x=>x.coordinateSource===OVERTURE_SOURCE);assert.equal(rows.length,25);for(const x of rows){assert.equal(x.coordinateSourceRelease,'2026-09-23.1');assert.match(x.coordinateSourceId,/^[a-f0-9-]{36}$/);}assert.ok(!data.some(x=>x.coordinateSource.includes('stac.overturemaps.org')));}
assert.match(audit.attribution,/OpenStreetMap contributors/);{const r=audit.rows.find(r=>r.id==='onsen-112');assert.equal(r.sourceRelease,'2026-11-18.0');assert.equal(r.coordinateSource,'https://docs.overturemaps.org/blog/2026/11/18/release-notes/');assert.equal(r.googleCoordinatesStored,false);}
assert.match(audit.license,/ODbL-1.0.*CDLA-Permissive-2.0.*Apache-2.0/);
for(const a of currentAdditions){const r=audit.rows.find(r=>r.id===a.id);assert.equal(r.coordinateLicense,a.coordinateLicense);assert.equal(r.googleCoordinatesStored,false);if(a.coordinateLicense!=='ODbL-1.0'){assert.equal(r.coordinateSource,OVERTURE_SOURCE);assert.match(r.sourceId,/^[a-f0-9-]{36}$/);assert.equal(Object.hasOwn(r,'osmName'),false);}}
for(const file of ['CDLA-Permissive-2.0.txt','Apache-2.0.txt','Foursquare-NOTICE.txt'])assert.ok(fs.readFileSync('assets/licenses/'+file,'utf8').length>1000);
const ids=['onsen-002','onsen-003','onsen-004','onsen-005','onsen-081','onsen-093','onsen-110'];assert.deepEqual(Array.from(M.selection(data,'','青森県',()=>false),x=>x.id),ids);
for(const id of ids){const x=data.find(x=>x.id===id);assert.equal(M.selection(data,'visited','青森県',r=>r.id===id)[0].id,id);}
console.log('PASS: 112 fixed IDs (onsen-068 added 2026-10-22, onsen-069 added 2026-11-02, onsen-070〜073 added 2026-11-03, onsen-074〜075 added 2026-11-05, onsen-076〜077 added 2026-11-06, onsen-078 added 2026-11-07, onsen-079〜093 added 2026-11-08, onsen-094 added 2026-11-15, onsen-095〜097 added 2026-11-20, onsen-098〜100 added 2026-11-21, onsen-101〜102 added 2026-11-22, onsen-103 added 2026-11-23, onsen-104〜107 added 2026-11-24, onsen-108 added 2026-11-25, onsen-109 added 2026-11-26, onsen-110〜112 added 2026-11-28), existing 69 unchanged, 111 verified / 1 pending (onsen-091, no coordinates), dates, footprint membership, attribution, WGS84 order and no personal data');
