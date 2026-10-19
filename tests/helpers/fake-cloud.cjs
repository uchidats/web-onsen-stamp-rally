// 試験用のメモリ上のクラウド(Firestoreと同じ意味のrevision・tombstone・冪等性)。Nodeのテストとブラウザのe2eの両方で使う。
// 実際のFirestoreアダプタ(sync-firestore.js)と同じ契約: push は {status:'ok'|'stale'|'exists'|'missing'} を返す。
(function (root) {
  'use strict';
  const clone = x => JSON.parse(JSON.stringify(x));
  class FakeCloud {
    constructor() { this.visits = new Map(); this.notes = new Map(); this.conflicts = new Map(); this.listeners = new Set(); this.online = true; this.loseNextResponse = false; this.writes = 0; this.rootEnsured = false; this.clock = 1; }
    snapshot() { return { visits: new Map([...this.visits].map(([k, v]) => [k, clone(v)])), notes: new Map([...this.notes].map(([k, v]) => [k, clone(v)])), conflicts: new Map([...this.conflicts].map(([k, v]) => [k, clone(v)])), serverReady: true }; }
    emit() { for (const l of this.listeners) Promise.resolve().then(() => this.online && !l.ad.offline && l.fn(this.snapshot())); }
    adapter() {
      const cloud = this, ad = { offline: false };
      const guard = () => { if (!cloud.online || ad.offline) { const e = new Error('offline'); e.code = 'unavailable'; throw e; } };
      return Object.assign(ad, {
        subscribe(onData, onError) {
          const l = { ad, fn: s => onData(s) }; cloud.listeners.add(l);
          if (cloud.online && !ad.offline) Promise.resolve().then(() => onData(cloud.snapshot())); else Promise.resolve().then(() => { const e = new Error('offline'); e.code = 'unavailable'; onError(e); });
          return () => cloud.listeners.delete(l);
        },
        async ensureRoot() { guard(); cloud.rootEnsured = true; },
        async createConflict(c) { guard(); if (!cloud.conflicts.has(c.id)) { cloud.conflicts.set(c.id, { ...clone(c), status: 'open' }); cloud.writes++; cloud.emit(); } },
        async resolveConflict(id, patch) { guard(); const c = cloud.conflicts.get(id); if (c) { c.status = 'resolved'; c.resolution = patch.resolution; cloud.writes++; cloud.emit(); } },
        async push(op) {
          guard();
          const done = result => { cloud.emit(); if (cloud.loseNextResponse) { cloud.loseNextResponse = false; const e = new Error('lost response'); e.code = 'unavailable'; throw e; } return result; };
          if (op.type === 'note') {
            const cur = cloud.notes.get(op.facilityId);
            if (!cur) { if (op.baseRevision !== 0) return { status: 'stale' }; cloud.notes.set(op.facilityId, { facilityId: op.facilityId, notes: op.notes, revision: 1, lastOpId: op.opId }); cloud.writes++; return done({ status: 'ok', revision: 1 }); }
            if (cur.lastOpId === op.opId) return { status: 'ok', revision: cur.revision };
            if (cur.revision !== op.baseRevision) return { status: 'stale' };
            cur.notes = op.notes; cur.revision++; cur.lastOpId = op.opId; cloud.writes++; return done({ status: 'ok', revision: cur.revision });
          }
          const cur = cloud.visits.get(op.eventId);
          if (op.type === 'create') {
            if (cur) return { status: 'exists' };
            cloud.visits.set(op.eventId, { eventId: op.eventId, facilityId: op.facilityId, sourceVisitId: op.sourceVisitId, sourceDatasetId: op.datasetId, ...op.fields, status: 'active', revision: 1, lastOpId: op.opId });
            cloud.writes++; return done({ status: 'ok', revision: 1 });
          }
          if (!cur) return { status: 'missing' };
          if (cur.lastOpId === op.opId) return { status: 'ok', revision: cur.revision };
          if (cur.revision !== op.baseRevision) return { status: 'stale' };
          if (op.type === 'update') { if (cur.status !== 'active') return { status: 'stale' }; Object.assign(cur, op.fields); }
          else if (op.type === 'delete') { cur.status = 'deleted'; }
          else if (op.type === 'restore') { if (cur.status !== 'deleted') return { status: 'stale' }; Object.assign(cur, op.fields, { status: 'active' }); }
          cur.revision++; cur.lastOpId = op.opId; cloud.writes++; return done({ status: 'ok', revision: cur.revision });
        }
      });
    }
  }
  root.FakeCloud = FakeCloud;
})(typeof window === 'undefined' ? globalThis : window);
