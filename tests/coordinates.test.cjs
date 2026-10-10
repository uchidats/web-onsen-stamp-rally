const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c={window:{}};vm.runInNewContext(fs.readFileSync('data.js','utf8'),c);const data=c.window.ONSEN_DATA;
require('../map.js');const M=globalThis.OnsenMap,audit=JSON.parse(fs.readFileSync('assets/coordinates.json','utf8'));
assert.equal(data.length,67);assert.equal(new Set(data.map(x=>x.id)).size,67);assert.equal(audit.rows.length,67);
function inside(p,ring){let result=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;}
for(const [i,x] of data.entries()){
  assert.equal(x.id,'onsen-'+String(i+1).padStart(3,'0'));assert.equal(x.coordinateCheckedAt,'2026-10-11');
  const r=audit.rows.find(r=>r.id===x.id);assert.equal(r.coordinateCheckedAt,x.coordinateCheckedAt);
  assert.equal(r.latitude,x.latitude);assert.equal(r.longitude,x.longitude);assert.equal(r.coordinateSource,x.coordinateSource);
  assert.equal(r.previousLatitude,x.latitude);assert.equal(r.previousLongitude,x.longitude);
  assert.equal(M.verified(x),x.coordinateVerified);
  if(x.coordinateVerified){
    assert.ok(x.latitude>24&&x.latitude<46&&x.longitude>122&&x.longitude<146,'WGS84 Japan bounds; catch swapped/projected coordinates');
    assert.ok(r.addressReference.startsWith('http'));assert.ok(!r.address.startsWith('未確認'));
    if(r.geometry.type==='Point'){assert.equal(r.geometry.coordinates[0],x.longitude);assert.equal(r.geometry.coordinates[1],x.latitude);}
    else assert.ok(inside([x.longitude,x.latitude],r.geometry.coordinates[0]),x.id+' must be inside its facility footprint');
  }else{assert.equal(x.latitude,null);assert.equal(x.longitude,null);assert.equal(x.coordinateSource,'');}
  for(const key of ['visits','visitCount','lastVisit','notes'])assert.equal(Object.hasOwn(x,key),false);
}
assert.equal(data.filter(M.verified).length,40);assert.equal(data.filter(x=>!M.verified(x)).length,27);
const ids=['onsen-002','onsen-003','onsen-004','onsen-005'];assert.deepEqual(Array.from(M.selection(data,'','青森県',()=>false),x=>x.id),ids);
for(const id of ids){const x=data.find(x=>x.id===id);assert.equal(M.selection(data,'visited','青森県',r=>r.id===id)[0].id,id);}
console.log('PASS: 67 fixed IDs, 40 OSM coordinate matches/footprints, 27 excluded unknowns, checked dates, WGS84 order, map selection IDs and no personal data');
