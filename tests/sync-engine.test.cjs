const test = require('node:test');
const assert = require('node:assert/strict');
require('../records.js');
require('../sync-core.js');
require('../sync-engine.js');
require('./helpers/fake-cloud.cjs');
const { OnsenRecords: R, OnsenSyncEngine: E, OnsenSyncCore: C, FakeCloud } = globalThis;

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _m: m }; };
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(r => setImmediate(r)); };

// 1台の端末(PC/Android)。ローカルは本物のrecords.js(localStorage相当)、クラウドは共有のFakeCloud
function device(cloud, name, uid = 'user-1', storage = mem()) {
  const repo = R.create(storage);
  const adapter = cloud.adapter(), d = { name, storage, repo, statuses: [], uid, adapter };
  d.state = repo.load();
  d.engine = E.create({ repo, getState: () => d.state, setState: s => { d.state = s; }, storage, uid, projectId: 'test', adapter, debounceMs: 0, afterStale: async () => { await settle(); }, isOnline: () => cloud.online, onStatus: s => d.statuses.push(s) });
  d.add = (fid, date) => { d.state = repo.addVisit(d.state, fid, date); d.engine.notifyLocalChange('change'); };
  d.remove = (fid, i) => { d.state = repo.deleteVisit(d.state, fid, d.state.userData.visits[fid].records[i].id); d.engine.notifyLocalChange('change'); };
  d.edit = (fid, i, date, visitType) => { d.state = repo.editVisit(d.state, fid, d.state.userData.visits[fid].records[i].id, date, visitType); d.engine.notifyLocalChange('change'); };
  d.note = (fid, text) => { d.state = repo.setNotes(d.state, fid, text); d.engine.notifyLocalChange('change'); };
  d.visits = fid => (d.state.userData.visits[fid]?.records || []).map(r => r.date);
  d.count = () => Object.values(d.state.userData.visits).reduce((n, v) => n + v.records.length, 0);
  d.last = () => d.statuses.at(-1);
  d.begin = async () => { await d.engine.start(); await settle(); };
  d.join = async () => { await d.begin(); await d.engine.consent(); await settle(); };
  return d;
}
const flush = async (...ds) => { for (let i = 0; i < 3; i++) { for (const d of ds) await d.engine.syncNow(); await settle(); } };

test('automatic pre-sync backup is read back; quota, denied reads and silent writes block all cloud writes and can be retried',async t=>{
 for(const failure of ['quota','silent','read']){
  const cloud=new FakeCloud(),pc=device(cloud,failure);t.after(()=>pc.engine.stop());pc.add('onsen-001',null);await pc.begin();
  const before=pc.storage.getItem(R.KEY),set=pc.storage.setItem,get=pc.storage.getItem;
  pc.storage.setItem=(k,v)=>{if(k===E.SAFE_KEY){if(failure==='quota')throw Object.assign(Error('quota'),{name:'QuotaExceededError'});if(failure==='silent')return;}return set(k,v)};
  pc.storage.getItem=k=>{if(failure==='read'&&k===E.SAFE_KEY)throw Object.assign(Error('denied'),{name:'SecurityError'});return get(k)};
  await assert.rejects(()=>pc.engine.consent(),{code:'backup-failed'});assert.equal(pc.last().backupFailed,true);assert.equal(cloud.writes,0);assert.equal(get(R.KEY),before);
  pc.storage.setItem=set;pc.storage.getItem=get;await pc.engine.retry();assert.equal(pc.last().state,'consent');await pc.engine.consent();await flush(pc);assert.equal(pc.last().state,'synced');assert.equal(JSON.parse(get(E.SAFE_KEY)).raw,before);
 }
});

test('consent is single-flight and offline or permission errors keep records safe until explicit retry',async t=>{
 const cloud=new FakeCloud(),pc=device(cloud,'pc');t.after(()=>pc.engine.stop());pc.add('onsen-001',null);await pc.begin();const raw=pc.storage.getItem(R.KEY);
 cloud.online=false;await assert.rejects(()=>pc.engine.consent(),{code:'unavailable'});assert.equal(pc.last().state,'offline');assert.equal(cloud.root,null);assert.equal(pc.storage.getItem(R.KEY),raw);
 cloud.online=true;const original=pc.adapter.ensureRoot;pc.adapter.ensureRoot=async()=>{throw {code:'permission-denied'}};await assert.rejects(()=>pc.engine.consent(),{code:'permission-denied'});assert.equal(pc.last().state,'error');assert.equal(cloud.root,null);
 let release,calls=0;pc.adapter.ensureRoot=async options=>{calls++;await new Promise(r=>release=r);return original(options)};
 const first=pc.engine.consent(),second=pc.engine.consent();assert.equal(first,second);release();await Promise.all([first,second]);await flush(pc);assert.equal(calls,1);assert.equal(pc.last().state,'synced');assert.equal(pc.count(),1);
});

test('a terminated listener needs resubscription, not just another diff pass; retry resumes without reload and preserves deletion gates',async t=>{
 const cloud=new FakeCloud(),pc=device(cloud,'pc'),other=device(cloud,'other');t.after(()=>{pc.engine.stop();other.engine.stop()});await pc.join();await other.join();
 pc.engine.stop();const original=pc.adapter.subscribe;let subscriptions=0;
 pc.adapter.subscribe=(data,error)=>{subscriptions++;if(subscriptions===1){queueMicrotask(()=>error({code:'permission-denied'}));return ()=>{}}return original(data,error)};
 await pc.engine.start();await settle();assert.equal(pc.last().state,'error');other.add('onsen-006',null);await flush(other);
 await pc.engine.syncNow();assert.equal(pc.count(),0,'A diff pass cannot revive a terminated subscription');assert.equal(pc.last().state,'error');await pc.engine.retry();await settle();await flush(pc);assert.equal(subscriptions,2);assert.equal(pc.count(),1);assert.equal(pc.last().state,'synced');
 await other.adapter.deleteAll();await settle();await pc.engine.retry();await settle();assert.equal(pc.last().state,'cloudReset');assert.equal(cloud.visits.size,0);assert.equal(pc.count(),1);
});

