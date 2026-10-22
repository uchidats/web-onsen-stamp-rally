const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c={window:{}};vm.runInNewContext(fs.readFileSync('data.js','utf8'),c);const data=c.window.ONSEN_DATA;
// Historical coordinate fixtures retain the former display name; only this name was corrected.
const historicalValue=(row,key)=>row.id==='onsen-020'&&key==='facility'?'源泉・秘湯の宿 ふけの湯':row[key];
require('../map.js');const M=globalThis.OnsenMap,audit=JSON.parse(fs.readFileSync('assets/coordinates.json','utf8'));
assert.equal(data.length,68);assert.equal(new Set(data.map(x=>x.id)).size,68);assert.equal(audit.rows.length,68);
const added1022=new Set(['onsen-068']); // 2026-10-22に追加(増富温泉 不老閣)。既存67施設は変更しない
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
for(const expected of currentAdditions){const x=data.find(x=>x.id===expected.id);for(const key of ['id','facility','latitude','longitude','coordinateSource','coordinateVerified','coordinateCheckedAt','coordinateLicense'])assert.equal(x[key],expected[key]);if(expected.sourceId)assert.equal(x.coordinateSourceId,expected.sourceId);if(expected.sourceRelease)assert.equal(x.coordinateSourceRelease,expected.sourceRelease);}
assert.equal(original40.length,40);
for(const original of original40){const x=data.find(x=>x.id===original.id);for(const key of Object.keys(original))assert.equal(x[key],historicalValue(original,key),original.id+' preserves '+key);assert.equal(x.coordinateVerified,true);}
for(const [id,[name,lat,lon]] of Object.entries(additions)){const x=data.find(x=>x.id===id);assert.equal(x.facility,name);assert.equal(x.latitude,lat);assert.equal(x.longitude,lon);assert.equal(x.coordinateVerified,true);assert.match(x.coordinateSource,/^https:\/\/www\.openstreetmap\.org\/(node|way)\/\d+$/);}
function inside(p,ring){let result=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;}
for(const [i,x] of data.entries()){
  const current=currentAdditions.some(a=>a.id===x.id);
  assert.equal(x.id,'onsen-'+String(i+1).padStart(3,'0'));assert.equal(x.coordinateCheckedAt,added1022.has(x.id)?'2026-10-22':current?'2026-10-14':additions[x.id]?'2026-10-13':'2026-10-11');
  const r=audit.rows.find(r=>r.id===x.id);assert.equal(r.coordinateCheckedAt,x.coordinateCheckedAt);
  assert.equal(r.latitude,x.latitude);assert.equal(r.longitude,x.longitude);assert.equal(r.coordinateSource,x.coordinateSource);
  const fresh=added1022.has(x.id)||current||additions[x.id];assert.equal(r.previousLatitude,fresh?null:x.latitude);assert.equal(r.previousLongitude,fresh?null:x.longitude);
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
assert.equal(data.filter(M.verified).length,68);assert.equal(data.filter(x=>!M.verified(x)).length,0);
assert.match(audit.attribution,/OpenStreetMap contributors/);assert.match(audit.license,/ODbL-1.0.*CDLA-Permissive-2.0.*Apache-2.0/);
for(const a of currentAdditions){const r=audit.rows.find(r=>r.id===a.id);assert.equal(r.coordinateLicense,a.coordinateLicense);assert.equal(r.googleCoordinatesStored,false);if(a.coordinateLicense!=='ODbL-1.0'){assert.match(r.coordinateSource,/stac\.overturemaps\.org/);assert.match(r.sourceId,/^[a-f0-9-]{36}$/);assert.equal(Object.hasOwn(r,'osmName'),false);}}
for(const file of ['CDLA-Permissive-2.0.txt','Apache-2.0.txt','Foursquare-NOTICE.txt'])assert.ok(fs.readFileSync('assets/licenses/'+file,'utf8').length>1000);
const ids=['onsen-002','onsen-003','onsen-004','onsen-005'];assert.deepEqual(Array.from(M.selection(data,'','青森県',()=>false),x=>x.id),ids);
for(const id of ids){const x=data.find(x=>x.id===id);assert.equal(M.selection(data,'visited','青森県',r=>r.id===id)[0].id,id);}
console.log('PASS: 68 fixed IDs (onsen-068 added 2026-10-22), existing 67 unchanged, 68 verified / 0 excluded, dates, footprint membership, attribution, WGS84 order and no personal data');
