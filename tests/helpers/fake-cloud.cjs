// 試験用のメモリ上のクラウド(Firestoreと同じ意味のrevision・tombstone・冪等性・世代ID(epoch)・削除中の遮断)。Nodeのテストとブラウザのe2eの両方で使う。
// 実際のFirestoreアダプタ(sync-firestore.js)と同じ契約: push は {status:'ok'|'stale'|'exists'|'missing'} を返し、
// 世代・状態が合わない書き込みは Rules と同じく permission-denied で拒否する。
(function (root) {
  'use strict';
  const clone = x => JSON.parse(JSON.stringify(x));
  let uid = 0;
  const newEpoch = () => 'epoch-' + (++uid).toString(36).padStart(4, '0') + '-' + Math.random().toString(36).slice(2, 8);
  const denied = () => { const e = new Error('permission denied'); e.code = 'permission-denied'; return e; };
  class FakeCloud {
    constructor() { this.visits = new Map(); this.notes = new Map(); this.conflicts = new Map(); this.root = null; this.listeners = new Set(); this.online = true; this.loseNextResponse = false; this.writes = 0; this.deleteFailAfter = null; this.clock = 1; }
    get rootEnsured() { return !!this.root; }
    snapshot() {
      return { visits: new Map([...this.visits].map(([k, v]) => [k, clone(v)])), notes: new Map([...this.notes].map(([k, v]) => [k, clone(v)])), conflicts: new Map([...this.conflicts].map(([k, v]) => [k, clone(v)])),
        root: this.root ? { exists: true, epoch: this.root.epoch, status: this.root.status } : { exists: false, epoch: null, status: null }, serverReady: true };
    }
    emit() { for (const l of this.listeners) Promise.resolve().then(() => this.online && !l.ad.offline && l.fn(this.snapshot())); }
    // 旧形式(世代IDなし)のルートを用意する(移行の試験用)
    seedLegacyRoot() { this.root = { epoch: null, status: 'active', legacy: true }; }
    adapter() {
      const cloud = this, ad = { offline: false };
      const guard = () => { if (!cloud.online || ad.offline) { const e = new Error('offline'); e.code = 'unavailable'; throw e; } };
      // Rules: ルートが存在し active で、書き込みの epoch がルートの epoch と一致している時だけ書き込める
      const writable = op => { if (!cloud.root || cloud.root.status !== 'active' || !cloud.root.epoch || op.epoch !== cloud.root.epoch) throw denied(); };
      return Object.assign(ad, {
        subscribe(onData, onError) {
          const l = { ad, fn: s => onData(s) }; cloud.listeners.add(l);
          if (cloud.online && !ad.offline) Promise.resolve().then(() => onData(cloud.snapshot())); else Promise.resolve().then(() => { const e = new Error('offline'); e.code = 'unavailable'; onError(e); });
          return () => cloud.listeners.delete(l);
        },
        async ensureRoot(options = {}) {
          guard();
          const expected = options.expectedRoot;
          if (expected && (expected.exists !== !!cloud.root || (cloud.root && expected.epoch !== cloud.root.epoch))) throw Object.assign(Error('cloud changed'), { code: 'cloud-reset' });
          if (!cloud.root) {
            if (!options.allowCreate) throw Object.assign(Error('consent required'), { code: 'cloud-reset' });
            cloud.root = { epoch: newEpoch(), status: 'active' }; cloud.writes++; cloud.emit(); return { epoch: cloud.root.epoch, created: true };
          }
          if (cloud.root.status === 'deleting') { const e = new Error('cloud data deletion is in progress'); e.code = 'cloud-deleting'; throw e; }
          if (!cloud.root.epoch) { cloud.root.epoch = newEpoch(); cloud.root.legacy = false; cloud.writes++; cloud.emit(); return { epoch: cloud.root.epoch, upgraded: true }; }
          return { epoch: cloud.root.epoch };
        },
        async createConflict(c) { guard(); writable(c); if (!cloud.conflicts.has(c.id)) { cloud.conflicts.set(c.id, { ...clone(c), status: 'open' }); cloud.writes++; cloud.emit(); } },
        async resolveConflict(id, patch) { guard(); if (!cloud.root || cloud.root.status !== 'active') throw denied(); const c = cloud.conflicts.get(id); if (c) { c.status = 'resolved'; c.resolution = patch.resolution; cloud.writes++; cloud.emit(); } },
        async push(op) {
          guard(); writable(op);
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
        },
        // 実アダプタと同じ順序: ルートを deleting → 配下を削除 → ルートを削除。deleteFailAfter 件の削除後に失敗させて「途中失敗」を再現できる
        async deleteAll(onProgress) {
          guard();
          const counts = { visits: 0, facilityNotes: 0, conflicts: 0 };
          if (!cloud.root) return { status: 'nothing', counts };
          if (cloud.root.status === 'active') { cloud.root.status = 'deleting'; cloud.writes++; cloud.emit(); }
          if (onProgress) onProgress('stopped', counts);
          for (const [name, map] of [['visits', cloud.visits], ['facilityNotes', cloud.notes], ['conflicts', cloud.conflicts]]) {
            for (const key of [...map.keys()]) {
              if (cloud.deleteFailAfter !== null) { if (cloud.deleteFailAfter <= 0) { cloud.deleteFailAfter = null; const e = new Error('offline'); e.code = 'unavailable'; throw e; } cloud.deleteFailAfter--; }
              map.delete(key); counts[name]++; cloud.writes++;
            }
          }
          cloud.root = null; cloud.writes++; cloud.emit();
          if (onProgress) onProgress('done', counts);
          return { status: 'deleted', counts };
        }
      });
    }
  }
  root.FakeCloud = FakeCloud;
})(typeof window === 'undefined' ? globalThis : window);
