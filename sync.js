// クラウド同期の起動と画面(ログイン中だけ。設定で sync が有効な環境=試験用プロジェクトだけ)。
// ・本番(GitHub Pages)や sync 設定のない環境では、このファイルは何もしない(Firestoreのコードも読み込まない)。
// ・認証(auth.js)とは分離: 認証の内部セッション(uid・世代)だけを受け取り、アカウントが変わった/ログアウトした時点でエンジンを止めて作り直す。
//   遅れて届いた応答は世代を確認して捨てる。ログアウトしてもこの端末の記録は消さない。
// ・初回(この端末・このアカウントで未同期)だけ確認画面を出す。確認前は何も送受信しない。
(function (root) {
  'use strict';
  const Auth = root.OnsenAuth;
  if (!Auth || typeof Auth.syncEnabled !== 'function' || !Auth.syncEnabled() || !Auth.controller || !root.OnsenSyncEngine || !root.document) return;
  const doc = root.document, $ = id => doc.getElementById(id), host = root.OnsenHost;
  if (!host) return;
  const settings = root.ONSEN_FIREBASE || {};
  // 同期が有効な環境では、ヘッダーの説明を実態に合わせる(同期は「開始する」を選んだ時だけ始まる)
  { const note = doc.querySelector('.account-note'); if (note) note.textContent = '試験機能です。同期を開始すると、記録はこのGoogleアカウントのクラウド(試験環境)にも保存され、同じアカウントの他の端末と同期されます。ログアウトしても、この端末の記録は残ります。'; }
  let engine = null, generation = 0, dismissedFor = null, lastStatus = null, fsModule = null;

  // Firestoreアダプタを作る(設定の syncAdapterFactory があればそれを使う=試験用)
  async function adapterFor(session) {
    if (typeof settings.syncAdapterFactory === 'function') return settings.syncAdapterFactory({ uid: session.uid, projectId: session.projectId });
    if (!fsModule) { const urls = Auth.sdkUrls(settings.sdkVersion); if (!urls) throw Error('invalid-sdk-version'); fsModule = await import(urls.firestore); }
    return root.OnsenFirestoreAdapter.create({ sdk: fsModule, db: fsModule.getFirestore(session.app), uid: session.uid });
  }

  function stopEngine() { if (engine) { engine.stop(); engine = null; } }
  async function startFor(session, g) {
    stopEngine(); lastStatus = null; render(null);
    if (!session.uid) return;                       // ログアウト: 同期だけ止める。端末の記録は残る
    let adapter;
    try { adapter = await adapterFor(session); } catch (e) { if (g === generation) render({ state: 'error', detail: '同期を準備できませんでした。記録は端末に残っています', conflicts: 0 }); return; }
    if (g !== generation) return;                   // 待っている間にアカウントが変わった
    engine = root.OnsenSyncEngine.create({
      repo: host.store, getState: host.getState, setState: host.setState, storage: root.localStorage, uid: session.uid, projectId: session.projectId, adapter,
      isOnline: () => root.navigator.onLine !== false, onStatus: st => { if (g === generation) { lastStatus = st; render(st); maybeConsent(st); } }
    });
    await engine.start();
  }

  // ---- 画面 ----
  const LABEL = { synced: '同期済み', syncing: '同期中…', offline: 'オフライン', error: '同期エラー', conflicts: '同期済み(競合あり)', consent: '同期は未開始' };
  function render(st) {
    const bar = $('syncStatus'); if (!bar) return;
    const show = !!st;
    bar.hidden = !show; if (!show) { for (const id of ['syncStart', 'syncConflictsBtn', 'syncReconcile', 'syncRetry']) $(id).hidden = true; return; }
    const offline = root.navigator.onLine === false && st.state !== 'consent';
    const state = offline ? 'offline' : st.state;
    bar.textContent = '同期: ' + (LABEL[state] || '') + (state === 'conflicts' ? ' ' + st.conflicts + '件' : '') + ((state === 'error' || state === 'offline') && st.detail ? ' — ' + st.detail : '');
    bar.dataset.state = state;
    $('syncStart').hidden = st.state !== 'consent';
    $('syncConflictsBtn').hidden = !(st.conflicts > 0);
    $('syncReconcile').hidden = !(st.state === 'error' && st.safety);
    $('syncRetry').hidden = !(st.state === 'error' && !st.safety);
  }
  const li = (parent, text) => { const e = doc.createElement('li'); e.textContent = text; parent.appendChild(e); };
  function openConsent(st) {
    const s = st.summary; if (!s) return;
    const box = $('syncSummary'); box.textContent = '';
    const name = (Auth.controller.getState().user || {}).name || 'Googleアカウント';
    const p = doc.createElement('p'); p.textContent = 'アカウント: ' + name + '(試験環境)'; box.appendChild(p);
    if (s.otherAccount) { const w = doc.createElement('p'); w.className = 'note'; w.textContent = 'この端末の記録は、これまで別のアカウントで同期していました。続けると、この端末の記録がこのアカウントにも保存されます。'; box.appendChild(w); }
    const ul = doc.createElement('ul');
    li(ul, 'この端末: 訪問 ' + s.local.visits + '件(' + s.local.facilities + '施設) / 日付なし ' + s.local.unknownDate + '件 / 同じ日に複数 ' + s.local.sameDayGroups + '組 / メモ ' + s.local.memos + '件');
    li(ul, 'クラウド: 訪問 ' + s.cloud.visits + '件(削除済み ' + s.cloud.deleted + '件)');
    li(ul, '統合の見込み: クラウドへ ' + s.willUpload + '件を追加 / この端末へ ' + s.willDownload + '件を追加 / 競合 ' + s.conflicts + '件');
    box.appendChild(ul);
    const n = doc.createElement('p'); n.className = 'note'; n.textContent = 'この端末の記録は消えません(追加のみ)。同じ日付でも別の訪問として残します。開始前に、この端末内へ退避コピーを保存します。'; box.appendChild(n);
    if (!$('syncDialog').open) $('syncDialog').showModal();
  }
  function maybeConsent(st) { if (st.state === 'consent' && st.summary && dismissedFor !== Auth.controller.getSession().uid && !$('syncDialog').open) openConsent(st); }
  const describe = j => { try { const x = JSON.parse(j); if (!x) return '(なし)'; if (x.notes !== undefined && x.date === undefined) return x.notes === '' ? '(空)' : x.notes; return (x.date ? '日付: ' + x.date : '日付なし') + (x.notes ? ' / メモ: ' + x.notes : ''); } catch (e) { return ''; } };
  const KIND = { visit: '訪問記録', facilityNote: '施設のメモ', deletedRemotely: '他の端末で削除された記録', editVsDelete: '削除された記録(編集内容)' };
  function renderConflicts() {
    const ul = $('syncConflictList'); ul.textContent = '';
    for (const c of engine ? engine.openConflicts() : []) {
      const item = doc.createElement('li'); item.className = 'sync-conflict';
      const h = doc.createElement('strong'); h.textContent = host.facilityName(c.facilityId) + ' — ' + (KIND[c.kind] || c.kind); item.appendChild(h);
      for (const [label, val] of [['この端末', c.local], ['クラウド', c.remote]]) { const p = doc.createElement('p'); p.textContent = label + ': ' + describe(val); item.appendChild(p); }
      const row = doc.createElement('div'); row.className = 'tools';
      const choices = c.kind === 'deletedRemotely' ? [['delete', '削除を受け入れる'], ['restore', '復元する']] : c.kind === 'editVsDelete' ? [['restore', '復元する'], ['discard', '破棄する']] : [['local', 'この端末を採用'], ['remote', 'クラウドを採用'], ['merge', '両方を結合']];
      for (const [choice, text] of choices) { const b = doc.createElement('button'); b.type = 'button'; b.textContent = text; b.onclick = async () => { b.disabled = true; try { await engine.resolveConflict(c.id, choice); } catch (e) { host.toast(e.message || '解決できませんでした'); } setTimeout(renderConflicts, 400); }; row.appendChild(b); }
      item.appendChild(row); ul.appendChild(item);
    }
    if (!ul.children.length) li(ul, '未解決の競合はありません。');
  }

  $('syncStart').onclick = () => { dismissedFor = null; if (lastStatus && lastStatus.summary) openConsent(lastStatus); };
  $('syncCancel').onclick = () => { dismissedFor = Auth.controller.getSession().uid; $('syncDialog').close(); };
  $('syncBackup').onclick = () => { try { host.download(host.backup(), '温泉の旅-同期前の記録.json'); } catch (e) { host.toast(e.message || 'バックアップを作成できませんでした'); } };
  $('syncConfirm').onclick = async () => { try { await engine.consent(); $('syncDialog').close(); } catch (e) { host.toast(e.message || '同期を開始できませんでした(記録は変更していません)'); } };
  $('syncConflictsBtn').onclick = () => { renderConflicts(); $('syncConflictDialog').showModal(); };
  $('syncConflictClose').onclick = () => $('syncConflictDialog').close();
  $('syncReconcile').onclick = () => { if (engine) engine.reconcileNow(); };
  $('syncRetry').onclick = () => { if (engine) engine.syncNow(); };

  // ローカルの記録の変更(通常の編集/JSON復元/旧記録の移行)。エンジン自身の反映では送らない
  root.addEventListener('onsen-records-changed', e => { if (engine && !engine.applying) engine.notifyLocalChange((e.detail || {}).kind); });
  root.addEventListener('online', () => { if (engine) engine.syncNow(); });
  root.addEventListener('offline', () => { if (lastStatus) render(lastStatus); });

  Auth.controller.onSession(s => { if (!s.ready) return; generation++; startFor(s, generation); });
  { const s = Auth.controller.getSession(); if (s.ready) { generation++; startFor(s, generation); } }
  root.OnsenSync = { engine: () => engine, status: () => lastStatus };
})(typeof window === 'undefined' ? globalThis : window);
