const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c={window:{}};vm.runInNewContext(fs.readFileSync('data.js','utf8'),c);const data=c.window.ONSEN_DATA;
require('../map.js');const M=globalThis.OnsenMap,audit=JSON.parse(fs.readFileSync('assets/coordinates.json','utf8'));
assert.equal(data.length,67);assert.equal(new Set(data.map(x=>x.id)).size,67);assert.equal(audit.rows.length,67);
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
assert.equal(original40.length,40);
for(const original of original40){const x=data.find(x=>x.id===original.id);for(const key of Object.keys(original))assert.equal(x[key],original[key],original.id+' preserves '+key);assert.equal(x.coordinateVerified,true);}
for(const [id,[name,lat,lon]] of Object.entries(additions)){const x=data.find(x=>x.id===id);assert.equal(x.facility,name);assert.equal(x.latitude,lat);assert.equal(x.longitude,lon);assert.equal(x.coordinateVerified,true);assert.match(x.coordinateSource,/^https:\/\/www\.openstreetmap\.org\/(node|way)\/\d+$/);}
function inside(p,ring){let result=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;}
for(const [i,x] of data.entries()){
  assert.equal(x.id,'onsen-'+String(i+1).padStart(3,'0'));assert.equal(x.coordinateCheckedAt,additions[x.id]?'2026-10-13':'2026-10-11');
  const r=audit.rows.find(r=>r.id===x.id);assert.equal(r.coordinateCheckedAt,x.coordinateCheckedAt);
  assert.equal(r.latitude,x.latitude);assert.equal(r.longitude,x.longitude);assert.equal(r.coordinateSource,x.coordinateSource);
  assert.equal(r.previousLatitude,additions[x.id]?null:x.latitude);assert.equal(r.previousLongitude,additions[x.id]?null:x.longitude);
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
assert.equal(data.filter(M.verified).length,49);assert.equal(data.filter(x=>!M.verified(x)).length,18);
assert.equal(audit.attribution,'© OpenStreetMap contributors');assert.equal(audit.license,'ODbL-1.0');
const ids=['onsen-002','onsen-003','onsen-004','onsen-005'];assert.deepEqual(Array.from(M.selection(data,'','青森県',()=>false),x=>x.id),ids);
for(const id of ids){const x=data.find(x=>x.id===id);assert.equal(M.selection(data,'visited','青森県',r=>r.id===id)[0].id,id);}
console.log('PASS: 67 fixed IDs, original 40 coordinates unchanged, exactly 9 additions, 49 OSM matches/footprints, 18 excluded unknowns, dates, WGS84 order, selection and no personal data');
