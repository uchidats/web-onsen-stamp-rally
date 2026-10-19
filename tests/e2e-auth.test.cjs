const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// 偽のFirebase SDKを、ページ読み込み前に差し込む(実際のGoogle認証・ネットワークは使わない)
const FAKE = `
window.__authLog = [];
window.__mode = 'success';
let cb = null, user = null;
const fake = {
  initializeApp: cfg => { __authLog.push('init:' + cfg.projectId); return {}; },
  getAuth: () => ({}),
  onAuthStateChanged: (auth, ok) => { cb = ok; Promise.resolve().then(() => ok(user)); },
  setPersistence: async (a, p) => { __authLog.push('persist:' + p); },
  browserSessionPersistence: 'session', browserLocalPersistence: 'local',
  GoogleAuthProvider: class { setCustomParameters() {} addScope(s) { __authLog.push('scope:' + s); } },
  signInWithPopup: async () => {
    const codes = { blocked: 'auth/popup-blocked', closed: 'auth/popup-closed-by-user', network: 'auth/network-request-failed', domain: 'auth/unauthorized-domain' };
    if (codes[__mode]) { const e = Error('raw'); e.code = codes[__mode]; throw e; }
    user = { displayName: 'テスト 太郎', email: 'secret@example.com', uid: 'uid-1' }; cb(user);
  },
  signOut: async () => { user = null; cb(null); }
};
window.ONSEN_FIREBASE = { sdkVersion: '10.14.1', loadSdk: async () => fake, environments: { local: { hosts: ['127.0.0.1', 'localhost'], config: { apiKey: 'test', authDomain: 'test.firebaseapp.com', projectId: 'test-project', appId: '1:2:web:3' } } } };
`;

