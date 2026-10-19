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
  const device = (name, uid = UID) => {
    const db = env.authenticatedContext(uid).firestore(), storage = mem(), repo = R.create(storage);
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

  await env.clearFirestore();
  const pc = device('pc'), android = device('android');
  await pc.join(); await android.join();

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
    assert.equal([...snap.docs].filter(d => d.data().status === 'deleted').length, 1);
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
    const base = { eventId: 'event-idem-0001', facilityId: 'onsen-002', sourceVisitId: 's', datasetId: 'd', fields: { date: '2026-05-05', notes: '', extra: '' } };
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
    await assert.rejects(other.push({ type: 'create', eventId: 'event-hack-0001', facilityId: 'onsen-001', sourceVisitId: 's', datasetId: 'd', opId: 'op', fields: { date: null, notes: '', extra: '' } }));
    await assert.rejects(fsdk.getDocs(fsdk.collection(env.authenticatedContext('user-bbbbbbbb').firestore(), 'accounts', UID, 'visits')));
  });
});
