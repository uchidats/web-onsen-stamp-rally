const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// 偽の認証SDK + 偽のクラウド(メモリ上のFirestore相当)を、ページ読み込み前に差し込む。実際のGoogle認証・Firestoreには接続しない
const FAKE_CLOUD = fs.readFileSync(path.join(__dirname, 'helpers', 'fake-cloud.cjs'), 'utf8');
const INJECT = FAKE_CLOUD + `
window.__cloud = new FakeCloud(); window.__order = []; window.__needRecent = false;
let cb = null, user = null;
const fake = {
  initializeApp: () => ({}), getAuth: () => ({ get currentUser() { return user; } }),
  onAuthStateChanged: (a, ok) => { cb = ok; Promise.resolve().then(() => ok(user)); },
  setPersistence: async () => {}, browserSessionPersistence: 's', browserLocalPersistence: 'l',
  GoogleAuthProvider: class { setCustomParameters() {} },
  signInWithPopup: async () => { user = { displayName: 'テスト 太郎', uid: 'uid-del-1' }; cb(user); },
  signOut: async () => { user = null; cb(null); },
  reauthenticateWithPopup: async () => { __order.push('reauth'); },
  deleteUser: async () => { if (__needRecent) { __needRecent = false; throw Object.assign(new Error('x'), { code: 'auth/requires-recent-login' }); } __order.push('auth-delete'); user = null; cb(null); }
};
window.ONSEN_FIREBASE = { sdkVersion: '10.14.1', loadSdk: async () => fake,
  syncAdapterFactory: () => { const ad = window.__ad = window.__cloud.adapter(); const orig = ad.deleteAll; ad.deleteAll = async (...a) => { const r = await orig.apply(ad, a); __order.push('cloud-delete:' + r.status); return r; }; return ad; },
  environments: { local: { hosts: ['127.0.0.1', 'localhost'], sync: true, config: { apiKey: 'test', authDomain: 'test.firebaseapp.com', projectId: 'test-project', appId: '1:2:web:3' } } } };
`;