test('a successful write cannot hide a simultaneous terminated-listener error; retry verifies and finishes without reload',async t=>{
 const cloud=new FakeCloud(),pc=device(cloud,'pc');t.after(()=>pc.engine.stop());let fail;const subscribe=pc.adapter.subscribe,push=pc.adapter.push;
 pc.adapter.subscribe=(data,error)=>{fail=error;return subscribe(data,error)};await pc.join();
 pc.adapter.push=async op=>{const result=await push(op);fail({code:'permission-denied'});return result};pc.add('onsen-001',null);await flush(pc);
 assert.equal(cloud.visits.size,1,'The record was actually committed');assert.equal(pc.count(),1);assert.equal(pc.last().state,'error','The connection error must not be replaced by synced');
 pc.adapter.push=push;await pc.engine.retry();await settle();await flush(pc);assert.equal(pc.last().state,'synced');assert.equal(cloud.visits.size,1);
});

test('known cloud deletion survives removing sync bookkeeping; renewed upload still requires explicit backed-up consent',async t=>{
 const cloud=new FakeCloud(),storage=mem(),pc=device(cloud,'pc','user-1',storage);t.after(()=>pc.engine.stop());await pc.join();pc.add('onsen-001',null);await flush(pc);await pc.adapter.deleteAll();await settle();
 E.rememberDeletion(storage,'user-1','test');pc.engine.forgetSyncState();const again=device(cloud,'again','user-1',storage);t.after(()=>again.engine.stop());await again.begin();
 assert.equal(again.last().state,'consent');assert.equal(again.last().summary.restart,true);assert.equal(cloud.root,null);assert.equal(cloud.visits.size,0);
 await again.engine.consent();await flush(again);assert.equal(again.count(),1);assert.equal(cloud.visits.size,1);assert.ok(storage.getItem(E.SAFE_KEY));
 const stranger=device(new FakeCloud(),'stranger','other-user',storage);t.after(()=>stranger.engine.stop());await stranger.begin();assert.equal(stranger.last().summary.restart,false);
});

test('visit type survives bidirectional sync, offline reload/retry, backup restore and independent date edits',async t=>{
 const cloud=new FakeCloud(),pc=device(cloud,'pc'),android=device(cloud,'android');t.after(()=>{pc.engine.stop();android.engine.stop()});
 await pc.join();await android.join();pc.add('onsen-020','2026-10-21');pc.add('onsen-020',null);await flush(pc,android);
 const id=pc.state.userData.visits['onsen-020'].records[0].id;
 pc.edit('onsen-020',0,'2026-10-21','day');android.edit('onsen-020',0,'2026-10-20');await flush(pc,android,pc);
 for(const d of [pc,android]){const r=d.state.userData.visits['onsen-020'].records[0];assert.equal(r.id,id);assert.equal(r.visitType,'day');assert.equal(r.date,'2026-10-20');assert.equal(d.engine.openConflicts().length,0)}
 cloud.online=false;android.edit('onsen-020',1,null,'stay');await flush(android);assert.equal(android.state.userData.visits['onsen-020'].records[1].visitType,'stay');
 android.engine.stop();const restarted=device(cloud,'restarted','user-1',android.storage);t.after(()=>restarted.engine.stop());
 assert.equal(restarted.state.userData.visits['onsen-020'].records[1].visitType,'stay');cloud.online=true;cloud.loseNextResponse=true;await restarted.engine.start();await flush(restarted,pc,restarted);
 assert.equal(pc.state.userData.visits['onsen-020'].records[1].visitType,'stay');assert.equal(cloud.visits.size,2);
 const backup=restarted.repo.backup(restarted.state),next=restarted.repo.prepareImport(JSON.parse(JSON.stringify(backup)),restarted.state);
 restarted.state=restarted.repo.replace(next,restarted.state,true);restarted.engine.notifyLocalChange('replace');await flush(restarted,pc);
 assert.deepEqual(restarted.state.userData.visits['onsen-020'].records,pc.state.userData.visits['onsen-020'].records);
 restarted.edit('onsen-020',1,null,'');await flush(restarted,pc);assert.equal(pc.state.userData.visits['onsen-020'].records[1].visitType,undefined);
});

test('restoring a pre-feature backup holds the newer cloud visit type as a conflict instead of erasing it',async t=>{
 const cloud=new FakeCloud(),pc=device(cloud,'pc');t.after(()=>pc.engine.stop());await pc.join();pc.add('onsen-020','2026-10-21');await flush(pc);
 const backup=pc.repo.backup(pc.state),id=pc.state.userData.visits['onsen-020'].records[0].id;
 pc.edit('onsen-020',0,'2026-10-21','stay');await flush(pc);
 pc.state=pc.repo.replace(pc.repo.prepareImport(backup,pc.state),pc.state,true);pc.engine.notifyLocalChange('replace');await flush(pc);
 const c=pc.engine.openConflicts()[0];assert.ok(c.field.includes('visitType'));assert.equal(JSON.parse(c.remote).visitType,'stay');
 assert.equal(cloud.visits.get(id).visitType,'stay');await pc.engine.resolveConflict(c.id,'remote');await flush(pc);assert.equal(pc.state.userData.visits['onsen-020'].records[0].visitType,'stay');
});

