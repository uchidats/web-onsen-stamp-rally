// Firestore Security Rules の試験(Firestore Emulator が必要)。
//   npm run test:rules   (= firebase emulators:exec --only firestore ... )
// エミュレータが無い環境(FIRESTORE_EMULATOR_HOST 未設定)では skip する。実際のFirestore(クラウド)には一切接続しない。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const hostEnv = process.env.FIRESTORE_EMULATOR_HOST;
const skip = hostEnv ? false : 'Firestore Emulator is not running (use npm run test:rules)';

test('Firestore rules (emulator)', { skip }, async (t) => {
  const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
  const { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp, collection, getDocs, Timestamp } = require('firebase/firestore');
  const [host, port] = hostEnv.split(':');
  const env = await initializeTestEnvironment({ projectId: 'demo-onsen-rules', firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host, port: Number(port) } });
  t.after(async () => { await env.cleanup(); });
  const A = 'user-aaaaaaaa', B = 'user-bbbbbbbb', EP = 'epoch-0001';
  const db = uid => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
  const visit = (over = {}) => ({ schemaVersion: 1, epoch: EP, facilityId: 'onsen-001', sourceVisitId: 'src-1', sourceDatasetId: 'ds-1', date: '2026-01-02', notes: '', extra: '', status: 'active', revision: 1, lastOpId: 'op-1', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), deletedAt: null, restoredAt: null, ...over });
  const note = (over = {}) => ({ schemaVersion: 1, epoch: EP, facilityId: 'onsen-001', notes: 'メモ', revision: 1, lastOpId: 'op-1', updatedAt: serverTimestamp(), ...over });
  const conflict = (over = {}) => ({ schemaVersion: 1, epoch: EP, kind: 'facilityNote', key: 'note:onsen-001', facilityId: 'onsen-001', eventId: '', field: 'notes', base: '{}', remote: '{"notes":"a"}', local: '{"notes":"b"}', status: 'open', createdAt: serverTimestamp(), resolvedAt: null, resolution: '', ...over });
  const rootDoc = (over = {}) => ({ schemaVersion: 1, createdAt: serverTimestamp(), epoch: EP, status: 'active', deletingAt: null, creationVersion: 2, ...over });
  const rref = (d, uid) => doc(d, 'accounts', uid);
  const vref = (d, uid, id) => doc(d, 'accounts', uid, 'visits', id);
  const nref = (d, uid, id) => doc(d, 'accounts', uid, 'facilityNotes', id);
  const cref = (d, uid, id) => doc(d, 'accounts', uid, 'conflicts', id);
  const EID = 'event-0001', EID2 = 'event-0002';
  const seed = async fn => env.withSecurityRulesDisabled(async ctx => fn(ctx.firestore()));
  const seedRoot = async (uid, over = {}) => seed(async d => setDoc(rref(d, uid), { schemaVersion: 1, createdAt: Timestamp.now(), epoch: EP, status: 'active', deletingAt: null, ...over }));
  const T = (name, fn) => t.test(name, async () => { await env.clearFirestore(); await fn(); });

  await T('visit type is an optional enum; old documents and old-style partial updates retain typed records',async()=>{
    await seedRoot(A);const a=db(A);
    for(const [i,type] of ['', 'day','stay'].entries())await assertSucceeds(setDoc(vref(a,A,'typed-000'+i),visit({visitType:type})));
    for(const type of ['hotel',null,true,1,{},['day']])await assertFails(setDoc(vref(a,A,'badtype-0001'),visit({visitType:type})));
    await assertSucceeds(setDoc(vref(a,A,EID),visit()));
    await assertSucceeds(updateDoc(vref(a,A,EID),{visitType:'stay',revision:2,lastOpId:'type-add',updatedAt:serverTimestamp()}));
    // The current production adapter updates date/notes/extra, leaving new fields intact.
    await assertSucceeds(updateDoc(vref(a,A,EID),{date:null,notes:'旧端末の編集',extra:'',revision:3,lastOpId:'old-edit',updatedAt:serverTimestamp()}));
    assert.equal((await getDoc(vref(a,A,EID))).data().visitType,'stay');
    await assertFails(updateDoc(vref(db(B),A,EID),{visitType:'day',revision:4,lastOpId:'other-user',updatedAt:serverTimestamp()}));
    await assertSucceeds(updateDoc(vref(a,A,EID),{visitType:'',revision:4,lastOpId:'unset',updatedAt:serverTimestamp()}));
  });

  await T('unauthenticated users can read and write nothing', async () => {
    await seedRoot(A);
    await seed(async d => { await setDoc(vref(d, A, EID), visit({ createdAt: Timestamp.now(), updatedAt: Timestamp.now() })); });
    const d = db(null);
    await assertFails(getDoc(vref(d, A, EID)));
    await assertFails(setDoc(vref(d, A, EID2), visit()));
    await assertFails(getDocs(collection(d, 'accounts', A, 'visits')));
    await assertFails(setDoc(rref(d, A), rootDoc()));
  });

  await T('the owner can create and read; another user can neither read nor write the owner\'s data (visits, notes, conflicts, root)', async () => {
    const a = db(A), b = db(B);
    await assertSucceeds(setDoc(rref(a, A), rootDoc()));
    await assertSucceeds(setDoc(vref(a, A, EID), visit()));
    await assertSucceeds(setDoc(nref(a, A, 'onsen-001'), note()));
    await assertSucceeds(setDoc(cref(a, A, 'c1'), conflict()));
    await assertSucceeds(getDoc(vref(a, A, EID)));
    await assertSucceeds(getDocs(collection(a, 'accounts', A, 'visits')));
    for (const ref of [vref(b, A, EID), rref(b, A), nref(b, A, 'onsen-001'), cref(b, A, 'c1')]) await assertFails(getDoc(ref));
    await assertFails(getDocs(collection(b, 'accounts', A, 'visits')));
    await assertFails(setDoc(vref(b, A, EID2), visit()));
    await assertFails(updateDoc(vref(b, A, EID), { notes: 'x', revision: 2, lastOpId: 'op-2', updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(vref(b, A, EID)));
    await assertFails(updateDoc(rref(b, A), { status: 'deleting', deletingAt: serverTimestamp() }));   // 他人は削除を開始できない
    await assertFails(setDoc(nref(b, A, 'onsen-002'), note({ facilityId: 'onsen-002' })));
    // 自分の領域は別のユーザーでも作れる(UID単位)
    await assertSucceeds(setDoc(rref(b, B), rootDoc()));
    await assertSucceeds(setDoc(vref(b, B, EID), visit()));
    await assertFails(getDoc(vref(a, B, EID)));
  });

  await T('visit create is validated: epoch must match the root, revision 1, status active, server timestamps, exact fields, formats and sizes', async () => {
    await seedRoot(A);
    const a = db(A);
    const bad = [visit({ revision: 2 }), visit({ status: 'deleted', deletedAt: serverTimestamp() }), visit({ createdAt: Timestamp.now() }), visit({ updatedAt: Timestamp.now() }),
      visit({ date: '2026/01/02' }), visit({ date: 5 }), visit({ facilityId: 'hotel-1' }), visit({ facilityId: 'onsen-001/../x' }), visit({ notes: 'x'.repeat(10001) }), visit({ extra: 'x'.repeat(20001) }),
      visit({ schemaVersion: 2 }), visit({ lastOpId: '' }), visit({ restoredAt: serverTimestamp() }), { ...visit(), unexpected: 1 },
      visit({ epoch: 'epoch-9999' }), visit({ epoch: 'short' }), visit({ epoch: 5 })];
    for (const [i, v] of bad.entries()) await assertFails(setDoc(vref(a, A, 'event-bad-' + i), v));
    const missing = visit(); delete missing.extra; await assertFails(setDoc(vref(a, A, 'event-miss-1'), missing));
    const noEpoch = visit(); delete noEpoch.epoch; await assertFails(setDoc(vref(a, A, 'event-noepoch'), noEpoch));   // 世代IDのない旧クライアントは書き込めない
    await assertFails(setDoc(vref(a, A, 'short'), visit()));                      // eventId が短い
    await assertSucceeds(setDoc(vref(a, A, 'event-null-date'), visit({ date: null })));   // 日付なしの訪問
    await assertSucceeds(setDoc(vref(a, A, 'event-same-day-1'), visit({ sourceVisitId: 's1' })));
    await assertSucceeds(setDoc(vref(a, A, 'event-same-day-2'), visit({ sourceVisitId: 's2' })));  // 同じ日付でも別の訪問として保存できる
    await assertSucceeds(setDoc(vref(a, A, 'event-notes-max'), visit({ notes: 'あ'.repeat(10000) })));
  });

  await T('writes are rejected while the account has no root (never created or already deleted)', async () => {
    const a = db(A);
    await assertFails(setDoc(vref(a, A, EID), visit()));
    await assertFails(setDoc(nref(a, A, 'onsen-001'), note()));
    await assertFails(setDoc(cref(a, A, 'c1'), conflict()));
  });

  await T('visit update requires revision+1, immutable identity fields, and cannot resurrect deleted records except by an explicit restore', async () => {
    await seedRoot(A);
    const a = db(A);
    await assertSucceeds(setDoc(vref(a, A, EID), visit()));
    const edit = (over = {}) => ({ date: '2026-02-02', notes: 'n', revision: 2, lastOpId: 'op-2', updatedAt: serverTimestamp(), ...over });
    await assertFails(updateDoc(vref(a, A, EID), edit({ revision: 1 })));          // 同じrevision
    await assertFails(updateDoc(vref(a, A, EID), edit({ revision: 3 })));          // 飛ばしたrevision
    await assertFails(updateDoc(vref(a, A, EID), edit({ facilityId: 'onsen-002' })));
    await assertFails(updateDoc(vref(a, A, EID), edit({ sourceVisitId: 'other' })));
    await assertFails(updateDoc(vref(a, A, EID), edit({ createdAt: Timestamp.fromMillis(0) })));
    await assertFails(updateDoc(vref(a, A, EID), edit({ updatedAt: Timestamp.fromMillis(0) })));
    await assertFails(updateDoc(vref(a, A, EID), edit({ deletedAt: serverTimestamp() })));     // activeのまま削除印は付けられない
    await assertFails(updateDoc(vref(a, A, EID), edit({ date: 'bad' })));
    await assertFails(updateDoc(vref(a, A, EID), edit({ epoch: 'epoch-9999' })));              // 世代IDの不一致
    await assertSucceeds(updateDoc(vref(a, A, EID), edit()));
    // 削除(tombstone): deletedAt はサーバー時刻。通常の同期中は物理deleteを禁止
    await assertFails(updateDoc(vref(a, A, EID), { status: 'deleted', revision: 3, lastOpId: 'op-3', updatedAt: serverTimestamp(), deletedAt: Timestamp.fromMillis(0) }));
    await assertSucceeds(updateDoc(vref(a, A, EID), { status: 'deleted', revision: 3, lastOpId: 'op-3', updatedAt: serverTimestamp(), deletedAt: serverTimestamp() }));
    await assertFails(deleteDoc(vref(a, A, EID)));
    // 削除済みは通常の更新で復活しない(古い端末の編集・古いバックアップによる復活を防ぐ)
    await assertFails(updateDoc(vref(a, A, EID), edit({ revision: 4, status: 'active', deletedAt: null })));
    await assertFails(updateDoc(vref(a, A, EID), edit({ revision: 4, status: 'deleted' })));
    // 明示的な復元(restoredAt = サーバー時刻)だけが復活できる
    await assertSucceeds(updateDoc(vref(a, A, EID), { status: 'active', deletedAt: null, restoredAt: serverTimestamp(), revision: 4, lastOpId: 'op-4', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(vref(a, A, EID), edit({ revision: 5, notes: 'また編集' })));
    await assertFails(updateDoc(vref(a, A, EID), edit({ revision: 6, restoredAt: null })));    // 復元の記録は消せない
  });

  await T('facility notes: owner only, epoch match, revision+1, bounded; deletable only during account deletion', async () => {
    await seedRoot(A);
    const a = db(A), r = id => nref(a, A, id);
    await assertFails(setDoc(r('onsen-001'), note({ revision: 2 })));
    await assertFails(setDoc(r('onsen-001'), note({ facilityId: 'onsen-002' })));
    await assertFails(setDoc(r('onsen-001'), note({ notes: 'x'.repeat(10001) })));
    await assertFails(setDoc(r('onsen-001'), note({ epoch: 'epoch-9999' })));
    await assertFails(setDoc(r('bad-id'), note({ facilityId: 'bad-id' })));
    await assertSucceeds(setDoc(r('onsen-001'), note()));
    await assertFails(updateDoc(r('onsen-001'), { notes: 'y', revision: 1, lastOpId: 'op-2', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(r('onsen-001'), { notes: '', revision: 2, lastOpId: 'op-2', updatedAt: serverTimestamp() }));     // 空文字への変更(明示的な消去)
    await assertFails(deleteDoc(r('onsen-001')));
  });

  await T('conflicts keep both versions: create open; only open -> resolved is allowed; contents are immutable; deletable only during account deletion', async () => {
    await seedRoot(A);
    const a = db(A), r = id => cref(a, A, id);
    await assertFails(setDoc(r('c1'), conflict({ status: 'resolved' })));
    await assertFails(setDoc(r('c1'), conflict({ kind: 'other' })));
    await assertFails(setDoc(r('c1'), conflict({ local: 'x'.repeat(30001) })));
    await assertFails(setDoc(r('c1'), conflict({ epoch: 'epoch-9999' })));
    await assertSucceeds(setDoc(r('c1'), conflict()));
    await assertFails(updateDoc(r('c1'), { local: '{"notes":"tampered"}' }));
    await assertFails(updateDoc(r('c1'), { status: 'resolved', resolvedAt: serverTimestamp(), resolution: 'hack' }));
    await assertFails(updateDoc(r('c1'), { status: 'resolved', resolvedAt: serverTimestamp(), resolution: 'merge', remote: 'changed' }));
    await assertSucceeds(updateDoc(r('c1'), { status: 'resolved', resolvedAt: serverTimestamp(), resolution: 'merge' }));
    await assertFails(updateDoc(r('c1'), { status: 'open', resolvedAt: null, resolution: '' }));       // 解決済みを開き直せない
    await assertFails(deleteDoc(r('c1')));
  });

  await T('root document: created once with an epoch; only legacy upgrade or active -> deleting can update it; it can be deleted only while deleting', async () => {
    const a = db(A);
    await assertFails(setDoc(rref(a, A), rootDoc({ createdAt: Timestamp.now() })));
    await assertFails(setDoc(rref(a, A), { ...rootDoc(), admin: true }));
    await assertFails(setDoc(rref(a, A), rootDoc({ status: 'deleting', deletingAt: serverTimestamp() })));    // いきなり deleting では作れない
    await assertFails(setDoc(rref(a, A), rootDoc({ epoch: 'x' })));
    const old = { schemaVersion: 1, createdAt: serverTimestamp() }; await assertFails(setDoc(rref(a, A), old));   // 旧形式(epochなし)では新規作成できない
    await assertSucceeds(setDoc(rref(a, A), rootDoc()));
    await assertFails(updateDoc(rref(a, A), { schemaVersion: 2 }));
    await assertFails(updateDoc(rref(a, A), { epoch: 'epoch-0002' }));           // 世代IDは変更できない(世代の切替は削除→作り直しだけ)
    await assertFails(updateDoc(rref(a, A), { status: 'deleting' }));            // deletingAt がサーバー時刻でない
    await assertFails(deleteDoc(rref(a, A)));                                     // active のルートは削除できない
    await assertSucceeds(updateDoc(rref(a, A), { status: 'deleting', deletingAt: serverTimestamp() }));
    await assertFails(updateDoc(rref(a, A), { status: 'active', deletingAt: null }));      // 削除の開始は取り消せない(完了させる)
    await assertSucceeds(deleteDoc(rref(a, A)));
    await assertFails(getDoc(rref(db(B), A)));
  });

  await T('account data deletion: once the root is deleting, every write is rejected, reads and deletes work, the root goes last, and stale clients can never write again', async () => {
    const a = db(A);
    await assertSucceeds(setDoc(rref(a, A), rootDoc()));
    await assertSucceeds(setDoc(vref(a, A, EID), visit()));
    await assertSucceeds(setDoc(vref(a, A, EID2), visit({ sourceVisitId: 's2' })));
    await assertSucceeds(setDoc(nref(a, A, 'onsen-001'), note()));
    await assertSucceeds(setDoc(cref(a, A, 'c1'), conflict()));
    // 削除の開始
    await assertSucceeds(updateDoc(rref(a, A), { status: 'deleting', deletingAt: serverTimestamp() }));
    // 古い端末・オフラインで溜めた変更は、サーバー側で拒否される(新規・更新・削除・競合の解決・メモ)
    await assertFails(setDoc(vref(a, A, 'event-late-0001'), visit()));
    await assertFails(updateDoc(vref(a, A, EID), { notes: 'late', revision: 2, lastOpId: 'op-late', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(vref(a, A, EID), { status: 'deleted', revision: 2, lastOpId: 'op-late', updatedAt: serverTimestamp(), deletedAt: serverTimestamp() }));
    await assertFails(setDoc(nref(a, A, 'onsen-002'), note({ facilityId: 'onsen-002' })));
    await assertFails(updateDoc(nref(a, A, 'onsen-001'), { notes: 'late', revision: 2, lastOpId: 'op-late', updatedAt: serverTimestamp() }));
    await assertFails(setDoc(cref(a, A, 'c2'), conflict()));
    await assertFails(updateDoc(cref(a, A, 'c1'), { status: 'resolved', resolvedAt: serverTimestamp(), resolution: 'merge' }));
    // 読み取りと削除はできる(再開・確認のため)。他人は削除できない
    await assertSucceeds(getDocs(collection(a, 'accounts', A, 'visits')));
    await assertFails(deleteDoc(vref(db(B), A, EID)));
    await assertSucceeds(deleteDoc(vref(a, A, EID)));
    await assertSucceeds(deleteDoc(vref(a, A, EID2)));
    await assertSucceeds(deleteDoc(nref(a, A, 'onsen-001')));
    await assertSucceeds(deleteDoc(cref(a, A, 'c1')));
    await assertSucceeds(deleteDoc(rref(a, A)));
    // ルートがない間は、世代を知っている古い端末でも書き込めない
    const oldRoot = rootDoc(); delete oldRoot.creationVersion;
    await assertFails(setDoc(rref(a, A), oldRoot)); // キャッシュされた旧ensureRootによる再作成を拒否
    await assertFails(setDoc(vref(a, A, 'event-stale-0001'), visit()));
    await assertFails(setDoc(nref(a, A, 'onsen-001'), note()));
    // 再度同期を始める(新しい世代で作り直す)と、古い世代(EP)の書き込みは拒否され、新しい世代だけが書き込める
    await assertSucceeds(setDoc(rref(a, A), rootDoc({ epoch: 'epoch-0002' })));
    await assertFails(setDoc(vref(a, A, 'event-stale-0001'), visit()));                         // 古い端末の再送は拒否
    await assertFails(setDoc(nref(a, A, 'onsen-001'), note()));
    await assertSucceeds(setDoc(vref(a, A, 'event-fresh-0001'), visit({ epoch: 'epoch-0002' })));
    await assertSucceeds(setDoc(nref(a, A, 'onsen-001'), note({ epoch: 'epoch-0002' })));
  });

  await T('deletion can resume after a partial failure (the root stays deleting) and is idempotent', async () => {
    const a = db(A);
    await assertSucceeds(setDoc(rref(a, A), rootDoc()));
    await assertSucceeds(setDoc(vref(a, A, EID), visit()));
    await assertSucceeds(setDoc(vref(a, A, EID2), visit({ sourceVisitId: 's2' })));
    await assertSucceeds(updateDoc(rref(a, A), { status: 'deleting', deletingAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(vref(a, A, EID)));                              // ここで中断したと想定
    assert.equal((await getDoc(rref(a, A))).data().status, 'deleting');             // 書き込みは止まったまま(再開できる)
    await assertFails(setDoc(vref(a, A, 'event-late-0001'), visit()));
    await assertSucceeds(deleteDoc(vref(a, A, EID2)));                             // 再開
    await assertSucceeds(deleteDoc(vref(a, A, EID2)));                             // 同じ削除をもう一度(存在しなくても成功する)
    await assertSucceeds(deleteDoc(rref(a, A)));
  });

  await T('legacy data (created before epochs): readable, upgradable to an epoch, and deletable; old clients without an epoch stay blocked', async () => {
    await seed(async d => {
      await setDoc(rref(d, A), { schemaVersion: 1, createdAt: Timestamp.now() });
      await setDoc(vref(d, A, EID), { schemaVersion: 1, facilityId: 'onsen-001', sourceVisitId: 's', sourceDatasetId: 'd', date: null, notes: '', extra: '', status: 'active', revision: 1, lastOpId: 'old', createdAt: Timestamp.now(), updatedAt: Timestamp.now(), deletedAt: null, restoredAt: null });
    });
    const a = db(A);
    await assertSucceeds(getDoc(vref(a, A, EID)));                                  // 既存の記録は読める
    const noEpoch = visit(); delete noEpoch.epoch;
    await assertFails(setDoc(vref(a, A, 'event-new-0001'), noEpoch));              // 世代IDなしの書き込みは拒否
    await assertFails(setDoc(vref(a, A, 'event-new-0001'), visit()));              // ルートが旧形式の間は書き込めない
    await assertFails(updateDoc(rref(a, A), { epoch: 'epoch-0001' }));             // 項目が足りない移行は不可
    await assertFails(updateDoc(rref(a, A), { epoch: 'epoch-0001', status: 'deleting', deletingAt: null }));
    await assertSucceeds(updateDoc(rref(a, A), { epoch: 'epoch-0001', status: 'active', deletingAt: null }));   // 世代IDの付与(移行)
    await assertFails(updateDoc(rref(a, A), { epoch: 'epoch-0002', status: 'active', deletingAt: null }));      // 移行は一度だけ
    // 既存の記録は、世代IDを付けた更新で引き続き編集できる
    await assertSucceeds(updateDoc(vref(a, A, EID), { epoch: EP, notes: 'x', revision: 2, lastOpId: 'op-2', updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(vref(a, A, 'event-new-0001'), visit()));
  });

  await T('legacy root can start deletion directly, and the account can then be fully deleted', async () => {
    await seed(async d => { await setDoc(rref(d, A), { schemaVersion: 1, createdAt: Timestamp.now() }); await setDoc(vref(d, A, EID), { schemaVersion: 1, facilityId: 'onsen-001', sourceVisitId: 's', sourceDatasetId: 'd', date: null, notes: '', extra: '', status: 'active', revision: 1, lastOpId: 'old', createdAt: Timestamp.now(), updatedAt: Timestamp.now(), deletedAt: null, restoredAt: null }); });
    const a = db(A);
    await assertSucceeds(updateDoc(rref(a, A), { epoch: 'epoch-0009', status: 'deleting', deletingAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(vref(a, A, EID)));
    await assertSucceeds(deleteDoc(rref(a, A)));
  });

  await T('entitlements stay read-only for the owner (admin-only writes), and everything else is denied', async () => {
    const a = db(A);
    await seed(async d => { await setDoc(doc(d, 'entitlements', A), { plan: 'trial', cloudWriteUntil: Timestamp.now() }); });
    await assertSucceeds(getDoc(doc(a, 'entitlements', A)));
    await assertFails(setDoc(doc(a, 'entitlements', A), { plan: 'premium' }));       // 自分で有料資格を付けられない
    await assertFails(updateDoc(doc(a, 'entitlements', A), { plan: 'premium' }));
    await assertFails(deleteDoc(doc(a, 'entitlements', A)));
    await assertFails(getDoc(doc(db(B), 'entitlements', A)));
    for (const path of [['users', A], ['facilities', 'onsen-001'], ['accounts', A, 'other', 'x'], ['public', 'x']]) {
      await assertFails(getDoc(doc(a, ...path)));
      await assertFails(setDoc(doc(a, ...path), { x: 1 }));
    }
  });
});