test('E2E: self-service cloud data deletion (confirmation gates, cloud data first then account, re-login prompt, failure and retry, local records untouched)', async (t) => {
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
    await send('Page.enable');
    await waitFor("document.querySelectorAll('#cards .card').length>0");
    await evaluate(`(()=>{const R=OnsenRecords.create(localStorage);let s=R.load();s=R.addVisit(s,'onsen-001','2024-02-29');s=R.addVisit(s,'onsen-001','2024-02-29');s=R.addVisit(s,'onsen-006',null);s=R.setNotes(s,'onsen-001','メモ');})()`);
    const records = () => evaluate("localStorage.getItem('onsen-rally-user-v3')");
    const rawBefore = await records();
    await send('Page.addScriptToEvaluateOnNewDocument', { source: INJECT });
    const q = id => `document.getElementById('${id}')`;
    const login = async () => {
      await send('Page.reload');
      await waitFor("document.readyState==='complete' && typeof OnsenSync==='object' && document.getElementById('accountRow').hidden===false");
      assert.equal(await evaluate(`${q('cloudDeleteOpen')}.hidden`), true, 'no delete button before login');
      await evaluate(`${q('loginBtn')}.click()`);
      await waitFor(`${q('syncDialog')}.open`);
      await evaluate(`${q('syncConfirm')}.click()`);
      await waitFor(`${q('syncStatus')}.dataset.state==='synced' && __cloud.visits.size===3`);
    };
    const openDialog = async () => { await evaluate(`${q('cloudDeleteOpen')}.click()`); await waitFor(`${q('cloudDeleteDialog')}.open`); };
    const fill = async (scope) => evaluate(`(()=>{[...document.getElementsByName('cloudDeleteScope')].find(r=>r.value==='${scope}').checked=true;${q('cloudDeleteAck')}.checked=true;${q('cloudDeleteAck')}.dispatchEvent(new Event('change'));${q('cloudDeleteWord')}.value='削除';${q('cloudDeleteWord')}.dispatchEvent(new Event('input'))})()`);

    for (const width of [1280, 390]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 400 });
      await evaluate("localStorage.clear()"); await evaluate(`localStorage.setItem('onsen-rally-user-v3', ${JSON.stringify(JSON.stringify(JSON.parse(rawBefore)))})`);
      await login();
      assert.equal(await evaluate(`${q('cloudDeleteOpen')}.hidden`), false, 'delete button appears after login');

      // ---- A. 確認画面: 対象・影響の説明、バックアップ、二重の確認(チェック+「削除」の入力)がそろうまで実行できない ----
      await openDialog();
      const text = await evaluate(`${q('cloudDeleteDialog')}.textContent`);
      for (const phrase of ['取り消せません', '訪問履歴', '施設メモ', '削除履歴', '競合情報', 'Firebase Authentication', 'Googleアカウント自体は削除されません', 'この端末(このブラウザ)に保存されている訪問記録', '他の端末', 'ダウンロード済みのJSONバックアップ', '自動ではアップロードされません', '「同期を開始」']) assert.ok(text.includes(phrase), phrase);
      assert.equal(await evaluate(`${q('cloudDeleteRun')}.disabled`), true);
      assert.equal(await evaluate(`${q('cloudDeleteBackup')}.textContent`), 'バックアップをダウンロード');
      await evaluate(`${q('cloudDeleteAck')}.click()`);
      assert.equal(await evaluate(`${q('cloudDeleteRun')}.disabled`), true, 'the checkbox alone is not enough');
      await evaluate(`${q('cloudDeleteWord')}.value='けす';${q('cloudDeleteWord')}.dispatchEvent(new Event('input'))`);
      assert.equal(await evaluate(`${q('cloudDeleteRun')}.disabled`), true, 'a wrong confirmation word is rejected');
      await evaluate(`${q('cloudDeleteWord')}.value='削除';${q('cloudDeleteWord')}.dispatchEvent(new Event('input'))`);
      assert.equal(await evaluate(`${q('cloudDeleteRun')}.disabled`), false);
      assert.equal(await evaluate('__cloud.visits.size'), 3, 'nothing is deleted before the final click');
      assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'), false);
      await evaluate(`${q('cloudDeleteClose')}.click()`);

      // ---- B. 通信エラーで途中失敗 → 書き込みは止まったまま、再実行で完了。この端末の記録は変わらない ----
      await openDialog(); await fill('data');
      await evaluate('__cloud.deleteFailAfter = 1');
      await evaluate(`${q('cloudDeleteRun')}.click()`);
      await waitFor(`${q('cloudDeleteProgress')}.textContent.includes('削除を完了できませんでした')`);
      assert.match(await evaluate(`${q('cloudDeleteProgress')}.textContent`), /続きから完了します/);
      assert.equal(await evaluate("__cloud.root && __cloud.root.status"), 'deleting', 'writes stay blocked after a partial failure');
      assert.ok(await evaluate('__cloud.visits.size') < 3);
      assert.deepEqual(JSON.parse(await records()).userData.visits['onsen-001'].records.length, 2);
      await waitFor(`${q('cloudDeleteRun')}.disabled===false`);
      // 中断した削除はログアウト・再ログイン後も自動同期を再開せず、明示的に削除を再開する。
      await evaluate(`${q('cloudDeleteClose')}.click();${q('loginBtn')}.click()`);
      await waitFor(`${q('loginBtn')}.textContent==='Googleでログイン'`);
      await evaluate(`${q('loginBtn')}.click()`);
      await waitFor(`${q('syncStatus')}.dataset.state==='deleting'`);
      assert.equal(await evaluate(`${q('syncDialog')}.open`), false);
      assert.equal(await records(), rawBefore);
      await openDialog(); await fill('data');
      assert.match(await evaluate(`${q('cloudDeleteProgress')}.textContent`), /前回の削除が中断/);
      await evaluate(`${q('cloudDeleteRun')}.click()`);
      await waitFor(`${q('cloudDeleteProgress')}.textContent.includes('クラウドのデータを削除しました')`);
      assert.equal(await evaluate('__cloud.visits.size + __cloud.notes.size + __cloud.conflicts.size'), 0);
      assert.equal(await evaluate('__cloud.root'), null);
      // ローカルの記録・ログイン状態は残り、同期の管理情報だけが消える。確認画面は自動では開かない
      assert.equal(await records(), rawBefore, 'local records are untouched by the deletion');
      { const m = JSON.parse(await evaluate("localStorage.getItem('onsen-rally-sync-v1')") || 'null'); assert.ok(m === null || (m.initialized === false && m.epoch === null && Object.keys(m.idMap).length === 0 && Object.keys(m.base.events).length === 0), 'only an empty, uninitialized sync state remains'); }
      assert.equal(await evaluate(`${q('loginBtn')}.textContent`), 'ログアウト');
      await waitFor(`${q('syncStart')}.hidden===false`);
      assert.equal(await evaluate(`${q('syncDialog')}.open`), false, 'no sync dialog pops up right after deleting');
      assert.equal(await evaluate("__order.filter(x=>x.startsWith('cloud-delete')).length"), 1);
      assert.equal(await evaluate("__order.includes('auth-delete')"), false, 'the login account is kept in data-only mode');
      await evaluate(`${q('cloudDeleteClose')}.click()`);

      // ---- C. 削除後の再ログイン相当: 「同期を開始」を選んだ時だけ、この端末の記録が新しいクラウドデータになる ----
      assert.equal(await evaluate('__cloud.visits.size'), 0);
      await evaluate(`${q('syncStart')}.click()`);
      await waitFor(`${q('syncDialog')}.open`);
      await evaluate(`${q('syncConfirm')}.click()`);
      await waitFor(`${q('syncStatus')}.dataset.state==='synced' && __cloud.visits.size===3`);

      // ---- D. クラウドのデータ + アカウント: データを先に削除し、アカウントはその後。最近のログインが必要なら再ログインを求める ----
      await evaluate('__order.length = 0; __needRecent = true');
      await openDialog(); await fill('account');
      await evaluate(`${q('cloudDeleteRun')}.click()`);
      await waitFor(`!${q('cloudDeleteReauth')}.hidden`);
      assert.match(await evaluate(`${q('cloudDeleteProgress')}.textContent`), /クラウドのデータは削除しました.*もう一度Googleで確認/);
      assert.deepEqual(JSON.parse(await evaluate('JSON.stringify(__order)')), ['cloud-delete:deleted'], 'cloud data is deleted before the account');
      assert.equal(await evaluate('__cloud.visits.size'), 0);
      await evaluate(`${q('cloudDeleteReauth')}.click()`);
      await waitFor("__order.includes('auth-delete')");
      assert.deepEqual(JSON.parse(await evaluate('JSON.stringify(__order)')), ['cloud-delete:deleted', 'reauth', 'auth-delete']);
      await waitFor(`${q('loginBtn')}.textContent==='Googleでログイン'`);                         // アカウント削除後はログアウト状態
      assert.equal(await evaluate(`${q('cloudDeleteOpen')}.hidden`), true);
      assert.equal(await evaluate(`${q('syncStatus')}.hidden`), true);
      assert.equal(await records(), rawBefore, 'local records are untouched after deleting the account');
      assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'), false);
      await evaluate(`${q('cloudDeleteClose')}.click()`);
    }
    ws.close();
  } finally { await browser.close(); server.closeAllConnections(); server.close(); }
});