for(const choice of ['local','remote'])test('different visit types keep both choices until explicit '+choice+' resolution',async t=>{
 const cloud=new FakeCloud(),pc=device(cloud,'pc'),android=device(cloud,'android');t.after(()=>{pc.engine.stop();android.engine.stop()});
 await pc.join();await android.join();pc.add('onsen-020',null);await flush(pc,android);
 pc.engine.stop();android.engine.stop();pc.edit('onsen-020',0,null,'day');android.edit('onsen-020',0,null,'stay');
 await pc.engine.start();await flush(pc);await android.engine.start();await flush(android,pc);
 const c=android.engine.openConflicts()[0];assert.ok(c.field.split(',').includes('visitType'));assert.equal(JSON.parse(c.local).visitType,'stay');assert.equal(JSON.parse(c.remote).visitType,'day');
 assert.equal(android.state.userData.visits['onsen-020'].records[0].visitType,'stay');
 await assert.rejects(()=>android.engine.resolveConflict(c.id,'merge'),/訪問形態/);
 await android.engine.resolveConflict(c.id,choice);await flush(android,pc,android);
 for(const d of [pc,android])assert.equal(d.state.userData.visits['onsen-020'].records[0].visitType,choice==='local'?'stay':'day');
});

test('stopping while a conflict write is pending cannot apply queued cloud changes to local records', async () => {
  const cloud = new FakeCloud(), pc = device(cloud, 'pc'), android = device(cloud, 'android');
  await pc.join(); await android.join();
  pc.add('onsen-001', '2026-01-10'); await flush(pc, android);
  pc.engine.stop(); android.engine.stop();
  pc.note('onsen-001', 'PC'); android.note('onsen-001', 'Android');
  await pc.engine.start(); await flush(pc);
  let release, entered;
  const enteredPromise = new Promise(r => { entered = r; });
  const orig = android.adapter.createConflict;
  android.adapter.createConflict = async c => { entered(); await new Promise(r => { release = r; }); return orig(c); };
  await android.engine.start(); await enteredPromise;
  const before = android.storage.getItem(R.KEY);
  android.engine.stop(); release(); await settle();
  assert.equal(android.storage.getItem(R.KEY), before);
  assert.equal(android.state.userData.visits['onsen-001'].notes, 'Android');
});

test('cached client rejected by new Rules keeps local visits, same-day duplicates and notes for a reload', async () => {
  const cloud = new FakeCloud(), pc = device(cloud, 'pc');
  await pc.join();
  pc.engine.stop();
  pc.add('onsen-001', '2026-01-10'); pc.add('onsen-001', '2026-01-10'); pc.add('onsen-006', null); pc.note('onsen-001', '端末のメモ');
  pc.adapter.push = async () => { throw Object.assign(Error('new Rules reject old protocol'), { code: 'permission-denied' }); };
  const before = pc.storage.getItem(R.KEY);
  await pc.engine.start(); await flush(pc);
  assert.equal(pc.last().state, 'error');
  assert.equal(pc.storage.getItem(R.KEY), before);
  assert.equal(pc.count(), 3);
  assert.equal(pc.repo.backup(pc.state).userData.visits['onsen-001'].notes, '端末のメモ');
  pc.engine.stop();
});

test('PC adds a visit -> it appears on Android; Android adds -> PC (both directions, same account)', async () => {
  const cloud = new FakeCloud(), pc = device(cloud, 'pc'), android = device(cloud, 'android');
  await pc.join(); await android.join();
  pc.add('onsen-001', '2026-01-10'); await flush(pc, android);
  assert.deepEqual(android.visits('onsen-001'), ['2026-01-10']);
  android.add('onsen-006', '2026-02-02'); await flush(android, pc);
  assert.deepEqual(pc.visits('onsen-006'), ['2026-02-02']);
  assert.equal(pc.last().state, 'synced'); assert.equal(android.last().state, 'synced');
  // 同じ訪問は同じIDで、両端末で同数
  assert.equal(pc.count(), 2); assert.equal(android.count(), 2);
});

test('concurrent adds of the same facility and the same day are both kept (no date-based dedup); null dates are kept too', async () => {
  const cloud = new FakeCloud(), pc = device(cloud, 'pc'), android = device(cloud, 'android');
  await pc.join(); await android.join();
  pc.add('onsen-001', '2026-03-03'); android.add('onsen-001', '2026-03-03');
  pc.add('onsen-001', null); android.add('onsen-001', null);
  await flush(pc, android, pc);
  for (const d of [pc, android]) {
    assert.equal(d.visits('onsen-001').filter(x => x === '2026-03-03').length, 2, d.name);
    assert.equal(d.visits('onsen-001').filter(x => x === null).length, 2, d.name);
    assert.equal(d.count(), 4);
  }
  assert.equal(cloud.visits.size, 4);
  // 達成率は訪問済み施設数のまま(件数ではない)
  assert.equal(Object.values(pc.state.userData.visits).filter(v => v.records.length).length, 1);
});

test('offline: records can be added locally and are synced when the connection returns (nothing is lost)', async () => {
  const cloud = new FakeCloud(), pc = device(cloud, 'pc'), android = device(cloud, 'android');
  await pc.join(); await android.join();
  cloud.online = false;
  android.add('onsen-009', '2026-04-01'); android.add('onsen-009', '2026-04-02');
  await android.engine.syncNow();
  assert.equal(android.last().state, 'offline');
  assert.equal(android.count(), 2); assert.equal(cloud.visits.size, 0);
  cloud.online = true; cloud.emit(); await flush(android, pc);
  assert.equal(cloud.visits.size, 2);
  assert.deepEqual(pc.visits('onsen-009').sort(), ['2026-04-01', '2026-04-02']);
  assert.equal(android.last().state, 'synced');
});

