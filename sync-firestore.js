// Firestoreのアダプタ。sync-engine.js が使う契約(subscribe / push / createConflict / resolveConflict / ensureRoot)をFirestoreで実装する。
// ・保存先は accounts/{uid}/(visits | facilityNotes | conflicts)。UIDはAuthのセッションから渡す(メール・表示名は使わない)。
// ・書き込みはすべて「現在のrevisionを確認するトランザクション」。同じ opId の再送(応答を受け取れなかった場合)は二重に適用されない。
// ・リスナー(onSnapshot)は3つだけ。サーバーに到達した結果(fromCache でない)だけを「クラウドの現在値」とみなし、キャッシュの空を「空」と誤認しない。
// ・SDKは10.14.1(auth.js と同じバージョン)。Firestoreのメモリキャッシュのみ(永続キャッシュは使わない。オフラインの記録はローカルv3が正本)。
// ・世代ID(epoch): accounts/{uid} のルートに epoch と status(active/deleting)がある。すべての書き込みに epoch を付け、Rules がルートと照合する。
//   セルフサービス削除(deleteAll)は ①ルートを deleting にして書き込みを止める → ②配下を削除 → ③ルートを削除、の順。途中で失敗しても再実行で完了できる。
(function (root) {
  'use strict';
  function create({ sdk, db, uid, uuid }) {
    const { doc, collection, onSnapshot, runTransaction, serverTimestamp, getDoc, getDocs, updateDoc, writeBatch, deleteDoc } = sdk;
    const gen = uuid || (root.OnsenSyncCore && root.OnsenSyncCore.uuid) || (() => 'epoch-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
    const rootRef = () => doc(db, 'accounts', uid);
    const col = name => collection(db, 'accounts', uid, name);
    const ref = (name, id) => doc(db, 'accounts', uid, name, id);
    const visit = (id, d) => ({ eventId: id, facilityId: d.facilityId, sourceVisitId: d.sourceVisitId, date: d.date === undefined ? null : d.date, notes: d.notes || '', extra: d.extra || '', visitType: d.visitType || '', status: d.status, revision: d.revision, lastOpId: d.lastOpId });
    const note = (id, d) => ({ facilityId: d.facilityId || id, notes: d.notes || '', revision: d.revision, lastOpId: d.lastOpId });
    const conflict = (id, d) => ({ id, kind: d.kind, key: d.key, facilityId: d.facilityId, eventId: d.eventId, field: d.field, base: d.base, remote: d.remote, local: d.local, status: d.status });

    function subscribe(onData, onError) {
      const state = { visits: new Map(), notes: new Map(), conflicts: new Map(), root: { exists: false, epoch: null, status: null } }, ready = { v: false, n: false, c: false, r: false };
      let stopped = false, lastSig = null;
      const sig = () => JSON.stringify([ready, state.root, [...state.visits.values()].map(v => [v.eventId, v.revision]), [...state.notes.values()].map(n => [n.facilityId, n.revision]), [...state.conflicts.values()].map(c => [c.id, c.status])]);
      const emit = () => {
        if (stopped) return;
        const s = sig(); if (s === lastSig) return; lastSig = s;
        onData({ visits: new Map(state.visits), notes: new Map(state.notes), conflicts: new Map(state.conflicts), root: { ...state.root }, serverReady: ready.v && ready.n && ready.c && ready.r });
      };
      const listen = (name, key, flag, conv) => onSnapshot(col(name), { includeMetadataChanges: true }, snap => {
        ready[flag] = !snap.metadata.fromCache;
        const m = new Map(); snap.forEach(d => m.set(d.id, conv(d.id, d.data())));
        state[key] = m; emit();
      }, err => { ready[flag] = false; lastSig = null; if (!stopped) onError(err); });
      const listenRoot = () => onSnapshot(rootRef(), { includeMetadataChanges: true }, snap => {
        ready.r = !snap.metadata.fromCache;
        const d = snap.exists() ? snap.data() : null;
        state.root = { exists: !!d, epoch: d ? (d.epoch || null) : null, status: d ? (d.status || 'active') : null };
        emit();
      }, err => { ready.r = false; lastSig = null; if (!stopped) onError(err); });
      const offs = [listen('visits', 'visits', 'v', visit), listen('facilityNotes', 'notes', 'n', note), listen('conflicts', 'conflicts', 'c', conflict), listenRoot()];
      return () => { stopped = true; offs.forEach(f => f()); };
    }

    // ルートを用意して世代ID(epoch)を返す。ルートがなければ作り、旧形式(epochなし)なら世代IDを付ける。削除中(deleting)ならエラー
    async function ensureRoot(options = {}) {
      const r = rootRef();
      const epoch = gen();
      return runTransaction(db, async tx => {
        const s = await tx.get(r), cur = s.exists() ? s.data() : null;
        const expected = options.expectedRoot;
        if (expected && (expected.exists !== !!cur || (cur && expected.epoch !== (cur.epoch || null)))) throw Object.assign(new Error('cloud changed after preview'), { code: 'cloud-reset' });
        if (!cur) {
          if (options.allowCreate !== true) throw Object.assign(new Error('explicit consent required'), { code: 'cloud-reset' });
          tx.set(r, { schemaVersion: 1, createdAt: serverTimestamp(), epoch, status: 'active', deletingAt: null, creationVersion: 2 }); return { epoch, created: true };
        }
        if ((cur.status || 'active') === 'deleting') { const e = new Error('cloud data deletion is in progress'); e.code = 'cloud-deleting'; throw e; }
        if (!cur.epoch) { tx.update(r, { epoch, status: 'active', deletingAt: null, schemaVersion: 1, creationVersion: 2 }); return { epoch, upgraded: true }; }
        return { epoch: cur.epoch };
      });
    }

    async function push(op) {
      if (op.type === 'note') {
        const r = ref('facilityNotes', op.facilityId);
        return runTransaction(db, async tx => {
          const s = await tx.get(r), cur = s.exists() ? s.data() : null;
          if (!cur) { if (op.baseRevision !== 0) return { status: 'stale' }; tx.set(r, { schemaVersion: 1, epoch: op.epoch, facilityId: op.facilityId, notes: op.notes, revision: 1, lastOpId: op.opId, updatedAt: serverTimestamp() }); return { status: 'ok', revision: 1 }; }
          if (cur.lastOpId === op.opId) return { status: 'ok', revision: cur.revision };
          if (cur.revision !== op.baseRevision) return { status: 'stale' };
          tx.update(r, { epoch: op.epoch, notes: op.notes, revision: cur.revision + 1, lastOpId: op.opId, updatedAt: serverTimestamp() });
          return { status: 'ok', revision: cur.revision + 1 };
        });
      }
      const r = ref('visits', op.eventId);
      return runTransaction(db, async tx => {
        const s = await tx.get(r), cur = s.exists() ? s.data() : null;
        if (op.type === 'create') {
          if (cur) return { status: 'exists' };
          tx.set(r, { schemaVersion: 1, epoch: op.epoch, facilityId: op.facilityId, sourceVisitId: op.sourceVisitId, sourceDatasetId: op.datasetId, date: op.fields.date, notes: op.fields.notes, extra: op.fields.extra, visitType: op.fields.visitType || '', status: 'active', revision: 1, lastOpId: op.opId, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), deletedAt: null, restoredAt: null });
          return { status: 'ok', revision: 1 };
        }
        if (!cur) return { status: 'missing' };
        if (cur.lastOpId === op.opId) return { status: 'ok', revision: cur.revision };   // 応答を受け取れなかった再送
        if (cur.revision !== op.baseRevision) return { status: 'stale' };
        const common = { epoch: op.epoch, revision: cur.revision + 1, lastOpId: op.opId, updatedAt: serverTimestamp() };
        if (op.type === 'update') { if (cur.status !== 'active') return { status: 'stale' }; tx.update(r, { date: op.fields.date, notes: op.fields.notes, extra: op.fields.extra, visitType: op.fields.visitType || '', ...common }); }
        else if (op.type === 'delete') { tx.update(r, { status: 'deleted', deletedAt: serverTimestamp(), ...common }); }
        else if (op.type === 'restore') { if (cur.status !== 'deleted') return { status: 'stale' }; tx.update(r, { status: 'active', deletedAt: null, restoredAt: serverTimestamp(), date: op.fields.date, notes: op.fields.notes, extra: op.fields.extra, visitType: op.fields.visitType || '', ...common }); }
        else throw Error('unknown op ' + op.type);
        return { status: 'ok', revision: cur.revision + 1 };
      });
    }

    async function createConflict(c) {
      const r = ref('conflicts', c.id);
      await runTransaction(db, async tx => {
        const s = await tx.get(r);
        if (s.exists()) return;
        tx.set(r, { schemaVersion: 1, epoch: c.epoch, kind: c.kind, key: c.key, facilityId: c.facilityId, eventId: c.eventId || '', field: c.field, base: c.base, remote: c.remote, local: c.local, status: 'open', createdAt: serverTimestamp(), resolvedAt: null, resolution: '' });
      });
    }
    async function resolveConflict(id, patch) { await updateDoc(ref('conflicts', id), { status: 'resolved', resolvedAt: serverTimestamp(), resolution: patch.resolution }); }

    // ---- セルフサービス削除(クライアントだけで完結。Cloud Functions不要) ----
    // ①ルートを deleting にして書き込みを止める(古い端末の再送もRulesが拒否) → ②配下の文書を削除 → ③空を確認してルートを削除。
    // 失敗しても deleting のまま残るので、もう一度実行すれば続きから完了する。戻り値: { status:'nothing'|'deleted', counts }
    async function deleteAll(onProgress, batchSize, isCurrent = () => true) {
      const size = batchSize || 20, counts = { visits: 0, facilityNotes: 0, conflicts: 0 }, note = t => { if (onProgress) onProgress(t, counts); };
      const check = () => { if (!isCurrent()) throw Object.assign(new Error('account changed during deletion'), { code: 'delete-session-changed' }); };
      check();
      const snap = await (sdk.getDocFromServer || getDoc)(rootRef());
      check();
      if (!snap.exists()) { note('nothing'); return { status: 'nothing', counts }; }
      await runTransaction(db, async tx => {
        const s = await tx.get(rootRef()), cur = s.exists() ? s.data() : null;
        check();
        if (!cur) return;
        if ((cur.status || 'active') === 'deleting') return;
        tx.update(rootRef(), { epoch: cur.epoch || gen(), status: 'deleting', deletingAt: serverTimestamp(), schemaVersion: 1 });
      });
      note('stopped');
      for (let pass = 0; pass < 6; pass++) {
        let left = 0;
        for (const name of ['visits', 'facilityNotes', 'conflicts']) {
          check();
          const docs = (await (sdk.getDocsFromServer || getDocs)(col(name))).docs;
          left += docs.length;
          for (let i = 0; i < docs.length; i += size) {
            check();
            const b = writeBatch(db);
            for (const d of docs.slice(i, i + size)) b.delete(d.ref);
            await b.commit(); counts[name] += Math.min(size, docs.length - i); note('deleting');
          }
        }
        if (left === 0) break;
        if (pass === 5) { const e = new Error('cloud data remains after several passes'); e.code = 'delete-incomplete'; throw e; }
      }
      check();
      await deleteDoc(rootRef());
      note('done');
      return { status: 'deleted', counts };
    }

    return { subscribe, push, ensureRoot, createConflict, resolveConflict, deleteAll };
  }
  root.OnsenFirestoreAdapter = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = { create };
})(typeof window === 'undefined' ? globalThis : window);
