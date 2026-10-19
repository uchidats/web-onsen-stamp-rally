const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// 偽の認証SDK + 偽のクラウド(メモリ上のFirestore相当)を、ページ読み込み前に差し込む。実際のGoogle認証・Firestoreには接続しない
const FAKE_CLOUD = fs.readFileSync(path.join(__dirname, 'helpers', 'fake-cloud.cjs'), 'utf8');
const INJECT = FAKE_CLOUD + `
window.__cloud = new FakeCloud();
let cb = null, user = null;
const fake = {
  initializeApp: () => ({}), getAuth: () => ({}),
  onAuthStateChanged: (a, ok) => { cb = ok; Promise.resolve().then(() => ok(user)); },
  setPersistence: async () => {}, browserSessionPersistence: 's', browserLocalPersistence: 'l',
  GoogleAuthProvider: class { setCustomParameters() {} },
  signInWithPopup: async () => { user = { displayName: 'テスト 太郎', uid: 'uid-sync-1' }; cb(user); },
  signOut: async () => { user = null; cb(null); }
};
window.ONSEN_FIREBASE = { sdkVersion: '10.14.1', loadSdk: async () => fake,
  syncAdapterFactory: () => { window.__ad = window.__cloud.adapter(); return window.__ad; },
  environments: { local: { hosts: ['127.0.0.1', 'localhost'], sync: true, config: { apiKey: 'test', authDomain: 'test.firebaseapp.com', projectId: 'test-project', appId: '1:2:web:3' } } } };
`;

