const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function load(extraWindow = {}, hostname = 'stg.example.io') {
  const win = { location: { hostname }, ...extraWindow };
  win.window = win;
  vm.runInNewContext(fs.readFileSync('firebase-config.js', 'utf8'), win);
  vm.runInNewContext(fs.readFileSync('auth.js', 'utf8'), win);
  return win;
}
const GOOD = { apiKey: 'k', authDomain: 'p.firebaseapp.com', projectId: 'p', appId: '1:2:web:3' };

// 偽のFirebase SDK。呼び出しを記録し、挙動を差し替えられる
function fakeSdk(behavior = {}) {
  const log = [];
  let cb = null, user = null;
  const mod = {
    log,
    initializeApp: cfg => { log.push(['initializeApp', cfg.projectId]); return {}; },
    getAuth: () => ({}),
    onAuthStateChanged: (auth, ok) => { cb = ok; Promise.resolve().then(() => ok(user)); },
    setPersistence: async (auth, p) => { log.push(['setPersistence', p]); },
    browserSessionPersistence: 'session',
    browserLocalPersistence: 'local',
    GoogleAuthProvider: class { constructor() { log.push(['provider']); } setCustomParameters(p) { log.push(['params', p]); } addScope(s) { log.push(['addScope', s]); } },
    signInWithPopup: async () => {
      if (behavior.error) { const e = Error('x'); e.code = behavior.error; throw e; }
      user = { displayName: 'テスト 太郎', email: 'secret@example.com', uid: 'uid-1', photoURL: 'https://example.com/p.png' };
      cb(user);
    },
    signOut: async () => { if (behavior.signOutError) throw Error('x'); user = null; cb(null); }
  };
  return mod;
}
const settingsWith = sdk => ({ sdkVersion: '10.14.1', loadSdk: async () => sdk, environments: { staging: { hosts: ['stg.example.io'], config: GOOD } } });

test('auth: repo config enables the staging project on localhost and the staging Hosting site only; production and every other host stay disabled', () => {
  const STAGING = { apiKey: 'AIzaSyDPzEQLDtgeuRt47OKf5HejcenwGMliY_s', authDomain: 'my-onsen-journey-staging.firebaseapp.com', projectId: 'my-onsen-journey-staging', appId: '1:183881233571:web:08b2a48f63f748338b7b16' };
  const cfg = load({}, 'localhost').ONSEN_FIREBASE;
  const plain = x => JSON.parse(JSON.stringify(x));
  assert.equal(cfg.environments.production.config, null);
  assert.deepEqual(plain(cfg.environments.staging.config), STAGING);
  assert.deepEqual(plain(cfg.environments.local.config), STAGING);
  assert.deepEqual(Object.keys(cfg.environments.local.config).sort(), ['apiKey', 'appId', 'authDomain', 'projectId']); // Web設定だけ(秘密鍵などは無い)
  assert.deepEqual(plain(cfg.environments.local.hosts), ['localhost']);
  assert.deepEqual(plain(cfg.environments.staging.hosts), ['my-onsen-journey-staging.web.app']);
  assert.deepEqual(plain(cfg.environments.production.hosts), ['uchidats.github.io']);
  // 有効になるのは localhost と試験サイト(Firebase Hosting)だけ
  const local = load({}, 'localhost').OnsenAuth, stg = load({}, 'my-onsen-journey-staging.web.app').OnsenAuth;
  assert.equal(local.enabled(), true); assert.equal(local.environmentName(), 'local');
  assert.equal(stg.enabled(), true); assert.equal(stg.environmentName(), 'staging');
  // 本番サイト・自動テストのサーバー(127.0.0.1)・firebaseapp.com側・紛らわしいホスト名では無効で、コントローラも作られない
  for (const host of ['uchidats.github.io', '127.0.0.1', 'example.com', 'my-onsen-journey-staging.firebaseapp.com', 'my-onsen-journey-staging.web.app.evil.example', 'evil-my-onsen-journey-staging.web.app', 'uchidats.github.io.evil.example']) {
    const w = load({}, host);
    assert.equal(w.OnsenAuth.enabled(), false, host);
    assert.equal(w.OnsenAuth.controller, undefined, host);
  }
});

