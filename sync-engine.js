// クラウド同期のエンジン(画面・Firebase SDKに依存しない)。ローカルの訪問記録(OnsenRecords)と、アダプタ(Firestore等)の間で同期する。
// ・ローカル(localStorage の v3)が常に正本で、オフラインでもそのまま記録できる。変更は「ローカル現在値 − 最後に同期できた値(base)」の差として検出し、オンラインで送る。
// ・クラウドへの書き込みは、現在のrevisionを確認するトランザクション。ずれていれば(stale)最新を読み直して三者比較をやり直す。
// ・初回/復元後は「統合モード」: 何も削除せず、両方の記録の和集合にする。同じIDで内容が違うもの・削除済みの記録は競合として保留する。
// ・不自然な件数減少(一定割合以上の削除)を検出したら同期を止める。失敗してもローカルの記録は一切消さない。
// ・同期の所有者(uid)を端末に記録する。別アカウントでログインした時は、統合の確認を経るまで送受信しない。
// アダプタ: subscribe(onData,onError)->unsubscribe / push(op)->{status} / createConflict(c) / resolveConflict(id,patch) / ensureRoot()
(function(root){'use strict';
  const Core = root.OnsenSyncCore;
  const META_KEY = 'onsen-rally-sync-v1', SAFE_KEY = 'onsen-rally-before-sync-v1';
  const clone = x => JSON.parse(JSON.stringify(x));
  const errCode = e => String((e && e.code) || '').replace(/^firestore\//, '');
  const OFFLINE_CODES = ['unavailable', 'deadline-exceeded', 'network-request-failed', 'cancelled'];

  function create(o) {
    const storage = o.storage, metaKey = o.metaKey || META_KEY, safeKey = o.safeKey || SAFE_KEY;
    const genId = o.genId || Core.uuid, debounceMs = o.debounceMs === undefined ? 1200 : o.debounceMs;
    let meta = null, cloud = null, unsub = null, running = null, again = false, stopped = false, timer = null, applying = false, ownerChanged = false, status = { state: 'idle', detail: '', conflicts: 0 };

    function loadMeta() {
      try { const m = JSON.parse(storage.getItem(metaKey)); if (m && m.v === 1 && typeof m.uid === 'string') return m; } catch (e) { /* 壊れていれば作り直す(記録そのものは別の保存領域にある) */ }
      return null;
    }
    function saveMeta() { storage.setItem(metaKey, JSON.stringify(meta)); }
    function fresh() { return { v: 1, uid: o.uid, projectId: o.projectId, datasetId: genId(), initialized: false, needsReconcile: true, idMap: {}, base: { events: {}, notes: {} }, seen: {}, applied: {}, lastSyncAt: null }; }
    function setStatus(state, detail, extra) {
      status = { state, detail: detail || '', conflicts: cloud ? [...cloud.conflicts.values()].filter(c => c.status === 'open').length : 0, ...(extra || {}) };
      if (o.onStatus) o.onStatus(status);
    }
    const openConflicts = () => cloud ? [...cloud.conflicts.values()].filter(c => c.status === 'open') : [];

    // ---- 初回・復元後の確認用の要約(何も書き換えない) ----
    function preview() {
      let n = 0; const lp = Core.projectLocal(o.getState(), clone(meta.idMap), () => 'preview-' + (++n) + '-xxxxxxxx'), res = Core.reconcile({ local: lp, cloud, base: { events: {}, notes: {} }, frozen: new Set() });
      let cloudDeleted = 0; for (const d of cloud.visits.values()) if (d.status === 'deleted') cloudDeleted++;
      return { local: Core.summarize(o.getState(), meta.idMap), cloud: { visits: Core.countCloudActive(cloud.visits), deleted: cloudDeleted, conflictsOpen: openConflicts().length },
        willUpload: res.pushes.filter(p => p.type === 'create').length, willDownload: res.changes.filter(c => c.type === 'add').length, conflicts: res.conflicts.length, otherAccount: ownerChanged };
    }

    async function writeConflicts(list) {
      for (const c of list) await o.adapter.createConflict({ id: c.id, kind: c.kind, key: c.key, facilityId: c.facilityId, eventId: c.eventId || '', field: c.field, base: JSON.stringify(c.base), remote: JSON.stringify(c.remote), local: JSON.stringify(c.local) });
    }
    function applyLocal(changes) {
      if (!changes.length) return;
      applying = true;
      try { const next = o.repo.transform(o.getState(), ud => Core.applyChanges(ud, changes, meta.idMap)); o.setState(next); } finally { applying = false; }
    }
    function applyBase(baseNow) {
      for (const [id, v] of Object.entries(baseNow.events)) meta.base.events[id] = v;
      for (const [id, v] of Object.entries(baseNow.notes)) meta.base.notes[id] = v;
      for (const id of baseNow.dropEvents) delete meta.base.events[id];
      for (const id of baseNow.dropNotes) delete meta.base.notes[id];
    }

    // 他の端末で解決された競合: この端末でも競合として見ていたものだけ、解決後のクラウドの値をこの端末にも反映する(同じ競合を何度も出さない)
    function adoptResolved() {
      const changes = [], baseNow = { events: {}, notes: {}, dropEvents: [], dropNotes: [] };
      for (const c of cloud.conflicts.values()) {
        if (c.status !== 'resolved' || !meta.seen[c.id] || meta.applied[c.id]) continue;
        meta.applied[c.id] = 1;
        const doc = c.eventId ? cloud.visits.get(c.eventId) : null, note = cloud.notes.get(c.facilityId);
        const lp = Core.projectLocal(o.getState(), clone(meta.idMap), () => 'tmp-xxxxxxxx');
        if (c.kind === 'facilityNote' && note) { changes.push({ type: 'setNote', facilityId: c.facilityId, notes: note.notes }); baseNow.notes[c.facilityId] = { rev: note.revision, notes: note.notes }; }
        else if (c.kind !== 'facilityNote' && doc) {
          const has = lp.events.has(c.eventId);
          if (doc.status === 'active') { changes.push({ type: has ? 'update' : 'add', eventId: c.eventId, facilityId: doc.facilityId, ...Core.fieldsOf(doc) }); baseNow.events[c.eventId] = { rev: doc.revision, ...Core.fieldsOf(doc) }; }
          else if (has) { changes.push({ type: 'delete', eventId: c.eventId, facilityId: doc.facilityId }); baseNow.dropEvents.push(c.eventId); }
        }
      }
      if (changes.length) { applyLocal(changes); applyBase(baseNow); }
      saveMeta();
    }

    async function pushOne(p, tries) {
      const op = { ...p, opId: genId(), datasetId: meta.datasetId };
      const r = await o.adapter.push(op);
      if (r.status === 'ok') {
        if (p.type === 'delete') delete meta.base.events[p.eventId];
        else if (p.type === 'note') meta.base.notes[p.facilityId] = { rev: r.revision, notes: p.notes };
        else meta.base.events[p.eventId] = { rev: r.revision, ...p.fields };
        if (p.type === 'delete' && p.remoteEdited) await writeConflicts([{ id: 'editVsDelete-' + p.eventId + '-r' + p.baseRevision, kind: 'editVsDelete', key: 'edit:' + p.eventId, eventId: p.eventId, facilityId: p.facilityId, field: 'record', base: p.base, remote: p.remote, local: null }]);
        return true;
      }
      return false; // stale / exists / missing → 最新を読み直して比較し直す
    }

    async function once() {
      if (stopped) return;
      if (!meta.initialized) { setStatus('consent', '', { summary: cloud && cloud.serverReady ? preview() : null }); return; }
      if (!cloud || !cloud.serverReady) { setStatus(o.isOnline && !o.isOnline() ? 'offline' : 'syncing', 'クラウドの状態を確認しています'); return; }
      if (o.repo.needsMigration && o.repo.needsMigration()) { setStatus('error', '旧記録の移行を確認してから同期します'); return; }
      setStatus('syncing');
      const mode = meta.needsReconcile;
      for (let attempt = 0; attempt < 5; attempt++) {
        if (stopped) return;
        meta.seen = meta.seen || {}; meta.applied = meta.applied || {};
        for (const c of openConflicts()) meta.seen[c.id] = 1;
        adoptResolved();
        const lp = Core.projectLocal(o.getState(), meta.idMap, genId); meta.idMap = lp.idMap;
        if (lp.problems.length) { saveMeta(); setStatus('error', 'サイズが大きすぎる記録があるため同期できません(記録は端末に残っています)'); return; }
        const frozen = new Set(openConflicts().map(c => c.key));
        if (mode && attempt === 0) meta.base = { events: {}, notes: {} };   // 統合モードは基準なしで比較する(削除は一切しない)
        const res = Core.reconcile({ local: lp, cloud, base: meta.base, frozen });
        const delLocal = res.changes.filter(c => c.type === 'delete').length, delRemote = res.pushes.filter(p => p.type === 'delete').length;
        if (!mode && Core.unnaturalDecrease({ before: Math.max(lp.events.size, Object.keys(meta.base.events).length), deletesLocal: delLocal, deletesRemote: delRemote })) {
          saveMeta(); setStatus('error', '記録の件数が大きく減るため同期を止めました。端末の記録を確認し、「クラウドと照合して復元」を実行してください', { safety: true }); return;
        }
        if (res.conflicts.length) await writeConflicts(res.conflicts);
        applyLocal(res.changes);
        applyBase(res.baseNow);
        saveMeta();
        let stale = false;
        for (const p of res.pushes) { if (stopped) return; if (!await pushOne(p)) { stale = true; break; } saveMeta(); }
        if (!stale) {
          meta.needsReconcile = false; meta.lastSyncAt = o.now ? o.now() : Date.now(); saveMeta();
          const n = openConflicts().length + res.conflicts.length;
          setStatus(n ? 'conflicts' : 'synced', '', { conflicts: n });
          return;
        }
        await (o.afterStale ? o.afterStale() : new Promise(r => setTimeout(r, 300))); // リスナーが最新の値を届けるのを待つ
      }
      setStatus('error', '他の端末の更新と重なっています。少し待ってからもう一度お試しください');
    }

    function run() {
      if (running) { again = true; return running; }
      running = (async () => {
        try { do { again = false; await once(); } while (again && !stopped); }
        catch (e) {
          const c = errCode(e);
          if (OFFLINE_CODES.includes(c) || (o.isOnline && !o.isOnline())) setStatus('offline', 'オフラインです。オンラインに戻ると自動で同期します');
          else if (c === 'permission-denied') setStatus('error', 'クラウドへの保存が許可されていません(ルール・権限を確認してください)', { code: c });
          else setStatus('error', '同期できませんでした。記録は端末に残っています。(' + (c || 'unknown') + ')', { code: c });
        } finally { running = null; }
      })();
      return running;
    }

    return {
      get applying() { return applying; },
      status: () => status, meta: () => meta, openConflicts, preview: () => (meta && cloud && cloud.serverReady ? preview() : null),
      async start() {
        stopped = false; meta = loadMeta();
        if (meta && meta.uid !== o.uid) { ownerChanged = true; meta = { ...fresh(), idMap: meta.idMap }; }
        if (!meta) { meta = fresh(); }
        if (!meta.initialized || ownerChanged) saveMeta();
        setStatus('syncing', 'クラウドの状態を確認しています');
        unsub = o.adapter.subscribe(snap => { if (stopped) return; cloud = snap; if (!snap.serverReady) return; if (!meta.initialized) once().catch(() => {}); else this.syncNow(); },
          err => { if (stopped) return; const c = errCode(err); setStatus(OFFLINE_CODES.includes(c) ? 'offline' : 'error', OFFLINE_CODES.includes(c) ? 'オフラインです。オンラインに戻ると自動で同期します' : '同期できませんでした。記録は端末に残っています。(' + (c || 'unknown') + ')', { code: c }); });
      },
      // 利用者が確認画面で「統合して同期を開始」を選んだ時。先にローカルの記録を退避(失敗したら始めない)
      async consent() {
        if (!meta || !cloud || !cloud.serverReady) throw Error('クラウドの状態を確認できていません');
        const raw = storage.getItem(o.recordsKey || 'onsen-rally-user-v3');
        try { storage.setItem(safeKey, JSON.stringify({ savedAt: o.now ? o.now() : Date.now(), uid: o.uid, raw })); } catch (e) { setStatus('error', '記録の退避に失敗したため同期を始めません(記録は変更していません)'); throw e; }
        await o.adapter.ensureRoot();
        meta.initialized = true; meta.needsReconcile = true; meta.base = { events: {}, notes: {} }; meta.uid = o.uid; meta.projectId = o.projectId; ownerChanged = false; saveMeta();
        return run();
      },
      // 復元(JSON)後や件数減少で止まった時の「クラウドと照合」。削除はせず和集合にする
      reconcileNow() { if (!meta || !meta.initialized) return Promise.resolve(); meta.needsReconcile = true; saveMeta(); return run(); },
      syncNow() { if (!meta || !meta.initialized || stopped) return Promise.resolve(); return run(); },
      notifyLocalChange(kind) {
        if (applying || !meta || stopped) return;
        if (kind === 'replace' || kind === 'migrate') { meta.needsReconcile = true; saveMeta(); }
        if (!meta.initialized) return;
        clearTimeout(timer); timer = setTimeout(() => { this.syncNow(); }, debounceMs);
      },
      async resolveConflict(id, choice) {
        const c = cloud && cloud.conflicts.get(id); if (!c || c.status !== 'open') return;
        const parse = s => { try { return JSON.parse(s); } catch (e) { return null; } };
        const local = parse(c.local), remote = parse(c.remote), curDoc = cloud.visits.get(c.eventId), curNote = cloud.notes.get(c.facilityId);
        if (c.kind === 'visit') {
          let f = choice === 'remote' ? remote : choice === 'local' ? local : { ...local };
          if (choice === 'merge' && local.notes !== remote.notes) f = { ...local, notes: remote.notes + '\n---\n' + local.notes };
          applyLocal([{ type: 'update', eventId: c.eventId, facilityId: c.facilityId, ...f }]);
          if (choice === 'remote') meta.base.events[c.eventId] = { rev: curDoc.revision, ...Core.fieldsOf(remote) };
          else if (!await pushOne({ type: 'update', eventId: c.eventId, facilityId: c.facilityId, baseRevision: curDoc.revision, fields: Core.fieldsOf(f) })) throw Error('他の端末の更新と重なりました。もう一度お試しください');
        } else if (c.kind === 'facilityNote') {
          const text = choice === 'remote' ? remote.notes : choice === 'local' ? local.notes : (remote.notes === local.notes ? local.notes : remote.notes + '\n---\n' + local.notes);
          applyLocal([{ type: 'setNote', facilityId: c.facilityId, notes: text }]);
          if (choice === 'remote') meta.base.notes[c.facilityId] = { rev: curNote.revision, notes: curNote.notes };
          else if (!await pushOne({ type: 'note', facilityId: c.facilityId, baseRevision: curNote ? curNote.revision : 0, notes: text })) throw Error('他の端末の更新と重なりました。もう一度お試しください');
        } else if (c.kind === 'deletedRemotely') {
          if (choice === 'delete') { applyLocal([{ type: 'delete', eventId: c.eventId, facilityId: c.facilityId }]); delete meta.base.events[c.eventId]; }
          else if (!await pushOne({ type: 'restore', eventId: c.eventId, facilityId: c.facilityId, baseRevision: curDoc.revision, fields: Core.fieldsOf(local) })) throw Error('他の端末の更新と重なりました。もう一度お試しください');
        } else if (c.kind === 'editVsDelete') {
          if (choice === 'restore') {
            applyLocal([{ type: 'add', eventId: c.eventId, facilityId: c.facilityId, ...Core.fieldsOf(remote) }]);
            if (!await pushOne({ type: 'restore', eventId: c.eventId, facilityId: c.facilityId, baseRevision: curDoc.revision, fields: Core.fieldsOf(remote) })) throw Error('他の端末の更新と重なりました。もう一度お試しください');
          }
        }
        meta.applied[id] = 1; saveMeta();
        await o.adapter.resolveConflict(id, { resolution: choice });
        return run();
      },
      stop() { stopped = true; clearTimeout(timer); if (unsub) unsub(); unsub = null; cloud = null; }
    };
  }
  root.OnsenSyncEngine = { create, META_KEY, SAFE_KEY };
})(typeof window === 'undefined' ? globalThis : window);