test('delete is propagated; a record deleted elsewhere does not come back from a stale device', async () => {
  const cloud = new FakeCloud(), pc = device(cloud, 'pc'), android = device(cloud, 'android');
  await pc.join(); await android.join();
  pc.add('onsen-001', '2026-05-05'); pc.add('onsen-001', '2026-05-06'); await flush(pc, android);
  const idx = android.visits('onsen-001').indexOf('2026-05-05');
  android.remove('onsen-001', idx); await flush(android, pc);
  assert.deepEqual(pc.visits('onsen-001'), ['2026-05-06']);
  const doc = [...cloud.visits.values()].find(d => d.date === '2026-05-05');
  assert.equal(doc.status, 'deleted'); // tombstone が残る(物理削除しない)
  // 何度同期しても復活しない
  await flush(pc, android, pc, android);
  assert.deepEqual(pc.visits('onsen-001'), ['2026-05-06']); assert.deepEqual(android.visits('onsen-001'), ['2026-05-06']);
  assert.equal(cloud.visits.get(doc.eventId).status, 'deleted');
});

test('a stale device that edited a record deleted elsewhere gets a conflict, not a silent resurrection or loss', async () => {
  const cloud = new FakeCloud(), pc = device(cloud, 'pc'), android = device(cloud, 'android');
  await pc.join(); await android.join();
  pc.add('onsen-001', '2026-06-01'); await flush(pc, android);
  android.adapter.offline = true;
  android.edit('onsen-001', 0, '2026-06-09');          // Androidはオフラインで編集
  pc.remove('onsen-001', 0); await flush(pc);          // PCが削除
  android.adapter.offline = false; cloud.emit(); await flush(android, pc);
  const c = android.engine.openConflicts();
  assert.equal(c.length, 1); assert.equal(c[0].kind, 'deletedRemotely');
  assert.deepEqual(android.visits('onsen-001'), ['2026-06-09']);   // 編集はローカルに残っている
  assert.equal([...cloud.visits.values()][0].status, 'deleted');   // クラウドは削除のまま(勝手に復活しない)
  // 明示的に復元を選ぶと復活する
  await android.engine.resolveConflict(c[0].id, 'restore'); await flush(android, pc);
  assert.equal([...cloud.visits.values()][0].status, 'active');
  assert.deepEqual(pc.visits('onsen-001'), ['2026-06-09']);
});

test('edit on one device and delete on another: delete wins and the edit is kept in a conflict for review', async () => {
  const cloud = new FakeCloud(), pc = device(cloud, 'pc'), android = device(cloud, 'android');
  await pc.join(); await android.join();
  pc.add('onsen-001', '2026-07-01'); await flush(pc, android);
  android.adapter.offline = true;                                        // Androidは圏外(最新を受け取れない)
  pc.edit('onsen-001', 0, '2026-07-07'); await flush(pc);              // PCが編集(クラウド更新)
  android.remove('onsen-001', 0); android.adapter.offline = false;      // Androidは古い版を削除して復帰
  cloud.emit(); await flush(android, pc);
  const c = android.engine.openConflicts();
  assert.equal(c.length, 1); assert.equal(c[0].kind, 'editVsDelete');
  assert.equal(JSON.parse(c[0].remote).date, '2026-07-07');            // 編集内容は失われない
  assert.equal([...cloud.visits.values()][0].status, 'deleted');
  await android.engine.resolveConflict(c[0].id, 'restore'); await flush(android, pc);
  assert.deepEqual(pc.visits('onsen-001'), ['2026-07-07']);
});

test('edits to different fields on two devices are merged automatically; same-field edits become a conflict that keeps both', async () => {
  const cloud = new FakeCloud(), pc = device(cloud, 'pc'), android = device(cloud, 'android');
  await pc.join(); await android.join();
  pc.add('onsen-001', '2026-08-01'); await flush(pc, android);
  // 別項目: PCは日付、Androidはメモ(施設メモとは別の訪問メモは画面から編集できないため、日付と施設メモで検証)
  pc.adapter.offline = true; android.adapter.offline = true; pc.edit('onsen-001', 0, '2026-08-11'); android.note('onsen-001', 'Androidのメモ'); pc.adapter.offline = false; android.adapter.offline = false; cloud.emit();
  await flush(pc, android, pc, android);
  assert.deepEqual(pc.visits('onsen-001'), ['2026-08-11']); assert.deepEqual(android.visits('onsen-001'), ['2026-08-11']);
  assert.equal(pc.state.userData.visits['onsen-001'].notes, 'Androidのメモ');
  // 同じ施設メモを両端末で変更 → 競合(自動で上書きしない)
  pc.adapter.offline = true; android.adapter.offline = true; pc.note('onsen-001', 'PCのメモ'); android.note('onsen-001', 'Androidの別のメモ'); pc.adapter.offline = false; android.adapter.offline = false; cloud.emit();
  await flush(pc, android);
  const conflicts = [...cloud.conflicts.values()].filter(c => c.status === 'open');
  assert.equal(conflicts.length, 1); assert.equal(conflicts[0].kind, 'facilityNote');
  // 競合中は両端末とも自分のメモのまま(どちらも消えていない)
  assert.equal(pc.state.userData.visits['onsen-001'].notes, 'PCのメモ'); assert.equal(android.state.userData.visits['onsen-001'].notes, 'Androidの別のメモ');
  assert.equal(pc.last().state, 'conflicts');
  // 「両方を結合」で解決 → 両端末に両方の本文が残る
  await pc.engine.resolveConflict(conflicts[0].id, 'merge'); await flush(pc, android, pc);
  for (const d of [pc, android]) { const n = d.state.userData.visits['onsen-001'].notes; assert.ok(n.includes('PCのメモ') && n.includes('Androidの別のメモ'), d.name + ': ' + n); }
  assert.equal(pc.engine.openConflicts().length, 0);
});

