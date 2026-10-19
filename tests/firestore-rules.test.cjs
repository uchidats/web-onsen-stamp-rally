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
  const A = 'user-aaaaaaaa', B = 'user-bbbbbbbb';
  const db = uid => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
  const visit = (over = {}) => ({ schemaVersion: 1, facilityId: 'onsen-001', sourceVisitId: 'src-1', sourceDatasetId: 'ds-1', date: '2026-01-02', notes: '', extra: '', status: 'active', revision: 1, lastOpId: 'op-1', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), deletedAt: null, restoredAt: null, ...over });
  const note = (over = {}) => ({ schemaVersion: 1, facilityId: 'onsen-001', notes: 'メモ', revision: 1, lastOpId: 'op-1', updatedAt: serverTimestamp(), ...over });
  const conflict = (over = {}) => ({ schemaVersion: 1, kind: 'facilityNote', key: 'note:onsen-001', facilityId: 'onsen-001', eventId: '', field: 'notes', base: '{}', remote: '{"notes":"a"}', local: '{"notes":"b"}', status: 'open', createdAt: serverTimestamp(), resolvedAt: null, resolution: '', ...over });
  const vref = (d, uid, id) => doc(d, 'accounts', uid, 'visits', id);
  const EID = 'event-0001', EID2 = 'event-0002';
  const reset = async () => { await env.clearFirestore(); };
  const seed = async fn => env.withSecurityRulesDisabled(async ctx => fn(ctx.firestore()));
  const T = (name, fn) => t.test(name, async () => { await reset(); await fn(); });

  await T('unauthenticated users can read and write nothing', async () => {
    await seed(async d => { await setDoc(vref(d, A, EID), visit({ createdAt: Timestamp.now(), updatedAt: Timestamp.now() })); });
    const d = db(null);
    await assertFails(getDoc(vref(d, A, EID)));
    await assertFails(setDoc(vref(d, A, EID2), visit()));
    await assertFails(getDocs(collection(d, 'accounts', A, 'visits')));
  });

  await T('the owner can create and read; another user can neither read nor write the owner\'s data (visits, notes, conflicts, root)', async () => {
    const a = db(A), b = db(B);
    await assertSucceeds(setDoc(doc(a, 'accounts', A), { schemaVersion: 1, createdAt: serverTimestamp() }));
    await assertSucceeds(setDoc(vref(a, A, EID), visit()));
    await assertSucceeds(setDoc(doc(a, 'accounts', A, 'facilityNotes', 'onsen-001'), note()));
    await assertSucceeds(setDoc(doc(a, 'accounts', A, 'conflicts', 'c1'), conflict()));
    await assertSucceeds(getDoc(vref(a, A, EID)));
    await assertSucceeds(getDocs(collection(a, 'accounts', A, 'visits')));
    for (const ref of [vref(b, A, EID), doc(b, 'accounts', A), doc(b, 'accounts', A, 'facilityNotes', 'onsen-001'), doc(b, 'accounts', A, 'conflicts', 'c1')]) await assertFails(getDoc(ref));
    await assertFails(getDocs(collection(b, 'accounts', A, 'visits')));
    await assertFails(setDoc(vref(b, A, EID2), visit()));
    await assertFails(updateDoc(vref(b, A, EID), { notes: 'x', revision: 2, lastOpId: 'op-2', updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(vref(b, A, EID)));
    await assertFails(setDoc(doc(b, 'accounts', A, 'facilityNotes', 'onsen-002'), note({ facilityId: 'onsen-002' })));
    // 自分の領域は別のユーザーでも作れる(UID単位)
    await assertSucceeds(setDoc(vref(b, B, EID), visit()));
    await assertFails(getDoc(vref(a, B, EID)));
  });

  await T('visit create is validated: revision 1, status active, server timestamps, exact fields, formats and sizes', async () => {
    const a = db(A);
    const bad = [visit({ revision: 2 }), visit({ status: 'deleted', deletedAt: serverTimestamp() }), visit({ createdAt: Timestamp.now() }), visit({ updatedAt: Timestamp.now() }),
      visit({ date: '2026/01/02' }), visit({ date: 5 }), visit({ facilityId: 'hotel-1' }), visit({ facilityId: 'onsen-001/../x' }), visit({ notes: 'x'.repeat(10001) }), visit({ extra: 'x'.repeat(20001) }),
      visit({ schemaVersion: 2 }), visit({ lastOpId: '' }), visit({ restoredAt: serverTimestamp() }), { ...visit(), unexpected: 1 }];
    for (const [i, v] of bad.entries()) await assertFails(setDoc(vref(a, A, 'event-bad-' + i), v));
    const missing = visit(); delete missing.extra; await assertFails(setDoc(vref(a, A, 'event-miss-1'), missing));
    await assertFails(setDoc(vref(a, A, 'short'), visit()));                      // eventId が短い
    await assertSucceeds(setDoc(vref(a, A, 'event-null-date'), visit({ date: null })));   // 日付なしの訪問
    await assertSucceeds(setDoc(vref(a, A, 'event-same-day-1'), visit({ sourceVisitId: 's1' })));
    await assertSucceeds(setDoc(vref(a, A, 'event-same-day-2'), visit({ sourceVisitId: 's2' })));  // 同じ日付でも別の訪問として保存できる
    await assertSucceeds(setDoc(vref(a, A, 'event-notes-max'), visit({ notes: 'あ'.repeat(10000) })));
  });

  await T('visit update requires revision+1, immutable identity fields, and cannot resurrect deleted records except by an explicit restore', async () => {
    const a = db(A);
    await assertSucceeds(setDoc(vref(a, A, EID), visit()));
    const edit = (over = {}) => ({ date: '2026-02-02', notes: 'n', revision: 2, lastOpId: 'op-2', updatedAt: serverTimestamp(), ...over });
    await assertFails(updateDoc(vref(a, A, EID), edit({ revision: 1 })));          // 同じrevision
    await assertFails(updateDoc(vref(a, A, EID), edit({ revision: 3 })));          // 飛ばしたrevision
    await assertFails(updateDoc(vref(a, A, EID), edit({ facilityId: 'onsen-002' })));
    await assertFails(updateDoc(vref(a, A, EID), edit({ sourceVisitId: 'other' })));
    await assertFails(updateDoc(vref(a, A, EID), edit({ createdAt: Timestamp.now() })));
    await assertFails(updateDoc(vref(a, A, EID), edit({ updatedAt: Timestamp.now() })));
    await assertFails(updateDoc(vref(a, A, EID), edit({ deletedAt: serverTimestamp() })));     // activeのまま削除印は付けられない
    await assertFails(updateDoc(vref(a, A, EID), edit({ date: 'bad' })));
    await assertSucceeds(updateDoc(vref(a, A, EID), edit()));
    // 削除(tombstone): deletedAt はサーバー時刻、物理deleteは禁止
    await assertFails(updateDoc(vref(a, A, EID), { status: 'deleted', revision: 3, lastOpId: 'op-3', updatedAt: serverTimestamp(), deletedAt: Timestamp.now() }));
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

  await T('facility notes: owner only, revision+1, bounded, never deletable', async () => {
    const a = db(A), r = id => doc(a, 'accounts', A, 'facilityNotes', id);
    await assertFails(setDoc(r('onsen-001'), note({ revision: 2 })));
    await assertFails(setDoc(r('onsen-001'), note({ facilityId: 'onsen-002' })));
    await assertFails(setDoc(r('onsen-001'), note({ notes: 'x'.repeat(10001) })));
    await assertFails(setDoc(r('bad-id'), note({ facilityId: 'bad-id' })));
    await assertSucceeds(setDoc(r('onsen-001'), note()));
    await assertFails(updateDoc(r('onsen-001'), { notes: 'y', revision: 1, lastOpId: 'op-2', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(r('onsen-001'), { notes: '', revision: 2, lastOpId: 'op-2', updatedAt: serverTimestamp() }));     // 空文字への変更(明示的な消去)
    await assertFails(deleteDoc(r('onsen-001')));
  });

  await T('conflicts keep both versions: create open; only open -> resolved is allowed; contents are immutable; no delete', async () => {
    const a = db(A), r = id => doc(a, 'accounts', A, 'conflicts', id);
    await assertFails(setDoc(r('c1'), conflict({ status: 'resolved' })));
    await assertFails(setDoc(r('c1'), conflict({ kind: 'other' })));
    await assertFails(setDoc(r('c1'), conflict({ local: 'x'.repeat(30001) })));
    await assertSucceeds(setDoc(r('c1'), conflict()));
    await assertFails(updateDoc(r('c1'), { local: '{"notes":"tampered"}' }));
    await assertFails(updateDoc(r('c1'), { status: 'resolved', resolvedAt: serverTimestamp(), resolution: 'hack' }));
    await assertFails(updateDoc(r('c1'), { status: 'resolved', resolvedAt: serverTimestamp(), resolution: 'merge', remote: 'changed' }));
    await assertSucceeds(updateDoc(r('c1'), { status: 'resolved', resolvedAt: serverTimestamp(), resolution: 'merge' }));
    await assertFails(updateDoc(r('c1'), { status: 'open', resolvedAt: null, resolution: '' }));       // 解決済みを開き直せない
    await assertFails(deleteDoc(r('c1')));
  });

  await T('root document and entitlements: owner may create the root once; entitlements are read-only for the owner (admin-only writes)', async () => {
    const a = db(A);
    await assertFails(setDoc(doc(a, 'accounts', A), { schemaVersion: 1, createdAt: Timestamp.now() }));
    await assertFails(setDoc(doc(a, 'accounts', A), { schemaVersion: 1, createdAt: serverTimestamp(), admin: true }));
    await assertSucceeds(setDoc(doc(a, 'accounts', A), { schemaVersion: 1, createdAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(a, 'accounts', A), { schemaVersion: 2 }));
    await assertFails(deleteDoc(doc(a, 'accounts', A)));
    await seed(async d => { await setDoc(doc(d, 'entitlements', A), { plan: 'trial', cloudWriteUntil: Timestamp.now() }); });
    await assertSucceeds(getDoc(doc(a, 'entitlements', A)));
    await assertFails(setDoc(doc(a, 'entitlements', A), { plan: 'premium' }));       // 自分で有料資格を付けられない
    await assertFails(updateDoc(doc(a, 'entitlements', A), { plan: 'premium' }));
    await assertFails(getDoc(doc(db(B), 'entitlements', A)));
  });

  await T('everything outside accounts/{uid} and entitlements/{uid} is denied (including a facility master copy)', async () => {
    const a = db(A);
    for (const path of [['users', A], ['facilities', 'onsen-001'], ['accounts', A, 'other', 'x'], ['public', 'x']]) {
      await assertFails(getDoc(doc(a, ...path)));
      await assertFails(setDoc(doc(a, ...path), { x: 1 }));
    }
  });
});