test('auth: production can never be enabled by editing the Firebase settings alone', () => {
  const full = { ...GOOD, projectId: 'prod-project' };
  // 本番ホストに本番の完全な設定を渡しても無効(ホストの固定ブロック)
  const prod = load({ ONSEN_FIREBASE: { sdkVersion: '10.14.1', environments: { production: { hosts: ['uchidats.github.io'], config: full } } } }, 'uchidats.github.io');
  assert.equal(prod.OnsenAuth.enabled(), false);
  // 本番ホストを別の名前の環境に入れ替えても無効
  const sneaky = load({ ONSEN_FIREBASE: { sdkVersion: '10.14.1', environments: { local: { hosts: ['uchidats.github.io'], config: full }, staging: { hosts: ['uchidats.github.io'], config: full } } } }, 'uchidats.github.io');
  assert.equal(sneaky.OnsenAuth.enabled(), false);
  // 有効にできる環境は auth.js の固定リスト(production を含まない)
  assert.deepEqual(Array.from(load({}, 'localhost').OnsenAuth.enabledEnvironments()), ['local', 'staging']);
  // 設定ファイルの production は null のまま(本番へ設定値を入れていない)
  assert.equal(load({}, 'localhost').ONSEN_FIREBASE.environments.production.config, null);
});

test('auth: environment resolution is per host; incomplete or placeholder settings stay disabled', () => {
  const A = load().OnsenAuth;
  const s = { environments: { staging: { hosts: ['stg.example.io'], config: { ...GOOD, projectId: 'stg' } }, local: { hosts: ['localhost'], config: null } } };
  assert.equal(A.resolveEnvironment(s, 'stg.example.io').config.projectId, 'stg');
  assert.equal(A.resolveEnvironment(s, 'stg.example.io').name, 'staging');
  assert.equal(A.resolveEnvironment(s, 'localhost'), null); // config未設定
  assert.equal(A.resolveEnvironment(s, 'other.example.com'), null); // どの環境にも当てはまらない
  for (const bad of [null, {}, { ...GOOD, apiKey: '' }, { ...GOOD, appId: 'YOUR_APP_ID' }, { ...GOOD, projectId: undefined }, 'string']) {
    assert.equal(A.validConfig(bad), false, JSON.stringify(bad));
  }
  assert.equal(A.resolveEnvironment(null, 'stg.example.io'), null);
  assert.equal(A.sdkUrls('10.14.1').auth, 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js');
  assert.equal(A.sdkUrls('latest'), null); // 固定バージョンのみ
});

test('auth: error codes become short Japanese messages that never expose raw errors', () => {
  const A = load().OnsenAuth;
  for (const code of ['auth/popup-blocked', 'auth/popup-closed-by-user', 'auth/network-request-failed', 'auth/unauthorized-domain', 'auth/operation-not-allowed', 'auth/something-new']) {
    const m = A.errorInfo({ code, message: 'RAW secret@example.com' }).message;
    assert.ok(m.endsWith('記録は引き続きこの端末で利用できます。'), code);
    assert.ok(!m.includes('RAW') && !m.includes('@'), code);
  }
  assert.match(A.errorInfo({ code: 'auth/popup-blocked' }).message, /ポップアップ/);
  assert.match(A.errorInfo({ code: 'auth/network-request-failed' }).message, /ネットワーク/);
});

function controllerFor(sdk, storage) {
  const settings = settingsWith(sdk);
  const win = load({ ONSEN_FIREBASE: settings, ...(storage ? { localStorage: storage } : {}) });
  return { win, c: win.OnsenAuth.controller };
}
// 記録の保存領域に触れたら失敗する番人(ログイン操作が訪問記録を読み書きしないことの確認)
const guard = () => new Proxy({}, { get() { throw Error('localStorage must not be touched by auth'); }, set() { throw Error('no'); } });
const tick = () => new Promise(r => setTimeout(r, 0));

test('auth: sign-in success shows only the display name; persistence defaults to session; no extra scopes; never touches storage', async () => {
  const sdk = fakeSdk();
  const { c } = controllerFor(sdk, guard());
  c.init(); await tick(); await tick();
  assert.equal(c.getState().status, 'signedOut');
  await c.signIn(false);
  const s = c.getState();
  assert.equal(s.status, 'signedIn');
  assert.deepEqual(JSON.parse(JSON.stringify(s.user)), { name: 'テスト 太郎' }); // メール・UID・写真は持たない
  assert.ok(!JSON.stringify(s).includes('secret@example.com') && !JSON.stringify(s).includes('uid-1'));
  assert.deepEqual(sdk.log.find(e => e[0] === 'setPersistence'), ['setPersistence', 'session']);
  assert.deepEqual(JSON.parse(JSON.stringify(sdk.log.find(e => e[0] === 'params'))), ['params', { prompt: 'select_account' }]);
  assert.equal(sdk.log.some(e => e[0] === 'addScope'), false);
});

test('auth: "keep me signed in" is the only way to use local persistence', async () => {
  const sdk = fakeSdk();
  const { c } = controllerFor(sdk, guard());
  await c.signIn(true);
  assert.deepEqual(sdk.log.find(e => e[0] === 'setPersistence'), ['setPersistence', 'local']);
});

test('auth: failures (popup blocked / closed / network / unknown) leave the user signed out with a message; later retry works', async () => {
  for (const [error, re] of [['auth/popup-blocked', /ポップアップ/], ['auth/popup-closed-by-user', /中止/], ['auth/network-request-failed', /ネットワーク/], ['auth/internal-error', /ログインできませんでした/]]) {
    const sdk = fakeSdk({ error });
    const { c } = controllerFor(sdk, guard());
    await c.signIn(false);
    const s = c.getState();
    assert.equal(s.status, 'signedOut', error);
    assert.equal(s.busy, false);
    assert.match(s.message, re, error);
    assert.ok(s.message.includes('記録は引き続きこの端末で利用できます'));
  }
});

test('auth: SDK that cannot be loaded (offline/blocked) keeps the site usable and reports a network message', async () => {
  const settings = { sdkVersion: '10.14.1', loadSdk: async () => { throw new TypeError('Failed to fetch dynamically imported module'); }, environments: { staging: { hosts: ['stg.example.io'], config: GOOD } } };
  const win = load({ ONSEN_FIREBASE: settings, localStorage: guard() });
  const c = win.OnsenAuth.controller;
  c.init(); await tick(); // 起動時の読み込み失敗は静かに無視される
  assert.equal(c.getState().status, 'signedOut');
  assert.equal(c.getState().message, '');
  await c.signIn(false);
  assert.equal(c.getState().status, 'signedOut');
  assert.match(c.getState().message, /ネットワーク/);
});

test('auth: sign-out clears the account state, reports failures, and never touches storage', async () => {
  const sdk = fakeSdk();
  const { c } = controllerFor(sdk, guard());
  await c.signIn(false); assert.equal(c.getState().status, 'signedIn');
  await c.signOut();
  assert.equal(c.getState().status, 'signedOut');
  assert.equal(c.getState().user, null);
  const bad = fakeSdk({ signOutError: true });
  const r = controllerFor(bad, guard()).c;
  await r.signIn(false); await r.signOut();
  assert.equal(r.getState().status, 'signedIn');
  assert.match(r.getState().message, /ログアウトできませんでした/);
});

test('auth: no secrets or storage APIs in the auth code and config; Firestore and other SDKs are not used', () => {
  const src = fs.readFileSync('auth.js', 'utf8') + fs.readFileSync('firebase-config.js', 'utf8');
  assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(src.replace(/\/\/.*$/gm, '')), 'auth does not read or write app storage directly');
  assert.ok(!/firestore|functions|storage|private_key|client_secret|service.?account/i.test(src.replace(/\/\/.*$/gm, '')));
  assert.ok(!/addScope/.test(src.replace(/\/\/.*$/gm, '')));
});