test('E2E: cloud sync UI - consent, status, offline, conflict resolution, logout keeps records, never runs where sync is not enabled', async (t) => {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (!fs.existsSync(edgePath)) { t.skip('Edge not installed at standard path'); return; }
  const server = require('node:http').createServer((req, res) => {
    const file = path.resolve('.' + new URL(req.url, 'http://localhost').pathname.replace(/^\/web-onsen-stamp-rally\//, '/'));
    if (!file.startsWith(process.cwd() + path.sep)) { res.writeHead(403).end(); return; }
    const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }[path.extname(file)];
    if (type) res.setHeader('Content-Type', type);
    fs.createReadStream(file).on('error', () => res.writeHead(404).end()).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const htmlUrl = `http://127.0.0.1:${server.address().port}/web-onsen-stamp-rally/index.html`;
  let browser;
  t.after(async () => { await browser?.close(); server.closeAllConnections(); server.close(); });
  browser = await require('./helpers/browser.cjs').startBrowser(edgePath, htmlUrl);
  const { ws, send, evaluate } = browser;
  try {
    const waitFor = async (expr, ms = 8000) => { for (let i = 0; i < ms / 100; i++) { if (await evaluate(expr)) return; await new Promise(r => setTimeout(r, 100)); } assert.fail('Timed out: ' + expr); };
    const delay = ms => new Promise(r => setTimeout(r, ms));
    await send('Page.enable');
    await waitFor("document.querySelectorAll('#cards .card').length>0");

    // ---- A. 同期が有効でない環境(既定)では同期は何も起動しない ----
    assert.equal(await evaluate('typeof OnsenSync'), 'undefined');
    assert.equal(await evaluate("document.getElementById('syncStatus').hidden"), true);

    // ---- B. 同期有効の環境(偽の認証・偽のクラウド) ----
    await evaluate(`(()=>{const R=OnsenRecords.create(localStorage);let s=R.load();s=R.addVisit(s,'onsen-001','2024-02-29');s=R.addVisit(s,'onsen-001','2024-02-29');s=R.addVisit(s,'onsen-006',null);})()`);
    const rawBefore = await evaluate("localStorage.getItem('onsen-rally-user-v3')");
    await send('Page.addScriptToEvaluateOnNewDocument', { source: INJECT });
    for (const width of [1280, 390]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 400 });
      await send('Page.reload');
      await waitFor("document.readyState==='complete' && document.getElementById('accountRow').hidden===false && typeof OnsenSync==='object'");
      // ログイン前は同期の表示なし。ログインしても、確認前は何も送らない
      assert.equal(await evaluate("document.getElementById('syncStatus').hidden"), true);
      await evaluate("document.getElementById('loginBtn').click()");
      await waitFor("document.getElementById('syncDialog').open");
      const summary = await evaluate("document.getElementById('syncSummary').textContent");
      assert.match(await evaluate("document.querySelector('.account-note').textContent"), /同期を開始すると/);
      assert.doesNotMatch(await evaluate("document.querySelector('.account-note').textContent"), /同期はまだありません/);
      assert.match(summary, /テスト 太郎/); assert.match(summary, /訪問 3件/); assert.match(summary, /同じ日に複数 1組/); assert.match(summary, /日付なし 1件/);
      assert.equal(await evaluate('__cloud.visits.size'), 0, 'nothing sent before consent');
      assert.equal(await evaluate("localStorage.getItem('onsen-rally-user-v3')"), rawBefore, 'records untouched by login');
      assert.match(await evaluate("document.getElementById('syncStatus').textContent"), /同期は未開始/);
      // 「今は同期しない」→ 状態は未開始のまま、「同期を開始」ボタンから再度開ける
      await evaluate("document.getElementById('syncCancel').click()");
      assert.equal(await evaluate("document.getElementById('syncDialog').open"), false);
      assert.equal(await evaluate("document.getElementById('syncStart').hidden"), false);
      await evaluate("document.getElementById('syncStart').click()");
      assert.equal(await evaluate("document.getElementById('syncDialog').open"), true);
      // 開始 → 退避コピーを保存してから統合。同日2件も日付なしも全件アップロード
      await evaluate("document.getElementById('syncConfirm').click()");
      await waitFor("document.getElementById('syncStatus').dataset.state==='synced'");
      assert.match(await evaluate("document.getElementById('syncStatus').textContent"), /同期: 同期済み/);
      assert.equal(await evaluate('__cloud.visits.size'), 3);
      assert.equal(JSON.parse(await evaluate("localStorage.getItem('onsen-rally-before-sync-v1')")).raw, rawBefore, 'a pre-sync copy of the records is kept');
      assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'), false);

      // 画面から追加した訪問がクラウドに届く(デバウンス後)
      await evaluate("document.querySelector('[data-detail=\"onsen-009\"]').click()");
      await evaluate("document.getElementById('visitAdd').click();document.getElementById('visitDate').value='2026-05-05';document.getElementById('visitForm').requestSubmit()");
      await waitFor("__cloud.visits.size===4");
      // 別の端末の追加が届く(クラウドへ直接追加 → 画面のローカル記録に反映)
      await evaluate("(()=>{__cloud.visits.set('event-other-0001',{eventId:'event-other-0001',facilityId:'onsen-015',sourceVisitId:'x',date:'2026-06-06',notes:'',extra:'',status:'active',revision:1,lastOpId:'o'});__cloud.emit()})()");
      await waitFor("JSON.parse(localStorage.getItem('onsen-rally-user-v3')).userData.visits['onsen-015']?.records.length===1");
      await evaluate("document.getElementById('modalClose').click()");

      // オフライン: 追加はローカルに残り、状態表示が「オフライン」→ 復帰で同期
      const cloudBefore = await evaluate('__cloud.visits.size');
      await evaluate("__ad.offline=true");
      await evaluate("document.querySelector('[data-detail=\"onsen-009\"]').click();document.getElementById('visitAdd').click();document.getElementById('visitDate').value='2026-05-06';document.getElementById('visitForm').requestSubmit()");
      await waitFor("document.getElementById('syncStatus').dataset.state==='offline'");
      assert.equal(await evaluate('__cloud.visits.size'), cloudBefore, 'offline visit is not in the cloud yet');
      assert.match(await evaluate("localStorage.getItem('onsen-rally-user-v3')"), /2026-05-06/);
      await evaluate("__ad.offline=false;__cloud.emit()");
      await waitFor("document.getElementById('syncStatus').dataset.state==='synced' && [...__cloud.visits.values()].some(v=>v.date==='2026-05-06')");
      await evaluate("document.getElementById('modalClose').click()");

      // メモの競合: 両方の変更を保持し、画面で確認して解決
      await evaluate("document.querySelector('[data-detail=\"onsen-001\"]').click();document.getElementById('memoText').value='最初のメモ';document.getElementById('memoSave').click()");
      await waitFor("__cloud.notes.get('onsen-001')?.notes==='最初のメモ'");
      await evaluate("__ad.offline=true;document.getElementById('memoText').value='この端末の変更';document.getElementById('memoSave').click()");
      await evaluate("(()=>{const n=__cloud.notes.get('onsen-001');n.notes='クラウドの変更';n.revision++;n.lastOpId='other'})()");
      await evaluate("__ad.offline=false;__cloud.emit()");
      await waitFor("document.getElementById('syncStatus').dataset.state==='conflicts'");
      assert.equal(await evaluate("localStorage.getItem('onsen-rally-user-v3').includes('この端末の変更')"), true, 'neither side is overwritten');
      await evaluate("document.getElementById('modalClose').click();document.getElementById('syncConflictsBtn').click()");
      await waitFor("document.getElementById('syncConflictDialog').open");
      const conflictText = await evaluate("document.getElementById('syncConflictList').textContent");
      assert.match(conflictText, /この端末の変更/); assert.match(conflictText, /クラウドの変更/);
      await evaluate("[...document.querySelectorAll('#syncConflictList button')].find(b=>b.textContent==='両方を結合').click()");
      await waitFor("document.getElementById('syncStatus').dataset.state==='synced'");
      await evaluate("document.getElementById('syncConflictClose').click()");
      const merged = await evaluate("JSON.parse(localStorage.getItem('onsen-rally-user-v3')).userData.visits['onsen-001'].notes");
      assert.ok(merged.includes('この端末の変更') && merged.includes('クラウドの変更'));
      assert.ok([...(await evaluate('[...__cloud.notes.values()].map(n=>n.notes)'))].some(n => n.includes('この端末の変更') && n.includes('クラウドの変更')), 'merged note reached the cloud');

      // ログアウト: 同期は止まるが、この端末の記録はそのまま残る
      const before = await evaluate("localStorage.getItem('onsen-rally-user-v3')");
      await evaluate("document.getElementById('loginBtn').click()");
      await waitFor("document.getElementById('loginBtn').textContent==='Googleでログイン'");
      assert.equal(await evaluate("document.getElementById('syncStatus').hidden"), true);
      assert.equal(await evaluate("localStorage.getItem('onsen-rally-user-v3')"), before, 'logout keeps local records');
      assert.ok(JSON.parse(before).userData.visits['onsen-001'].records.length >= 2);

      // 次の幅の確認のため、クラウドとローカルを初期状態に戻す
      await evaluate(`(()=>{localStorage.removeItem('onsen-rally-sync-v1');localStorage.removeItem('onsen-rally-before-sync-v1');localStorage.setItem('onsen-rally-user-v3',${JSON.stringify(JSON.stringify(JSON.parse(rawBefore)))})})()`);
    }
    ws.close();
  } finally { await browser.close(); server.closeAllConnections(); server.close(); }
});
