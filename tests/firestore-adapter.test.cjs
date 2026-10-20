// 本物のFirestoreアダプタ(sync-firestore.js)+ 本物のSecurity Rules + 同期エンジンを、Firestore Emulator上で通しで試験する(2台の端末を模擬)。
//   npm run test:rules (rules と一緒に実行される)。エミュレータが無い環境では skip。実際のクラウドには接続しない。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('../records.js'); require('../sync-core.js'); require('../sync-engine.js');
const Adapter = require('../sync-firestore.js');

const hostEnv = process.env.FIRESTORE_EMULATOR_HOST;
const skip = hostEnv ? false : 'Firestore Emulator is not running (use npm run test:rules)';
const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
const until = async (cond, label, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await cond()) return; await new Promise(r => setTimeout(r, 40)); } assert.fail('timed out: ' + label); };

test('sync engine + Firestore adapter + rules on the emulator (two devices, same account)', { skip }, async (t) => {
  const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
  const fsdk = require('firebase/firestore');
  const [host, port] = hostEnv.split(':');
  const env = await initializeTestEnvironment({ projectId: 'demo-onsen-adapter', firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host, port: Number(port) } });
  t.after(async () => { await env.cleanup(); });
  const { OnsenRecords: R, OnsenSyncEngine: E } = globalThis;
  const UID = 'user-aaaaaaaa';
  const devices = [];
  const device = (name, uid = UID, storage = mem()) => {
    const db = env.authenticatedContext(uid).firestore(), repo = R.create(storage);
    const d = { name, db, storage, repo, uid, statuses: [] };
    d.state = repo.load();
    d.adapter = Adapter.create({ sdk: fsdk, db, uid });
    d.engine = E.create({ repo, getState: () => d.state, setState: s => { d.state = s; }, storage, uid, projectId: 'demo', adapter: d.adapter, debounceMs: 20, afterStale: () => new Promise(r => setTimeout(r, 120)), isOnline: () => true, onStatus: s => d.statuses.push(s) });
    d.visits = fid => (d.state.userData.visits[fid]?.records || []).map(r => r.date);
    d.add = (fid, date) => { d.state = repo.addVisit(d.state, fid, date); d.engine.notifyLocalChange('change'); };
    d.remove = (fid, date) => { const r = d.state.userData.visits[fid].records.find(x => x.date === date); d.state = repo.deleteVisit(d.state, fid, r.id); d.engine.notifyLocalChange('change'); };
    d.note = (fid, text) => { d.state = repo.setNotes(d.state, fid, text); d.engine.notifyLocalChange('change'); };
    d.last = () => d.statuses.at(-1);
    d.join = async () => { await d.engine.start(); await until(() => d.last() && d.last().state === 'consent', name + ' consent'); await d.engine.consent(); await until(() => d.last().state === 'synced', name + ' synced'); };
    devices.push(d); return d;
  };
  t.after(() => devices.forEach(d => d.engine.stop()));
  const count = async (uid, name) => (await fsdk.getDocs(fsdk.collection(env.authenticatedContext(uid).firestore(), 'accounts', uid, name))).size;

  await env.clearFirestore();
  const pc = device('pc'), android = device('android');
  await pc.join(); await android.join();

  await t.test('visit type: actual Firestore round trip, independent date merge, conflicting types, unset and legacy writes',async()=>{
    pc.state=pc.repo.addVisit(pc.state,'onsen-020','2026-10-21','day');pc.engine.notifyLocalChange('change');
    await until(()=>android.state.userData.visits['onsen-020']?.records[0]?.visitType==='day','typed visit downloads');
    const id=pc.state.userData.visits['onsen-020'].records[0].id;
    await fsdk.disableNetwork(android.db);
    android.state=android.repo.editVisit(android.state,'onsen-020',id,'2026-10-21','stay');android.engine.notifyLocalChange('change');
    assert.equal(android.repo.load().userData.visits['onsen-020'].records[0].visitType,'stay');
    assert.equal(pc.state.userData.visits['onsen-020'].records[0].visitType,'day');
    await fsdk.enableNetwork(android.db);await android.engine.syncNow();
    await until(()=>pc.state.userData.visits['onsen-020'].records[0].visitType==='stay'&&android.last().state==='synced','offline type resends through real SDK');
    pc.engine.stop();android.engine.stop();
    pc.state=pc.repo.editVisit(pc.state,'onsen-020',id,'2026-10-20');
    android.state=android.repo.editVisit(android.state,'onsen-020',id,'2026-10-21','day');
    await pc.engine.start();await android.engine.start();
    await until(()=>[pc,android].every(d=>{const r=d.state.userData.visits['onsen-020'].records[0];return r.date==='2026-10-20'&&r.visitType==='day'}),'date and type merge');
    pc.engine.stop();android.engine.stop();
    pc.state=pc.repo.editVisit(pc.state,'onsen-020',id,'2026-10-20','stay');
    android.state=android.repo.editVisit(android.state,'onsen-020',id,'2026-10-20','');
    await pc.engine.start();await until(()=>pc.last().state==='synced','pc publishes day');await android.engine.start();
    await until(()=>android.engine.openConflicts().some(c=>c.field.includes('visitType')),'type conflict retained');
    const c=android.engine.openConflicts().find(c=>c.field.includes('visitType'));assert.equal(JSON.parse(c.remote).visitType,'stay');assert.equal(JSON.parse(c.local).visitType,'');
    await android.engine.resolveConflict(c.id,'local');
    await until(()=>[pc,android].every(d=>!d.state.userData.visits['onsen-020'].records[0].visitType),'unset resolved and synced');
    const cloud=await fsdk.getDoc(fsdk.doc(pc.db,'accounts',UID,'visits',id));assert.equal(cloud.data().visitType,'');
    const backup=android.repo.backup(android.state);assert.equal(backup.userData.visits['onsen-020'].records[0].id,id);
    // Remove this fixture through the real repository, so subsequent count tests remain unchanged.
    pc.state=pc.repo.deleteVisit(pc.state,'onsen-020',id);pc.engine.notifyLocalChange('change');
    await until(()=>!android.state.userData.visits['onsen-020'].records.length,'typed fixture deleted');
  });

  await t.test('PC adds -> Android receives it; Android adds -> PC receives it (real Firestore listeners, transactions and rules)', async () => {
    pc.add('onsen-001', '2026-01-10');
    await until(() => android.visits('onsen-001').includes('2026-01-10'), 'android gets PC visit');
    android.add('onsen-006', '2026-02-02'); android.add('onsen-006', null);
    await until(() => pc.visits('onsen-006').length === 2, 'pc gets android visits');
    assert.ok(pc.visits('onsen-006').includes(null));
  });

  await t.test('concurrent adds on the same facility and day are both stored; no date-based dedup', async () => {
    pc.add('onsen-009', '2026-03-03'); android.add('onsen-009', '2026-03-03');
    await until(() => pc.visits('onsen-009').length === 2 && android.visits('onsen-009').length === 2, 'both same-day visits on both devices');
    const snap = await fsdk.getDocs(fsdk.collection(pc.db, 'accounts', UID, 'visits'));
    assert.equal([...snap.docs].filter(d => d.data().facilityId === 'onsen-009').length, 2);
  });

  await t.test('delete leaves a tombstone and does not come back', async () => {
    pc.remove('onsen-001', '2026-01-10');
    await until(() => !android.visits('onsen-001').includes('2026-01-10'), 'android sees deletion');
    const snap = await fsdk.getDocs(fsdk.collection(pc.db, 'accounts', UID, 'visits'));
    assert.equal([...snap.docs].filter(d => d.data().status === 'deleted'&&d.data().facilityId==='onsen-001').length, 1);
    await new Promise(r => setTimeout(r, 600));
    assert.ok(!pc.visits('onsen-001').includes('2026-01-10') && !android.visits('onsen-001').includes('2026-01-10'));
  });

  await t.test('same facility note edited on both devices becomes a conflict that keeps both; merge converges', async () => {
    pc.note('onsen-006', '最初のメモ'); await until(() => android.state.userData.visits['onsen-006'].notes === '最初のメモ', 'note synced');
    // 同時編集(両方が相手の更新を受け取る前に書く)
    pc.engine.stop(); android.engine.stop();
    pc.state = pc.repo.setNotes(pc.state, 'onsen-006', 'PCの変更'); android.state = android.repo.setNotes(android.state, 'onsen-006', 'Androidの変更');
    await pc.engine.start(); await android.engine.start();
    await until(() => pc.engine.openConflicts().length === 1 && android.engine.openConflicts().length === 1, 'conflict visible on both');
    assert.equal(pc.state.userData.visits['onsen-006'].notes, 'PCの変更'); assert.equal(android.state.userData.visits['onsen-006'].notes, 'Androidの変更');
    await pc.engine.resolveConflict(pc.engine.openConflicts()[0].id, 'merge');
    await until(() => [pc, android].every(d => { const n = d.state.userData.visits['onsen-006'].notes; return n.includes('PCの変更') && n.includes('Androidの変更'); }) && pc.engine.openConflicts().length === 0 && android.engine.openConflicts().length === 0, 'merged note on both, no open conflicts');
  });

  await t.test('adapter: same opId is applied once; a stale revision is rejected; deleted docs cannot be edited back', async () => {
    const a = Adapter.create({ sdk: fsdk, db: env.authenticatedContext(UID).firestore(), uid: UID });
    const { epoch } = await a.ensureRoot();
    const base = { eventId: 'event-idem-0001', facilityId: 'onsen-002', sourceVisitId: 's', datasetId: 'd', epoch, fields: { date: '2026-05-05', notes: '', extra: '' } };
    assert.deepEqual(await a.push({ ...base, type: 'create', opId: 'op-create' }), { status: 'ok', revision: 1 });
    assert.equal((await a.push({ ...base, type: 'create', opId: 'op-create-2' })).status, 'exists');
    const edit = { ...base, type: 'update', baseRevision: 1, opId: 'op-edit', fields: { date: '2026-05-06', notes: 'x', extra: '' } };
    assert.deepEqual(await a.push(edit), { status: 'ok', revision: 2 });
    assert.deepEqual(await a.push(edit), { status: 'ok', revision: 2 }, 'retry of the same op (lost response) is a no-op');
    assert.equal((await a.push({ ...edit, opId: 'op-edit-b', fields: { date: '2026-05-07', notes: '', extra: '' } })).status, 'stale');
    assert.deepEqual(await a.push({ ...base, type: 'delete', baseRevision: 2, opId: 'op-del' }), { status: 'ok', revision: 3 });
    assert.equal((await a.push({ ...base, type: 'update', baseRevision: 3, opId: 'op-late', fields: { date: '2026-05-08', notes: '', extra: '' } })).status, 'stale');
    assert.deepEqual(await a.push({ ...base, type: 'restore', baseRevision: 3, opId: 'op-restore', fields: { date: '2026-05-06', notes: 'x', extra: '' } }), { status: 'ok', revision: 4 });
  });

  await t.test('another account cannot read or write this account\'s records through the adapter', async () => {
    const other = Adapter.create({ sdk: fsdk, db: env.authenticatedContext('user-bbbbbbbb').firestore(), uid: UID });
    await assert.rejects(other.push({ type: 'create', eventId: 'event-hack-0001', facilityId: 'onsen-001', sourceVisitId: 's', datasetId: 'd', opId: 'op', epoch: 'epoch-hack-1', fields: { date: null, notes: '', extra: '' } }));
    await assert.rejects(fsdk.getDocs(fsdk.collection(env.authenticatedContext('user-bbbbbbbb').firestore(), 'accounts', UID, 'visits')));
    await assert.rejects(other.deleteAll());
  });

  // ---- セルフサービス削除(実Firestore Emulator・実Rules・実アダプタ) ----
  await t.test('self-service deletion: stops the other device, deletes visits/notes/conflicts/root completely (more docs than one batch), and leaves other accounts untouched', async () => {
    await env.clearFirestore();
    const other = Adapter.create({ sdk: fsdk, db: env.authenticatedContext('user-cccccccc').firestore(), uid: 'user-cccccccc' });
    const oe = (await other.ensureRoot({ allowCreate: true })).epoch;
    await other.push({ type: 'create', eventId: 'event-other-0001', facilityId: 'onsen-001', sourceVisitId: 's', datasetId: 'd', epoch: oe, opId: 'o', fields: { date: null, notes: '', extra: '' } });
    const a = device('a'), b = device('b');
    await a.join(); await b.join();
    for (let i = 1; i <= 47; i++) a.add('onsen-' + String(1 + (i % 9)).padStart(3, '0'), '2026-04-' + String((i % 28) + 1).padStart(2, '0'));
    a.note('onsen-001', 'メモ1'); a.note('onsen-002', 'メモ2');
    await until(() => b.state.userData.visits && Object.values(b.state.userData.visits).reduce((n, v) => n + v.records.length, 0) === 47, 'b has 47 visits', 20000);
    await until(() => a.last().state === 'synced', 'a synced', 20000);
    // 競合も1件作っておく
    await a.adapter.createConflict({ id: 'visit-x-r1', epoch: a.engine.meta().epoch, kind: 'visit', key: 'visit:x', facilityId: 'onsen-001', eventId: 'x', field: 'notes', base: '{}', remote: '{}', local: '{}' });
    await until(async () => (await count(UID, 'visits')) === 47 && (await count(UID, 'conflicts')) === 1, 'cloud has the data');
    const progress = [];
    const res = await a.adapter.deleteAll((s, c) => progress.push(s));
    assert.equal(res.status, 'deleted'); assert.deepEqual(res.counts, { visits: 47, facilityNotes: 2, conflicts: 1 });
    assert.ok(progress.includes('stopped') && progress.includes('deleting') && progress.at(-1) === 'done');
    for (const n of ['visits', 'facilityNotes', 'conflicts']) assert.equal(await count(UID, n), 0, n);
    assert.equal((await fsdk.getDoc(fsdk.doc(a.db, 'accounts', UID))).exists(), false, 'root is gone');
    assert.equal(await count('user-cccccccc', 'visits'), 1, 'another account is untouched');
    // もう一方の端末は止まる(記録は端末に残る)。再アップロードされない
    await until(() => b.last().state === 'cloudReset', 'b stops with cloudReset');
    b.add('onsen-009', '2026-12-12'); await new Promise(r => setTimeout(r, 500));
    assert.equal(await count(UID, 'visits'), 0, 'nothing is re-uploaded');
    assert.equal(Object.values(b.state.userData.visits).reduce((n, v) => n + v.records.length, 0), 48);
    // 明示的に再開すると新しい世代で全件が戻る(和集合)
    await b.engine.consent();
    await until(async () => (await count(UID, 'visits')) === 48, 'b re-uploads after consent', 20000);
  });

  await t.test('stale clients are rejected by the real rules: old epoch, no epoch, deleting account, deleted account', async () => {
    await env.clearFirestore();
    const adapter = device('s').adapter, { epoch } = await adapter.ensureRoot({ allowCreate: true });
    const op = { type: 'create', eventId: 'event-stale-0001', facilityId: 'onsen-001', sourceVisitId: 's', datasetId: 'd', opId: 'op1', fields: { date: null, notes: '', extra: '' } };
    assert.deepEqual(await adapter.push({ ...op, epoch }), { status: 'ok', revision: 1 });
    await assert.rejects(adapter.push({ ...op, eventId: 'event-stale-0002', epoch: 'epoch-old-0001' }), { code: 'permission-denied' });
    await assert.rejects(adapter.push({ ...op, eventId: 'event-stale-0003' }));   // 世代IDなし(旧クライアント)は書けない(SDKが拒否、もしくはRulesが拒否)
    // 削除の途中(ルートが deleting)で止めた状態: 書き込みはすべて拒否、再実行で完了
    let n = 0;
    await assert.rejects(adapter.deleteAll(s => { if (s === 'deleting' && ++n === 1) throw Object.assign(new Error('simulated failure'), { code: 'unavailable' }); }));
    assert.equal((await fsdk.getDoc(fsdk.doc(env.authenticatedContext(UID).firestore(), 'accounts', UID))).data().status, 'deleting');
    await assert.rejects(adapter.push({ ...op, eventId: 'event-stale-0004', epoch }), { code: 'permission-denied' });
    await assert.rejects(adapter.ensureRoot(), { code: 'cloud-deleting' });
    assert.equal((await adapter.deleteAll()).status, 'deleted');
    await assert.rejects(adapter.push({ ...op, eventId: 'event-stale-0005', epoch }), { code: 'permission-denied' });     // ルートなし
    assert.deepEqual(await adapter.deleteAll(), { status: 'nothing', counts: { visits: 0, facilityNotes: 0, conflicts: 0 } });
    // 作り直し: 新しい世代。古い世代の再送は拒否される
    await assert.rejects(adapter.ensureRoot(), { code: 'cloud-reset' }); // 自動再作成は不可
    await assert.rejects(adapter.ensureRoot({ allowCreate: true, expectedRoot: { exists: true, epoch } }), { code: 'cloud-reset' }); // 削除前の古い確認も不可
    const again = (await adapter.ensureRoot({ allowCreate: true, expectedRoot: { exists: false, epoch: null } })).epoch; assert.notEqual(again, epoch);
    await assert.rejects(adapter.push({ ...op, eventId: 'event-stale-0006', epoch }), { code: 'permission-denied' });
    assert.deepEqual(await adapter.push({ ...op, eventId: 'event-stale-0007', epoch: again }), { status: 'ok', revision: 1 });
  });

  await t.test('legacy data created before epochs: the adapter upgrades the root, existing records stay editable, and the account can be deleted', async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async ctx => {
      const d = ctx.firestore(), ts = fsdk.Timestamp.now();
      await fsdk.setDoc(fsdk.doc(d, 'accounts', UID), { schemaVersion: 1, createdAt: ts });
      await fsdk.setDoc(fsdk.doc(d, 'accounts', UID, 'visits', 'event-legacy-0001'), { schemaVersion: 1, facilityId: 'onsen-001', sourceVisitId: 's', sourceDatasetId: 'd', date: '2026-01-01', notes: '', extra: '', status: 'active', revision: 1, lastOpId: 'old', createdAt: ts, updatedAt: ts, deletedAt: null, restoredAt: null });
    });
    const adapter = device('legacy').adapter;
    const { epoch, upgraded } = await adapter.ensureRoot(); assert.ok(epoch && upgraded);
    assert.deepEqual(await adapter.push({ type: 'update', eventId: 'event-legacy-0001', facilityId: 'onsen-001', baseRevision: 1, opId: 'op', epoch, fields: { date: '2026-01-02', notes: '', extra: '' } }), { status: 'ok', revision: 2 });
    assert.equal((await adapter.deleteAll()).status, 'deleted');
    assert.equal(await count(UID, 'visits'), 0);
  });
});