test('E2E: Google login (Phase 1) - disabled without config; sign-in/out and failures never change records, memos or backups', async (t) => {
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
    const waitFor = async expr => { for (let i = 0; i < 100; i++) { if (await evaluate(expr)) return; await new Promise(r => setTimeout(r, 100)); } assert.fail('Timed out: ' + expr); };
    const delay = ms => new Promise(r => setTimeout(r, ms));
    await send('Page.enable');
    await waitFor("document.querySelectorAll('#cards .card').length>0");

    // ---- A. 設定なし(既定): 従来どおり。ログイン機能は無効で、何も読み込まない ----
    assert.equal(await evaluate('OnsenAuth.enabled()'), false);
    assert.equal(await evaluate("document.getElementById('loginBtn').textContent"), '記録はこの端末に保存');
    assert.equal(await evaluate("document.getElementById('accountRow').hidden"), true);
    assert.equal(await evaluate("performance.getEntriesByType('resource').some(e=>/gstatic|firebasejs|firebaseapp|googleapis|identitytoolkit/.test(e.name))"), false, 'no Firebase request without config');
    await evaluate("document.getElementById('loginBtn').click()");
    await waitFor("[...document.querySelectorAll('.toast')].some(n=>n.textContent.includes('次の開発段階'))");

    // ---- B. 記録を作ってから、偽SDKでログイン操作 ----
    await evaluate(`(()=>{const R=OnsenRecords.create(localStorage);let s=R.load();s=R.addVisit(s,'onsen-001','2024-02-29');s=R.addVisit(s,'onsen-001','2024-02-29');s=R.addVisit(s,'onsen-006',null);s=R.setVisited(s,'onsen-009',true);})()`);
    const snapshot = () => evaluate("JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))");
    const backup = () => evaluate("(()=>{const R=OnsenRecords.create(localStorage);const b=JSON.parse(JSON.stringify(R.backup(R.load())));delete b.exportedAt;if(b.meta)delete b.meta.exportedAt;return JSON.stringify(b)})()");
    const dataHash = () => evaluate("JSON.stringify(ONSEN_DATA.map(x=>[x.id,x.latitude,x.longitude]))");
    const before = { storage: await snapshot(), backup: await backup(), data: await dataHash() };
    assert.ok(JSON.parse(before.storage).length >= 1);
    assert.equal(await evaluate('ONSEN_DATA.length'), 67);

    await send('Page.addScriptToEvaluateOnNewDocument', { source: FAKE });
    for (const width of [1280, 390, 320]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 400 });
      await send('Page.reload');
      await waitFor("document.readyState==='complete' && document.querySelectorAll('#cards .card').length>0 && document.getElementById('accountRow').hidden===false");
      assert.equal(await evaluate('OnsenAuth.enabled() && OnsenAuth.environmentName()'), 'local');
      assert.equal(await evaluate("document.getElementById('loginBtn').textContent"), 'Googleでログイン');
      assert.equal(await evaluate("document.getElementById('accountRememberBox').checked"), false, 'persistence opt-in starts off');
      assert.match(await evaluate("document.querySelector('.account-note').textContent"), /クラウド保存・端末間の同期はまだありません/, 'login must not imply cloud saving');
      assert.equal(await evaluate("document.getElementById('accountRemember').hidden"), false);
      // レイアウト: 横あふれなし、ボタンはタップしやすい高さ、行は画面内
      const layout = JSON.parse(await evaluate(`(()=>{const b=document.getElementById('loginBtn').getBoundingClientRect(),r=document.getElementById('accountRow').getBoundingClientRect();return JSON.stringify({h:b.height,overflow:document.documentElement.scrollWidth>innerWidth,rowInside:r.left>=0&&r.right<=innerWidth})})()`));
      assert.ok(layout.h >= 44 && !layout.overflow && layout.rowInside, JSON.stringify({ width, ...layout }));
      // 記録は読み込み・再読込でも変わらない(ログインしていなくても)
      assert.equal(await snapshot(), before.storage, `records unchanged after reload @${width}`);

      // 失敗: ポップアップのブロック/閉じる/ネットワーク/未許可ドメイン → 未ログインのまま、短い案内、記録は不変
      for (const [mode, re] of [['blocked', /ポップアップ/], ['closed', /中止/], ['network', /ネットワーク/], ['domain', /このURLではログインを利用できません/]]) {
        await evaluate(`window.__mode='${mode}';document.getElementById('loginBtn').click()`);
        await waitFor(`!document.getElementById('accountMsg').hidden && document.getElementById('loginBtn').disabled===false`);
        const msg = await evaluate("document.getElementById('accountMsg').textContent");
        assert.match(msg, re, mode);
        assert.ok(!msg.includes('raw') && !msg.includes('@'));
        assert.equal(await evaluate("document.getElementById('loginBtn').textContent"), 'Googleでログイン');
        assert.equal(await evaluate("document.getElementById('accountName').hidden"), true);
        assert.equal(await snapshot(), before.storage, `records unchanged after ${mode} @${width}`);
        // 既存機能は使える(施設カードの詳細を開ける)
        await evaluate("document.querySelector('[data-detail=\"onsen-001\"]').click()");
        assert.equal(await evaluate("document.getElementById('modalBg').style.display==='flex'"), true);
        await evaluate("document.getElementById('modalClose').click()");
      }

      // 成功: 表示名だけを小さく表示(メール・UIDは出さない)。保持は既定でセッション
      await evaluate("window.__mode='success';window.__authLog.length=0;document.getElementById('loginBtn').click()");
      await waitFor("document.getElementById('loginBtn').textContent==='ログアウト'");
      assert.equal(await evaluate("document.getElementById('accountName').textContent"), 'ログイン中: テスト 太郎');
      assert.equal(await evaluate("document.getElementById('accountRemember').hidden"), true);
      assert.equal(await evaluate("document.body.innerText.includes('secret@example.com')||document.body.innerHTML.includes('uid-1')"), false);
      assert.deepEqual(JSON.parse(await evaluate('JSON.stringify(__authLog.filter(x=>x.startsWith("persist")||x.startsWith("scope")))')), ['persist:session']);
      assert.equal(await snapshot(), before.storage, `records unchanged after sign-in @${width}`);
      assert.equal(await backup(), before.backup, `backup unchanged after sign-in @${width}`);
      assert.equal(await dataHash(), before.data);
      assert.equal(await evaluate("document.documentElement.scrollWidth>innerWidth"), false);
      // ログイン中も既存機能(フィルター・詳細)が動く
      await evaluate("document.querySelector('[data-detail=\"onsen-006\"]').click()");
      assert.equal(await evaluate("document.getElementById('modalBg').style.display==='flex'"), true);
      await evaluate("document.getElementById('modalClose').click()");

      // ログアウト: 表示が戻り、記録はそのまま(消えない)
      await evaluate("document.getElementById('loginBtn').click()");
      await waitFor("document.getElementById('loginBtn').textContent==='Googleでログイン'");
      assert.equal(await evaluate("document.getElementById('accountName').hidden"), true);
      assert.equal(await snapshot(), before.storage, `records unchanged after sign-out @${width}`);
      assert.equal(await backup(), before.backup);

      // 「この端末でログインを保持する」を選んだ時だけ local 永続化
      await evaluate("document.getElementById('accountRememberBox').click();window.__authLog.length=0;document.getElementById('loginBtn').click()");
      await waitFor("document.getElementById('loginBtn').textContent==='ログアウト'");
      assert.deepEqual(JSON.parse(await evaluate('JSON.stringify(__authLog.filter(x=>x.startsWith("persist")))')), ['persist:local']);
      assert.equal(await snapshot(), before.storage);
      await evaluate("document.getElementById('loginBtn').click()");
      await waitFor("document.getElementById('loginBtn').textContent==='Googleでログイン'");
    }
    ws.close();
  } finally { await browser.close(); server.closeAllConnections(); server.close(); }
});