test('cloud sync: enabled only where the environment sets sync:true (localhost / staging site); never on production, 127.0.0.1 or any other host, even if the settings are edited', () => {
  const fs2 = require('node:fs'), vm2 = require('node:vm');
  const syncSrc = fs2.readFileSync('sync.js', 'utf8');
  const runSync = (win) => { win.document = { getElementById: () => { throw Error('sync must not touch the page here'); }, querySelector: () => { throw Error('sync must not touch the page here'); } }; win.OnsenSyncEngine = {}; win.OnsenHost = {}; vm2.runInNewContext(syncSrc, win); return win; };
  assert.equal(load({}, 'localhost').OnsenAuth.syncEnabled(), true);
  assert.equal(load({}, 'my-onsen-journey-staging.web.app').OnsenAuth.syncEnabled(), true);
  const sneaky = { sdkVersion: '10.14.1', environments: { production: { hosts: ['uchidats.github.io'], sync: true, config: GOOD }, local: { hosts: ['uchidats.github.io'], sync: true, config: GOOD } } };
  for (const [host, extra] of [['uchidats.github.io', {}], ['uchidats.github.io', { ONSEN_FIREBASE: sneaky }], ['127.0.0.1', {}], ['example.com', {}], ['my-onsen-journey-staging.firebaseapp.com', {}]]) {
    const w = load(extra, host);
    assert.equal(w.OnsenAuth.syncEnabled(), false, host);
    const after = runSync(w);   // 例外なく即座に戻り、ページにも触れず、同期は起動しない
    assert.equal(after.OnsenSync, undefined, host);
  }
});