test('first sync merges local and cloud records without deleting anything; same-day duplicates and legacy IDs survive; a backup of the local records is saved first', async () => {
  const cloud = new FakeCloud(), pc = device(cloud, 'pc');
  await pc.join();
  pc.add('onsen-001', '2026-01-01'); await flush(pc);
  // 旧移行由来の連番ID(legacy-…)が2台にある状況: 別の端末で同じIDを持つローカル記録
  const storage = mem(); const legacyDev = R.create(storage);
  storage.setItem('onsen-rally-user-v3', JSON.stringify({ userData: { schemaVersion: 3, visits: { 'onsen-001': { records: [
    { id: 'legacy-onsen-001-1', date: '2026-01-01', notes: '', photos: [], gpsStamp: null }, { id: 'legacy-onsen-001-2', date: '2026-01-01', notes: '', photos: [], gpsStamp: null }, { id: 'legacy-onsen-001-3', date: null, notes: 'メモあり', photos: [], gpsStamp: null, legacyDate: '不明' }], notes: '施設メモ' } }, rankings: [], rankingVisibility: 'private', gpsStamps: [] } }));
  const dev = device(cloud, 'old-phone', 'user-1', storage);
  await dev.begin();
  assert.equal(dev.last().state, 'consent');
  const p = dev.last().summary;
  assert.equal(p.local.visits, 3); assert.equal(p.local.sameDayGroups, 1); assert.equal(p.local.unknownDate, 1); assert.equal(p.willUpload, 3); assert.equal(p.willDownload, 1);
  assert.equal(cloud.visits.size, 1, 'nothing is sent before consent');
  const before = storage.getItem('onsen-rally-user-v3');
  await dev.engine.consent(); await settle(); await flush(dev, pc);
  // 退避(同意の直前の生データ)が保存されている
  const safe = JSON.parse(storage.getItem('onsen-rally-before-sync-v1')); assert.equal(safe.raw, before);
  // 結果: 4件(同日2件+日付なし+クラウドの1件)。元の記録は1件も消えていない
  assert.equal(dev.count(), 4); assert.equal(pc.count(), 4);
  assert.equal(dev.visits('onsen-001').filter(d => d === '2026-01-01').length, 3);
  assert.equal(dev.visits('onsen-001').filter(d => d === null).length, 1);
  assert.equal(dev.state.userData.visits['onsen-001'].notes, '施設メモ');
  const nul = dev.state.userData.visits['onsen-001'].records.find(r => r.date === null);
  assert.equal(nul.notes, 'メモあり'); assert.equal(nul.legacyDate, '不明');   // 元の日付表記・メモを保持
  assert.equal(cloud.visits.size, 4);
  // legacy連番IDはクラウドには別のeventIdで送られる(端末間で衝突しない)
  assert.ok([...cloud.visits.keys()].every(id => !id.startsWith('legacy-')));
});

test('a different account on the same device never receives this device\'s records until the user agrees; local data is untouched', async () => {
  const cloud = new FakeCloud(), storage = mem();
  const a = device(cloud, 'pc', 'user-A', storage);
  await a.join(); a.add('onsen-001', '2026-09-09'); await flush(a); a.engine.stop();
  const cloud2 = new FakeCloud();                                  // 別アカウントのクラウド(空)
  const b = device(cloud2, 'pc', 'user-B', storage);
  await b.begin();
  assert.equal(b.last().state, 'consent'); assert.equal(b.last().summary.otherAccount, true);
  await flush(b);
  assert.equal(cloud2.visits.size, 0, 'no upload before consent');
  assert.equal(b.count(), 1, 'local records stay');
});

test('lost response after a commit: retrying never duplicates the visit', async () => {
  const cloud = new FakeCloud(), pc = device(cloud, 'pc');
  await pc.join();
  cloud.loseNextResponse = true;
  pc.add('onsen-001', '2026-10-10'); await flush(pc);
  assert.equal(cloud.visits.size, 1);
  await flush(pc, pc);
  assert.equal(cloud.visits.size, 1); assert.equal(pc.count(), 1);
  assert.equal(pc.last().state, 'synced');
});

test('a second sync with no changes writes nothing (no wasted writes)', async () => {
  const cloud = new FakeCloud(), pc = device(cloud, 'pc'), android = device(cloud, 'android');
  await pc.join(); await android.join();
  pc.add('onsen-001', '2026-01-01'); pc.add('onsen-006', null); pc.note('onsen-001', 'x'); await flush(pc, android);
  const w = cloud.writes;
  await flush(pc, android, pc, android);
  assert.equal(cloud.writes, w);
});

