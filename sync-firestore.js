// Firestoreのアダプタ。sync-engine.js が使う契約(subscribe / push / createConflict / resolveConflict / ensureRoot)をFirestoreで実装する。
// ・保存先は accounts/{uid}/(visits | facilityNotes | conflicts)。UIDはAuthのセッションから渡す(メール・表示名は使わない)。
// ・書き込みはすべて「現在のrevisionを確認するトランザクション」。同じ opId の再送(応答を受け取れなかった場合)は二重に適用されない。
// ・リスナー(onSnapshot)は3つだけ。サーバーに到達した結果(fromCache でない)だけを「クラウドの現在値」とみなし、キャッシュの空を「空」と誤認しない。
// ・SDKは10.14.1(auth.js と同じバージョン)。Firestoreのメモリキャッシュのみ(永続キャッシュは使わない。オフラインの記録はローカルv3が正本)。
(function (root) {
  'use strict';
  function create({ sdk, db, uid }) {
    const { doc, collection, onSnapshot, runTransaction, serverTimestamp, getDoc, setDoc, updateDoc } = sdk;
    const col = name => collection(db, 'accounts', uid, name);
    const ref = (name, id) => doc(db, 'accounts', uid, name, id);
    const visit = (id, d) => ({ eventId: id, facilityId: d.facilityId, sourceVisitId: d.sourceVisitId, date: d.date === undefined ? null : d.date, notes: d.notes || '', extra: d.extra || '', status: d.status, revision: d.revision, lastOpId: d.lastOpId });
    const note = (id, d) => ({ facilityId: d.facilityId || id, notes: d.notes || '', revision: d.revision, lastOpId: d.lastOpId });
    const conflict = (id, d) => ({ id, kind: d.kind, key: d.key, facilityId: d.facilityId, eventId: d.eventId, field: d.field, base: d.base, remote: d.remote, local: d.local, status: d.status });

    function subscribe(onData, onError) {
      const state = { visits: new Map(), notes: new Map(), conflicts: new Map() }, ready = { v: false, n: false, c: false };
      let stopped = false, lastSig = null;
      const sig = () => JSON.stringify([ready, [...state.visits.values()].map(v => [v.eventId, v.revision]), [...state.notes.values()].map(n => [n.facilityId, n.revision]), [...state.conflicts.values()].map(c => [c.id, c.status])]);
      const emit = () => {
        if (stopped) return;
        const s = sig(); if (s === lastSig) return; lastSig = s;
        onData({ visits: new Map(state.visits), notes: new Map(state.notes), conflicts: new Map(state.conflicts), serverReady: ready.v && ready.n && ready.c });
      };
      const listen = (name, key, flag, conv) => onSnapshot(col(name), { includeMetadataChanges: true }, snap => {
        ready[flag] = !snap.metadata.fromCache;
        const m = new Map(); snap.forEach(d => m.set(d.id, conv(d.id, d.data())));
        state[key] = m; emit();
      }, err => { ready[flag] = false; lastSig = null; if (!stopped) onError(err); });
      const offs = [listen('visits', 'visits', 'v', visit), listen('facilityNotes', 'notes', 'n', note), listen('conflicts', 'conflicts', 'c', conflict)];
      return () => { stopped = true; offs.forEach(f => f()); };
    }

    async function ensureRoot() {
      const r = doc(db, 'accounts', uid), snap = await getDoc(r);
      if (!snap.exists()) await setDoc(r, { schemaVersion: 1, createdAt: serverTimestamp() });
    }

    async function push(op) {
      if (op.type === 'note') {
        const r = ref('facilityNotes', op.facilityId);
        return runTransaction(db, async tx => {
          const s = await tx.get(r), cur = s.exists() ? s.data() : null;
          if (!cur) { if (op.baseRevision !== 0) return { status: 'stale' }; tx.set(r, { schemaVersion: 1, facilityId: op.facilityId, notes: op.notes, revision: 1, lastOpId: op.opId, updatedAt: serverTimestamp() }); return { status: 'ok', revision: 1 }; }
          if (cur.lastOpId === op.opId) return { status: 'ok', revision: cur.revision };
          if (cur.revision !== op.baseRevision) return { status: 'stale' };
          tx.update(r, { notes: op.notes, revision: cur.revision + 1, lastOpId: op.opId, updatedAt: serverTimestamp() });
          return { status: 'ok', revision: cur.revision + 1 };
        });
      }
      const r = ref('visits', op.eventId);
      return runTransaction(db, async tx => {
        const s = await tx.get(r), cur = s.exists() ? s.data() : null;
        if (op.type === 'create') {
          if (cur) return { status: 'exists' };
          tx.set(r, { schemaVersion: 1, facilityId: op.facilityId, sourceVisitId: op.sourceVisitId, sourceDatasetId: op.datasetId, date: op.fields.date, notes: op.fields.notes, extra: op.fields.extra, status: 'active', revision: 1, lastOpId: op.opId, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), deletedAt: null, restoredAt: null });
          return { status: 'ok', revision: 1 };
        }
        if (!cur) return { status: 'missing' };
        if (cur.lastOpId === op.opId) return { status: 'ok', revision: cur.revision };   // 応答を受け取れなかった再送
        if (cur.revision !== op.baseRevision) return { status: 'stale' };
        const common = { revision: cur.revision + 1, lastOpId: op.opId, updatedAt: serverTimestamp() };
        if (op.type === 'update') { if (cur.status !== 'active') return { status: 'stale' }; tx.update(r, { date: op.fields.date, notes: op.fields.notes, extra: op.fields.extra, ...common }); }
        else if (op.type === 'delete') { tx.update(r, { status: 'deleted', deletedAt: serverTimestamp(), ...common }); }
        else if (op.type === 'restore') { if (cur.status !== 'deleted') return { status: 'stale' }; tx.update(r, { status: 'active', deletedAt: null, restoredAt: serverTimestamp(), date: op.fields.date, notes: op.fields.notes, extra: op.fields.extra, ...common }); }
        else throw Error('unknown op ' + op.type);
        return { status: 'ok', revision: cur.revision + 1 };
      });
    }

    async function createConflict(c) {
      const r = ref('conflicts', c.id);
      await runTransaction(db, async tx => {
        const s = await tx.get(r);
        if (s.exists()) return;
        tx.set(r, { schemaVersion: 1, kind: c.kind, key: c.key, facilityId: c.facilityId, eventId: c.eventId || '', field: c.field, base: c.base, remote: c.remote, local: c.local, status: 'open', createdAt: serverTimestamp(), resolvedAt: null, resolution: '' });
      });
    }
    async function resolveConflict(id, patch) { await updateDoc(ref('conflicts', id), { status: 'resolved', resolvedAt: serverTimestamp(), resolution: patch.resolution }); }

    return { subscribe, push, ensureRoot, createConflict, resolveConflict };
  }
  root.OnsenFirestoreAdapter = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = { create };
})(typeof window === 'undefined' ? globalThis : window);
