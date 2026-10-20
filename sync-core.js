// クラウド同期の純粋なロジック(Firebase・画面・保存領域に依存しない)。訪問記録の同一性・差分・三者比較・競合の検出だけを行う。
// ・訪問は「訪問単位のID(eventId)」で管理する。同じ施設・同じ日付でも別IDなら別の訪問として両方保持する(日付で重複を消さない)。
// ・削除は物理削除でなくtombstone(status:'deleted')。削除済みの訪問は、明示的な「復元」以外では復活しない。
// ・メモなど同じ項目を両端末で変えた場合は、自動で上書きせず両方を競合として保持する。
// ・同期の基準(base)=最後に同期できた値。ローカルの変更はローカル現在値とbaseの差、クラウドの変更はクラウド現在値とbaseの差で判定する。
(function(root){'use strict';
  const SCHEMA = 1, EXTRA_MAX = 20000, NOTES_MAX = 10000, FIELDS = ['date', 'notes', 'extra', 'visitType'];
  const EVENT_ID = /^[A-Za-z0-9_-]{8,100}$/;
  let seq = 0;
  const uuid = () => (root.crypto && root.crypto.randomUUID) ? root.crypto.randomUUID() : 'ev-' + Date.now().toString(36) + '-' + (++seq) + '-' + Math.random().toString(36).slice(2, 10);

  // 訪問記録(v3)のうち、日付・メモ以外の項目(写真・GPS・元の日付)は extra(JSON文字列)としてそのまま運ぶ
  function extraOf(r) {
    const e = {};
    if (Array.isArray(r.photos) && r.photos.length) e.photos = r.photos;
    if (r.gpsStamp) e.gpsStamp = r.gpsStamp;
    if (r.legacyDate !== undefined) e.legacyDate = r.legacyDate;
    return Object.keys(e).length ? JSON.stringify(e) : '';
  }
  const fieldsOf = x => ({ date: x.date === undefined ? null : x.date, notes: x.notes || '', extra: x.extra || '', visitType: x.visitType || '' });
  const eq = (a, b) => FIELDS.every(f => (a[f] ?? (f === 'date' ? null : '')) === (b[f] ?? (f === 'date' ? null : '')));

  // ローカルの状態を、eventIdをキーにした一覧へ。旧移行の連番ID(legacy-…)や不正なIDは端末間で衝突し得るため、一度だけ新しいeventIdを採番してidMapに保存する
  function projectLocal(state, idMap, gen) {
    const map = idMap || {}, events = new Map(), notes = {}, problems = [];
    const make = gen || uuid;
    for (const [fid, v] of Object.entries(state.userData.visits)) {
      if (typeof v.notes === 'string' && v.notes !== '') notes[fid] = v.notes;
      for (const r of v.records) {
        let id = map[r.id];
        if (!id) { id = (!/^legacy-/.test(r.id) && EVENT_ID.test(r.id)) ? r.id : make(); if (id !== r.id) map[r.id] = id; }
        const extra = extraOf(r);
        if (extra.length > EXTRA_MAX) problems.push({ kind: 'oversize', facilityId: fid, localId: r.id });
        if ((r.notes || '').length > NOTES_MAX) problems.push({ kind: 'oversize', facilityId: fid, localId: r.id });
        events.set(id, { eventId: id, localId: r.id, facilityId: fid, sourceVisitId: r.id, date: r.date, notes: r.notes || '', extra, visitType: r.visitType || '' });
      }
    }
    return { events, notes, idMap: map, problems };
  }

  // クラウドからの変更・ローカルの競合解決をローカル状態へ反映する(userData を直接書き換える。呼び出し側がコピーを渡す)
  function applyChanges(userData, changes, idMap) {
    const reverse = {}; for (const [k, v] of Object.entries(idMap)) reverse[v] = k;
    const localIdOf = eventId => reverse[eventId] || eventId;
    const find = (eventId, fid) => { const v = userData.visits[fid]; if (!v) return null; const lid = localIdOf(eventId); return v.records.find(r => r.id === lid) || null; };
    const setExtra = (r, extra) => {
      let e = {}; try { e = extra ? JSON.parse(extra) : {}; } catch (_) { e = {}; }
      r.photos = Array.isArray(e.photos) ? e.photos : []; r.gpsStamp = e.gpsStamp || null;
      if (e.legacyDate !== undefined) r.legacyDate = e.legacyDate; else delete r.legacyDate;
    };
    for (const c of changes) {
      if (c.type === 'setNote') { const v = userData.visits[c.facilityId] || (userData.visits[c.facilityId] = { records: [], notes: '' }); v.notes = c.notes; continue; }
      if (c.type === 'add') {
        const v = userData.visits[c.facilityId] || (userData.visits[c.facilityId] = { records: [], notes: '' });
        const lid = localIdOf(c.eventId);
        if (v.records.some(r => r.id === lid)) continue;
        const r = { id: lid, date: c.date, notes: c.notes, photos: [], gpsStamp: null, ...(c.visitType?{visitType:c.visitType}:{}) }; setExtra(r, c.extra); v.records.push(r); continue;
      }
      const r = find(c.eventId, c.facilityId);
      if (!r) continue;
      if (c.type === 'update') { r.date = c.date; r.notes = c.notes; if(c.visitType)r.visitType=c.visitType;else delete r.visitType; setExtra(r, c.extra); }
      else if (c.type === 'delete') { const v = userData.visits[c.facilityId]; v.records.splice(v.records.indexOf(r), 1); }
    }
    return userData;
  }

  // 比較の本体。local={events,notes}, cloud={visits:Map,notes:Map}, base={events,notes}, frozen=競合で保留中のキー集合
  // 返り値: changes(ローカルへ反映) / pushes(クラウドへ送る) / conflicts(新しい競合) / baseNow(送受信なしで確定するbase)
  function reconcile({ local, cloud, base, frozen }) {
    const fz = frozen || new Set(), B = base || { events: {}, notes: {} };
    const changes = [], pushes = [], conflicts = [], baseNow = { events: {}, notes: {}, dropEvents: [], dropNotes: [] };
    const ids = new Set([...local.events.keys(), ...cloud.visits.keys(), ...Object.keys(B.events)]);
    for (const id of ids) {
      if (fz.has('visit:' + id)) continue;
      const l = local.events.get(id), c = cloud.visits.get(id), b = B.events[id];
      const cActive = c && c.status === 'active', cDel = c && c.status === 'deleted';
      if (!l && !c) { baseNow.dropEvents.push(id); continue; }
      if (l && !c) { pushes.push({ type: 'create', eventId: id, facilityId: l.facilityId, sourceVisitId: l.sourceVisitId, fields: fieldsOf(l) }); continue; }
      if (!l && c) {
        if (cDel) { baseNow.dropEvents.push(id); continue; }                    // クラウドも削除済み
        if (b) {                                                              // この端末で削除した → クラウドへ削除を送る
          const remoteEdited = c.revision !== b.rev && !eq(c, b);
          pushes.push({ type: 'delete', eventId: id, facilityId: c.facilityId, baseRevision: c.revision, remoteEdited, remote: fieldsOf(c), base: fieldsOf(b) });
        } else {                                                              // 他の端末で追加された訪問
          changes.push({ type: 'add', eventId: id, facilityId: c.facilityId, ...fieldsOf(c) });
          baseNow.events[id] = { rev: c.revision, ...fieldsOf(c) };
        }
        continue;
      }
      // l && c
      if (cDel) {
        if (b && eq(l, b)) { changes.push({ type: 'delete', eventId: id, facilityId: l.facilityId }); baseNow.dropEvents.push(id); }   // 他の端末の削除を反映
        else conflicts.push({ kind: 'deletedRemotely', key: 'visit:' + id, eventId: id, facilityId: l.facilityId, field: 'record', base: b ? fieldsOf(b) : null, remote: fieldsOf(c), local: fieldsOf(l), revision: c.revision });
        continue;
      }
      if (!b) {
        if (eq(l, c)) baseNow.events[id] = { rev: c.revision, ...fieldsOf(c) };
        else conflicts.push({ kind: 'visit', key: 'visit:' + id, eventId: id, facilityId: l.facilityId, field: FIELDS.filter(f => (l[f] ?? '') !== (c[f] ?? '')).join(','), base: null, remote: fieldsOf(c), local: fieldsOf(l), revision: c.revision });
        continue;
      }
      const lch = !eq(l, b), rch = c.revision !== b.rev && !eq(c, b);
      if (!lch && !rch) { if (c.revision !== b.rev) baseNow.events[id] = { rev: c.revision, ...fieldsOf(c) }; continue; }
      if (lch && !rch) { pushes.push({ type: 'update', eventId: id, facilityId: l.facilityId, baseRevision: c.revision, fields: fieldsOf(l) }); continue; }
      if (!lch && rch) { changes.push({ type: 'update', eventId: id, facilityId: l.facilityId, ...fieldsOf(c) }); baseNow.events[id] = { rev: c.revision, ...fieldsOf(c) }; continue; }
      const merged = {}, clash = [];
      for (const f of FIELDS) {
        const lf = (l[f] ?? (f === 'date' ? null : '')) !== (b[f] ?? (f === 'date' ? null : '')), rf = (c[f] ?? (f === 'date' ? null : '')) !== (b[f] ?? (f === 'date' ? null : ''));
        if (lf && rf && (l[f] ?? '') !== (c[f] ?? '')) clash.push(f); else merged[f] = rf ? c[f] : l[f];
      }
      if (clash.length) { conflicts.push({ kind: 'visit', key: 'visit:' + id, eventId: id, facilityId: l.facilityId, field: clash.join(','), base: fieldsOf(b), remote: fieldsOf(c), local: fieldsOf(l), revision: c.revision }); continue; }
      const m = fieldsOf(merged);
      if (!eq(m, l)) changes.push({ type: 'update', eventId: id, facilityId: l.facilityId, ...m });
      if (!eq(m, c)) pushes.push({ type: 'update', eventId: id, facilityId: l.facilityId, baseRevision: c.revision, fields: m });
      else baseNow.events[id] = { rev: c.revision, ...m };
    }
    // 施設メモ
    const fids = new Set([...Object.keys(local.notes), ...cloud.notes.keys(), ...Object.keys(B.notes)]);
    for (const fid of fids) {
      if (fz.has('note:' + fid)) continue;
      const lt = local.notes[fid] || '', c = cloud.notes.get(fid), b = B.notes[fid];
      if (!c) { if (lt !== '') pushes.push({ type: 'note', facilityId: fid, baseRevision: 0, notes: lt }); else if (b) baseNow.dropNotes.push(fid); continue; }
      if (!b) {
        if (lt === c.notes) baseNow.notes[fid] = { rev: c.revision, notes: c.notes };
        else if (lt === '') { changes.push({ type: 'setNote', facilityId: fid, notes: c.notes }); baseNow.notes[fid] = { rev: c.revision, notes: c.notes }; }
        else if (c.notes === '') pushes.push({ type: 'note', facilityId: fid, baseRevision: c.revision, notes: lt });
        else conflicts.push({ kind: 'facilityNote', key: 'note:' + fid, facilityId: fid, field: 'notes', base: null, remote: { notes: c.notes }, local: { notes: lt }, revision: c.revision });
        continue;
      }
      const lch = lt !== b.notes, rch = c.revision !== b.rev && c.notes !== b.notes;
      if (!lch && !rch) { if (c.revision !== b.rev) baseNow.notes[fid] = { rev: c.revision, notes: c.notes }; continue; }
      if (lch && !rch) { pushes.push({ type: 'note', facilityId: fid, baseRevision: c.revision, notes: lt }); continue; }
      if (!lch && rch) { changes.push({ type: 'setNote', facilityId: fid, notes: c.notes }); baseNow.notes[fid] = { rev: c.revision, notes: c.notes }; continue; }
      if (lt === c.notes) baseNow.notes[fid] = { rev: c.revision, notes: c.notes };
      else conflicts.push({ kind: 'facilityNote', key: 'note:' + fid, facilityId: fid, field: 'notes', base: { notes: b.notes }, remote: { notes: c.notes }, local: { notes: lt }, revision: c.revision });
    }
    for (const c of conflicts) c.id = c.kind + '-' + c.key.replace(/^[a-z]+:/, '') + '-r' + c.revision;
    return { changes, pushes, conflicts, baseNow };
  }

  const countActive = events => events.size;
  const countCloudActive = visits => { let n = 0; for (const d of visits.values()) if (d.status === 'active') n++; return n; };
  function summarize(state, idMapIn) {
    let n = 0; const p = projectLocal(state, JSON.parse(JSON.stringify(idMapIn || {})), () => 'preview-' + (++n) + '-xxxxxxxx'), perFacilityDate = new Map();
    let nulls = 0, notes = 0;
    for (const e of p.events.values()) { if (e.date === null) nulls++; else { const k = e.facilityId + '|' + e.date; perFacilityDate.set(k, (perFacilityDate.get(k) || 0) + 1); } if (e.notes) notes++; }
    return { visits: p.events.size, facilities: new Set([...p.events.values()].map(e => e.facilityId)).size, unknownDate: nulls, sameDayGroups: [...perFacilityDate.values()].filter(n => n > 1).length, memos: notes + Object.keys(p.notes).length, problems: p.problems };
  }
  // 「不自然な減少」の判定: 反映によって減るローカル件数、またはこの端末から送る削除の件数が、一定割合を超えたら止める
  function unnaturalDecrease({ before, deletesLocal, deletesRemote }) {
    const limit = Math.max(3, Math.ceil(before * 0.3));
    return deletesLocal > limit || deletesRemote > limit;
  }
  root.OnsenSyncCore = { SCHEMA, EXTRA_MAX, NOTES_MAX, FIELDS, EVENT_ID, uuid, extraOf, fieldsOf, eq, projectLocal, applyChanges, reconcile, countActive, countCloudActive, summarize, unnaturalDecrease };
})(typeof window === 'undefined' ? globalThis : window);