test('safety stop: an emptied device does not delete the cloud; reconcile restores from the cloud without deleting anything', async () => {
  const cloud = new FakeCloud(), pc = device(cloud, 'pc');
  await pc.join();
  for (let i = 1; i <= 10; i++) pc.add('onsen-001', '2026-01-' + String(i).padStart(2, '0'));
  await flush(pc);
  assert.equal(cloud.visits.size, 10);
  // 端末の記録が消えた(ブラウザのデータ消去など)
  pc.storage.setItem('onsen-rally-user-v3', JSON.stringify(R.create(mem()).empty()));
  pc.repo = R.create(pc.storage); pc.state = pc.repo.load();
  pc.engine.stop();
  const again = device(cloud, 'pc', 'user-1', pc.storage); await again.begin(); await flush(again);
  assert.equal(again.last().state, 'error'); assert.equal(again.last().safety, true);
  assert.equal([...cloud.visits.values()].filter(d => d.status === 'active').length, 10, 'cloud untouched');
  await again.engine.reconcileNow(); await flush(again);
  assert.equal(again.count(), 10);
  assert.equal(again.last().state, 'synced');
});

test('restoring an older JSON backup never loses cloud records (reconcile mode); a record deleted in the cloud is held as a conflict, not resurrected', async () => {
  const cloud = new FakeCloud(), pc = device(cloud, 'pc');
  await pc.join();
  pc.add('onsen-001', '2026-01-01'); pc.add('onsen-001', '2026-01-02'); await flush(pc);
  const oldBackup = pc.repo.backup(pc.state);                       // 2件の時点のバックアップ
  pc.add('onsen-006', '2026-02-02'); pc.remove('onsen-001', pc.visits('onsen-001').indexOf('2026-01-02')); await flush(pc);
  // バックアップを復元(全置換)
  pc.state = pc.repo.replace(R.create(mem()).prepareImport(oldBackup, pc.state), pc.state, true);
  pc.engine.notifyLocalChange('replace'); await flush(pc, pc);
  // 新しい記録(onsen-006)は復元後もクラウドから戻る。削除済み(01-02)は勝手に復活せず競合として保留
  assert.deepEqual(pc.visits('onsen-006'), ['2026-02-02']);
  assert.equal([...cloud.visits.values()].filter(d => d.status === 'active').length, 2);
  const c = pc.engine.openConflicts(); assert.equal(c.length, 1); assert.equal(c[0].kind, 'deletedRemotely');
  assert.equal([...cloud.visits.values()].find(d => d.date === '2026-01-02').status, 'deleted');
});

test('logout keeps the device\'s records (stop() only stops syncing and never touches local data)', async () => {
  const cloud = new FakeCloud(), pc = device(cloud, 'pc');
  await pc.join(); pc.add('onsen-001', '2026-01-01'); pc.note('onsen-001', 'メモ'); await flush(pc);
  const raw = pc.storage.getItem('onsen-rally-user-v3');
  pc.engine.stop();
  assert.equal(pc.storage.getItem('onsen-rally-user-v3'), raw);
  pc.add('onsen-006', '2026-03-03');                                 // ログアウト中もローカルで記録できる
  assert.equal(pc.count(), 2);
  await pc.engine.syncNow(); assert.equal(cloud.visits.size, 1, 'stopped engine does not send');
});

test('oversized records block syncing without touching local data', async () => {
  const cloud = new FakeCloud(), pc = device(cloud, 'pc');
  await pc.join();
  const s = JSON.parse(JSON.stringify(pc.state));
  s.userData.visits['onsen-001'] = { records: [{ id: 'abcdefgh-1', date: null, notes: '', photos: [{ big: 'x'.repeat(30000) }], gpsStamp: null }], notes: '' };
  pc.state = pc.repo.replace(s, pc.state, true);
  await flush(pc);
  assert.equal(pc.last().state, 'error'); assert.match(pc.last().detail, /サイズ/);
  assert.equal(cloud.visits.size, 0); assert.equal(pc.count(), 1);
});

test('core: reconcile classifies add / update / delete / conflicts from base, local and cloud', () => {
  const ev = (id, date, notes = '', extra = '') => [id, { eventId: id, localId: id, facilityId: 'onsen-001', sourceVisitId: id, date, notes, extra }];
  const doc = (date, revision, status = 'active', notes = '') => ({ facilityId: 'onsen-001', date, notes, extra: '', revision, status });
  const r = C.reconcile({
    local: { events: new Map([ev('aaaaaaaa', '2026-01-01'), ev('bbbbbbbb', '2026-01-02', 'mine')]), notes: {} },
    cloud: { visits: new Map([['aaaaaaaa', doc('2026-01-01', 1)], ['bbbbbbbb', doc('2026-01-02', 2, 'active', 'theirs')], ['cccccccc', doc('2026-01-03', 1)]]), notes: new Map() },
    base: { events: { aaaaaaaa: { rev: 1, date: '2026-01-01', notes: '', extra: '' }, bbbbbbbb: { rev: 1, date: '2026-01-02', notes: '', extra: '' } }, notes: {} } });
  assert.deepEqual(r.changes.map(c => c.type + ':' + c.eventId), ['add:cccccccc']);
  assert.equal(r.conflicts.length, 1); assert.equal(r.conflicts[0].kind, 'visit'); assert.equal(r.conflicts[0].field, 'notes');
  assert.equal(r.pushes.length, 0);
  assert.equal(C.unnaturalDecrease({ before: 100, deletesLocal: 31, deletesRemote: 0 }), true);
  assert.equal(C.unnaturalDecrease({ before: 100, deletesLocal: 30, deletesRemote: 3 }), false);
  assert.equal(C.unnaturalDecrease({ before: 2, deletesLocal: 3, deletesRemote: 0 }), false);
});

