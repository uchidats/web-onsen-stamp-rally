const test=require('node:test'),assert=require('node:assert/strict');
require('../records.js');const R=globalThis.OnsenRecords;
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v))}};
test('Visit types are optional, independent per visit, editable without changing IDs, dates or notes, and validated',()=>{
 const storage=memory(),repo=R.create(storage);let s=repo.load();
 for(const type of ['', 'day','stay'])s=repo.addVisit(s,'onsen-020','2026-10-21',type);
 const records=s.userData.visits['onsen-020'].records,ids=records.map(r=>r.id);
 assert.equal(new Set(ids).size,3);assert.deepEqual(records.map(r=>r.visitType||''),['','day','stay']);
 s=repo.transform(s,u=>{u.visits['onsen-020'].records[1].notes='訪問メモ';u.visits['onsen-020'].notes='施設メモ'});
 s=repo.editVisit(s,'onsen-020',ids[1],'2026-10-21','stay');
 s=repo.editVisit(s,'onsen-020',ids[1],'2026-10-20'); // old callers preserve the type
 assert.equal(s.userData.visits['onsen-020'].records[1].visitType,'stay');
 assert.equal(s.userData.visits['onsen-020'].records[1].notes,'訪問メモ');
 assert.deepEqual(s.userData.visits['onsen-020'].records.map(r=>r.id),ids);
 assert.equal(s.userData.visits['onsen-020'].visitCount,3);assert.equal(R.summary(s.userData.visits['onsen-020']).visited,true);
 s=repo.editVisit(s,'onsen-020',ids[1],'2026-10-20','');assert.equal(s.userData.visits['onsen-020'].records[1].visitType,undefined);
 const raw=storage.getItem(R.KEY);for(const invalid of ['overnight',null,true,{},1]){assert.throws(()=>repo.addVisit(s,'onsen-020',null,invalid));assert.throws(()=>repo.editVisit(s,'onsen-020',ids[0],null,invalid));assert.equal(storage.getItem(R.KEY),raw)}
 const reloaded=R.create(storage).load();assert.deepEqual(reloaded,s);
 const backup=repo.backup(s),restored=repo.prepareImport(JSON.parse(JSON.stringify(backup)),s);assert.deepEqual(restored,s);assert.equal(backup.format,'onsen-stamp-rally-v3');
 const malformed=JSON.parse(JSON.stringify(backup));malformed.userData.visits['onsen-020'].records[0].visitType='invalid';assert.throws(()=>repo.prepareImport(malformed,s));assert.equal(storage.getItem(R.KEY),raw);
});
test('Pre-feature v3 and legacy v2 backups restore with unset type without inventing visits or losing metadata',()=>{
 const repo=R.create(memory());let s=repo.addVisit(repo.load(),'onsen-001',null);const id=s.userData.visits['onsen-001'].records[0].id;
 const file=repo.backup(s);assert.ok(!Object.hasOwn(file.userData.visits['onsen-001'].records[0],'visitType'));assert.equal(repo.prepareImport(file,s).userData.visits['onsen-001'].records[0].id,id);
 const v2={format:'onsen-stamp-rally-v2',userData:{schemaVersion:2,visits:{'onsen-020':{visited:true,visitDates:['2020-01-02',null],notes:'旧メモ'}},rankings:[],rankingVisibility:'private',gpsStamps:[]}};
 const next=repo.prepareImport(v2,s);assert.equal(next.userData.visits['onsen-020'].records.length,2);assert.ok(next.userData.visits['onsen-020'].records.every(r=>!r.visitType));assert.equal(next.userData.visits['onsen-020'].notes,'旧メモ');
 s=repo.transform(s,u=>{u.visits['onsen-001'].records[0].legacyDate='昔の不明日付'});
 s=repo.editVisit(s,'onsen-001',id,null,'stay');assert.equal(s.userData.visits['onsen-001'].records[0].legacyDate,'昔の不明日付');
});