// ---------------- クラウドデータのセルフサービス削除(世代ID・削除中の遮断) ----------------
test('deleting the cloud data from one device stops the other device (cloudReset); its local records stay and nothing is re-uploaded', async () => {
  const cloud = new FakeCloud(), pc = device(cloud, 'pc'), android = device(cloud, 'android');
  await pc.join(); await android.join();
  pc.add('onsen-001', '2026-01-10'); android.add('onsen-006', '2026-02-02'); await flush(pc, android, pc);
  assert.equal(pc.count(), 2); assert.equal(android.count(), 2);
  const r = await pc.adapter.deleteAll();
  assert.equal(r.status, 'deleted'); assert.deepEqual(r.counts, { visits: 2, facilityNotes: 0, conflicts: 0 });
  assert.equal(cloud.visits.size, 0); assert.equal(cloud.root, null);
  await flush(android);
  assert.equal(android.last().state, 'cloudReset');                // 他の端末は停止
  assert.equal(android.count(), 2);                                 // この端末の記録は残る
  android.add('onsen-009', '2026-03-03'); await flush(android, android);
  assert.equal(cloud.visits.size, 0, 'nothing is re-uploaded');     // 勝手に再アップロードしない
  assert.equal(cloud.root, null);
  assert.equal(android.last().state, 'cloudReset'); assert.equal(android.count(), 3);
});

test('offline queue: edits made offline before the deletion are rejected after reconnecting (the cloud stays empty)', async () => {
  const cloud = new FakeCloud(), pc = device(cloud, 'pc'), android = device(cloud, 'android');
  await pc.join(); await android.join();
  pc.add('onsen-001', '2026-01-10'); await flush(pc, android);
  android.adapter.offline = true;
  android.add('onsen-006', '2026-05-05'); android.note('onsen-001', 'オフラインのメモ');       // Androidが圏外で溜めた変更
  await pc.adapter.deleteAll();                                                                  // その間にPCがクラウドを削除
  android.adapter.offline = false; cloud.emit(); await flush(android, android);
  assert.equal(android.last().state, 'cloudReset');
  assert.equal(cloud.visits.size, 0); assert.equal(cloud.notes.size, 0); assert.equal(cloud.root, null);
  assert.equal(android.count(), 2);                                                               // ローカルの変更は残る
});

test('the server-side check (epoch) rejects a client that ignores the status: old-epoch writes fail even after the account is re-created', async () => {
  const cloud = new FakeCloud(), pc = device(cloud, 'pc');
  await pc.join();
  const oldEpoch = pc.engine.meta().epoch;
  await pc.adapter.deleteAll();
  const fresh = cloud.adapter(); const { epoch } = await fresh.ensureRoot({ allowCreate: true });
  assert.notEqual(epoch, oldEpoch);
  const op = { type: 'create', eventId: 'event-stale-0001', facilityId: 'onsen-001', sourceVisitId: 's', datasetId: 'd', opId: 'op', fields: { date: null, notes: '', extra: '' } };
  await assert.rejects(fresh.push({ ...op, epoch: oldEpoch }), { code: 'permission-denied' });
  await assert.rejects(fresh.push({ ...op }), { code: 'permission-denied' });                    // 世代IDなし(旧クライアント)も拒否
  assert.deepEqual(await fresh.push({ ...op, epoch }), { status: 'ok', revision: 1 });
});

test('after a deletion every device needs an explicit consent to sync again; re-syncing merges the devices\' records without duplicates', async () => {
  const cloud = new FakeCloud(), pc = device(cloud, 'pc'), android = device(cloud, 'android');
  await pc.join(); await android.join();
  pc.add('onsen-001', '2026-01-10'); pc.add('onsen-001', '2026-01-10'); android.add('onsen-006', null); await flush(pc, android, pc);
  await pc.adapter.deleteAll(); await flush(pc, android);
  assert.equal(pc.last().state, 'cloudReset'); assert.equal(android.last().state, 'cloudReset');
  assert.ok(pc.last().summary && pc.last().summary.willUpload === 3);                              // 確認画面に出す要約(再開すると何がアップロードされるか)
  await pc.engine.consent(); await settle(); await flush(pc, android);
  assert.equal(cloud.visits.size, 3);
  assert.equal(android.last().state, 'cloudReset', 'the other device still waits for its own consent');
  await android.engine.consent(); await settle(); await flush(android, pc, android);
  assert.equal(cloud.visits.size, 3, 'union of identical records: no duplicates');
  assert.equal(pc.count(), 3); assert.equal(android.count(), 3);
  assert.equal(pc.last().state, 'synced'); assert.equal(android.last().state, 'synced');
});

test('a partial deletion leaves the account in "deleting": every device stays stopped, nothing is written, and re-running completes it', async () => {
  const cloud = new FakeCloud(), pc = device(cloud, 'pc'), android = device(cloud, 'android');
  await pc.join(); await android.join();
  for (const d of ['2026-01-01', '2026-01-02', '2026-01-03']) pc.add('onsen-001', d);
  pc.note('onsen-001', 'メモ'); await flush(pc, android);
  cloud.deleteFailAfter = 2;
  await assert.rejects(pc.adapter.deleteAll(), { code: 'unavailable' });                            // 通信エラーで途中失敗
  assert.equal(cloud.root.status, 'deleting');
  assert.ok(cloud.visits.size + cloud.notes.size > 0, 'some data remains');
  cloud.emit(); await flush(android, pc);
  assert.equal(android.last().state, 'deleting'); assert.equal(pc.last().state, 'deleting');
  const w = cloud.writes;
  android.add('onsen-009', '2026-09-09'); await flush(android, android);
  assert.equal(cloud.writes, w, 'no writes while deleting');
  const done = await pc.adapter.deleteAll();                                                         // 再実行で完了
  assert.equal(done.status, 'deleted'); assert.equal(cloud.visits.size, 0); assert.equal(cloud.notes.size, 0); assert.equal(cloud.root, null);
  assert.equal(android.count(), 4); assert.equal(pc.count(), 3);                                    // 端末の記録は残る
  assert.deepEqual(await pc.adapter.deleteAll(), { status: 'nothing', counts: { visits: 0, facilityNotes: 0, conflicts: 0 } });   // 何度実行しても安全
});

test('deleting while another device is syncing: nothing reappears in the cloud', async () => {
  const cloud = new FakeCloud(), pc = device(cloud, 'pc'), android = device(cloud, 'android');
  await pc.join(); await android.join();
  pc.add('onsen-001', '2026-01-10'); await flush(pc, android);
  android.add('onsen-006', '2026-02-02');                    // Androidの同期(デバウンス)が走る直前
  const deleting = pc.adapter.deleteAll();                   // 同時にPCが削除
  await Promise.all([deleting, flush(android)]);
  await flush(android, pc);
  assert.equal(cloud.visits.size, 0); assert.equal(cloud.root, null);
  assert.equal(android.last().state, 'cloudReset');
  assert.equal(android.count(), 2);
});

test('forgetSyncState (used after the user deletes their cloud data) removes only the sync bookkeeping; a later login starts at the consent step', async () => {
  const cloud = new FakeCloud(), pc = device(cloud, 'pc');
  await pc.join(); pc.add('onsen-001', '2026-01-10'); pc.note('onsen-001', 'メモ'); await flush(pc);
  const rawRecords = pc.storage.getItem('onsen-rally-user-v3');
  await pc.adapter.deleteAll();
  pc.engine.forgetSyncState();
  assert.equal(pc.storage.getItem('onsen-rally-sync-v1'), null);
  assert.equal(pc.storage.getItem('onsen-rally-user-v3'), rawRecords, 'local records are untouched');
  const again = device(cloud, 'pc', 'user-1', pc.storage); await again.begin();
  assert.equal(again.last().state, 'consent');
  assert.equal(again.last().summary.willUpload, 1);
  assert.equal(cloud.visits.size, 0, 'nothing is uploaded without consent');
});

test('records synced before epochs existed (legacy root + legacy sync state) keep working: the device adopts or upgrades the epoch', async () => {
  const cloud = new FakeCloud(), pc = device(cloud, 'pc');
  await pc.join(); pc.add('onsen-001', '2026-01-10'); await flush(pc);
  // 世代ID導入前の状態を再現: ルートの epoch なし、端末の同期状態にも epoch なし
  cloud.root.epoch = null; cloud.root.legacy = true;
  const meta = JSON.parse(pc.storage.getItem('onsen-rally-sync-v1')); delete meta.epoch; pc.storage.setItem('onsen-rally-sync-v1', JSON.stringify(meta));
  pc.engine.stop();
  const again = device(cloud, 'pc', 'user-1', pc.storage); await again.begin();
  again.add('onsen-006', '2026-02-02'); await flush(again, again);
  assert.ok(cloud.root.epoch, 'the root got an epoch'); assert.equal(cloud.root.legacy, false);
  assert.equal(cloud.visits.size, 2); assert.equal(again.last().state, 'synced');
  assert.equal(again.engine.meta().epoch, cloud.root.epoch);
});

test('new origin (empty localStorage) logging in to an account that already has cloud records: nothing is uploaded or overwritten, the cloud records are downloaded', async () => {
  const cloud = new FakeCloud(), old = device(cloud, 'github-pages-origin');
  await old.join();
  old.add('onsen-001', '2026-01-01'); old.add('onsen-001', '2026-01-02'); old.add('onsen-002', '2026-02-03'); old.note('onsen-002', '露天風呂が良かった');
  await flush(old);
  assert.equal(cloud.visits.size, 3);
  const snapshot = () => JSON.stringify({ v: [...cloud.visits].sort(), n: [...cloud.notes].sort(), r: cloud.root });
  const before = snapshot(), writesBefore = cloud.writes;
  // 新ドメイン = 空のlocalStorage、同じアカウント(uid)
  const fresh = device(cloud, 'onsen.journeylab.jp', 'user-1', mem());
  assert.equal(fresh.count(), 0);
  await fresh.begin();
  assert.equal(fresh.last().state, 'consent', 'asks for consent before any exchange');
  assert.equal(fresh.last().summary.willUpload, 0); assert.equal(fresh.last().summary.willDownload, 3);
  assert.equal(snapshot(), before, 'cloud untouched before consent'); assert.equal(cloud.writes, writesBefore);
  await fresh.engine.consent(); await settle(); await flush(fresh, old);
  assert.equal(fresh.count(), 3); assert.deepEqual(fresh.visits('onsen-001').sort(), ['2026-01-01', '2026-01-02']);
  assert.equal(fresh.state.userData.visits['onsen-002'].notes, '露天風呂が良かった');
  assert.equal([...cloud.visits.values()].filter(d => d.status === 'active').length, 3, 'no cloud record was deleted');
  assert.equal(snapshot(), before, 'cloud records and notes are byte-identical after the first sync (nothing overwritten)');
  assert.equal(old.count(), 3); assert.equal(old.state.userData.visits['onsen-002'].notes, '露天風呂が良かった');
  // 空の端末から後で何か足しても、既存のクラウド記録は消えない
  fresh.add('onsen-003', '2026-03-04'); await flush(fresh, old);
  assert.equal(old.count(), 4); assert.equal([...cloud.visits.values()].filter(d => d.status === 'active').length, 4);
});
