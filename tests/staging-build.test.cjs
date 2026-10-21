const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { collect, check, FORBIDDEN } = require('../scripts/build-staging.cjs');

const read = f => fs.readFileSync(f, 'utf8');

test('staging hosting: firebase.json publishes only dist-staging, adds noindex, no rewrites/redirects/functions, and .firebaserc points only to the staging project', () => {
  const fb = JSON.parse(read('firebase.json'));
  // Hosting + Firestore(Rules/インデックス) + ローカルのエミュレータ設定だけ。Functions・Storage・Realtime Database・課金系の設定は含まない
  assert.deepEqual(Object.keys(fb).sort(), ['emulators', 'firestore', 'hosting']);
  assert.deepEqual(fb.firestore, { rules: 'firestore.rules', indexes: 'firestore.indexes.json' });
  assert.deepEqual(Object.keys(fb.emulators).sort(), ['firestore', 'singleProjectMode', 'ui']);
  assert.equal(fb.hosting.public, 'dist-staging');
  assert.ok(!('rewrites' in fb.hosting) && !('redirects' in fb.hosting));
  assert.ok(fb.hosting.ignore.includes('**/.*') && fb.hosting.ignore.includes('**/node_modules/**'));
  const all = fb.hosting.headers.find(h => h.source === '**').headers.map(h => h.key + ':' + h.value);
  assert.ok(all.includes('X-Robots-Tag:noindex, nofollow'), 'the test site is not indexed');
  assert.ok(all.includes('X-Content-Type-Options:nosniff'));
  // ポップアップ認証を妨げるCOOP/COEPは付けない
  assert.ok(!JSON.stringify(fb).includes('Cross-Origin-Opener-Policy') && !JSON.stringify(fb).includes('Cross-Origin-Embedder-Policy'));
  const rc = JSON.parse(read('.firebaserc'));
  assert.deepEqual(rc.projects, { default: 'my-onsen-journey-staging', staging: 'my-onsen-journey-staging' }); // 本番のエイリアスは作らない
  assert.match(read('.gitignore'), /^dist-staging\/$/m);
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['staging:files'], 'node scripts/build-staging.cjs --list');
  assert.equal(pkg.scripts['staging:build'], 'node scripts/build-staging.cjs');
  assert.ok(!Object.keys(pkg.scripts).some(k => /deploy/.test(k)), 'no script deploys automatically');
});

test('staging hosting: the published file list is a small allowlist with no repo, research, test, doc, backup or secret files', () => {
  const files = collect();
  assert.deepEqual(check(files), []);
  // 固定件数ではなく上限で「小さな許可リスト」を保つ(個別の必須ファイル・禁止パターンは下で検査)。
  assert.ok(files.length >= 45 && files.length <= 50, 'allowlist size ' + files.length);
  assert.ok(files.includes('stay-search.js'));
  for (const file of ['hero-background.js', 'assets/hero-onsen-bg.png', 'assets/hero-onsen-bg.webp']) assert.ok(files.includes(file));
  assert.ok(files.includes('account-menu.js'));
  for (const f of ['sync-core.js', 'sync-engine.js', 'sync-firestore.js', 'sync.js']) assert.ok(files.includes(f), f);
  // 公開物にRules・エミュレータ・テストは含めない(Rulesはfirebase deploy --only firestore で別に適用する)
  assert.ok(!files.some(f => /firestore\.rules|firestore\.indexes|firebase\.json/.test(f)));
  for (const f of ['index.html', 'design.css', 'about-site.js', 'app.js', 'auth.js', 'firebase-config.js', 'data.js', 'records.js', 'map.js', 'japan-map.js', 'vendor/leaflet/leaflet.js']) assert.ok(files.includes(f), f);
  for (const f of files) {
    for (const re of FORBIDDEN) assert.ok(!re.test(f), f + ' matched ' + re);
    assert.ok(!/^(\.git|scratch|GitHub|tests|scripts|docs|node_modules)(\/|$)/.test(f), f);
  }
  // 公開される .json はフォントのmanifestだけ(訪問記録・バックアップ・調査資料は含まれない)
  assert.deepEqual(files.filter(f => f.endsWith('.json')), ['assets/fonts/bathnames-manifest.json', 'assets/fonts/manifest.json']);
  assert.ok(!files.some(f => f.startsWith('assets/coordinates.json')));
});

test('staging hosting: the built directory matches the list byte for byte and contains no private keys or credentials', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'onsen-staging-'));
  try {
    const r = spawnSync(process.execPath, ['scripts/build-staging.cjs', '--out', out], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const built = [];
    (function walk(d) { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); fs.statSync(p).isDirectory() ? walk(p) : built.push(path.relative(out, p).split(path.sep).join('/')); } })(out);
    assert.deepEqual(built.sort(), collect());
    for (const f of built) {
      assert.ok(fs.readFileSync(path.join(out, f)).equals(fs.readFileSync(f)), f + ' is an exact copy');
      if (/\.(js|html|css|json)$/.test(f)) assert.ok(!/BEGIN (RSA |EC )?PRIVATE KEY|"private_key"|client_secret|firebase-adminsdk/i.test(read(path.join(out, f))), f);
    }
    // 認証設定は Web設定だけ(公開してよい値)。本番・試験・localhost が同じプロジェクトの設定を共有する
    const builtConfig = read(path.join(out, 'firebase-config.js'));
    assert.equal((builtConfig.match(/config: FIREBASE_WEB_CONFIG/g) || []).length, 3);
    assert.ok(!/config: null/.test(builtConfig));
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

test('cloud sync: Firestore is used only by the sync adapter on the three configured hosts sharing one project, and nothing else from Firebase (Functions/Storage/Analytics) is used', () => {
  const strip = f => read(f).replace(/\/\/.*$/gm, '');
  const all = ['auth.js', 'firebase-config.js', 'app.js', 'records.js', 'sync.js', 'sync-core.js', 'sync-engine.js', 'sync-firestore.js'].map(strip).join('\n');
  assert.ok(!/firebase-functions|firebase-storage|firebase-database|firebase-analytics|firebase-messaging|firebase-app-check|firebase-performance|firebase-remote-config/.test(all));
  assert.ok(!/cloudfunctions\.net|firebasestorage|firebaseio\.com|stripe|payment/i.test(all));
  // これらのファイルは Firebase に触れない(認証・同期の橋渡しは auth.js / sync.js / sync-firestore.js だけ)
  for (const f of ['app.js', 'records.js', 'sync-core.js', 'sync-engine.js', 'hitou-membership.js', 'data.js']) assert.ok(!/firebase/i.test(strip(f)), f + ' does not touch Firebase');
  // Firestore SDK の読み込み(import)は sync.js だけ
  assert.match(strip('sync.js'), /import\(urls\.firestore\)/);
  assert.ok(!/import\(/.test(strip('sync-firestore.js')) && !/import\(/.test(strip('sync-engine.js')));
  // 認証コードは訪問記録の保存領域・記録APIを使わない
  assert.ok(!/OnsenRecords|onsen-rally-/.test(read('auth.js') + read('firebase-config.js')));
  // 本番(uchidats.github.io)・試験サイト・localhost は同じFirebaseプロジェクトの設定を共有し、クラウド同期は sync:true の環境だけ
  const sb = { window: {} }; require('node:vm').runInNewContext(read('firebase-config.js'), sb);
  const envs = JSON.parse(JSON.stringify(sb.window.ONSEN_FIREBASE.environments));
  assert.deepEqual(Object.keys(envs).sort(), ['local', 'production', 'staging']);
  for (const e of Object.values(envs)) { assert.equal(e.sync, true); assert.equal(e.config.projectId, 'my-onsen-journey-staging'); }
  assert.deepEqual(envs.production.config, envs.staging.config); assert.deepEqual(envs.production.config, envs.local.config);
  assert.deepEqual(envs.production.hosts, ['uchidats.github.io']);
  assert.match(strip('sync.js'), /!Auth\.syncEnabled\(\)[^;]*\) return;/);
  assert.match(strip('auth.js'), /ENABLED_ENVIRONMENTS=\['local','staging','production'\]/);
});

test('staging hosting: the built site loads from its own directory (every published file is served, cards and 67 map markers render, auth stays off on 127.0.0.1)', async (t) => {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (!fs.existsSync(edgePath)) { t.skip('Edge not installed at standard path'); return; }
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'onsen-staging-'));
  assert.equal(spawnSync(process.execPath, ['scripts/build-staging.cjs', '--out', out], { encoding: 'utf8' }).status, 0);
  const server = require('node:http').createServer((req, res) => {
    const file = path.resolve(out + new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'));
    if (!file.startsWith(out + path.sep)) { res.writeHead(403).end(); return; }
    const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain' }[path.extname(file)];
    if (type) res.setHeader('Content-Type', type);
    fs.createReadStream(file).on('error', () => res.writeHead(404).end()).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  let browser;
  t.after(async () => { await browser?.close(); server.closeAllConnections(); server.close(); fs.rmSync(out, { recursive: true, force: true }); });
  browser = await require('./helpers/browser.cjs').startBrowser(edgePath, url);
  const { ws, send, evaluate } = browser;
  await send('Page.enable');
  const waitFor = async expr => { for (let i = 0; i < 100; i++) { if (await evaluate(expr)) return; await new Promise(r => setTimeout(r, 100)); } assert.fail('Timed out: ' + expr); };
  await waitFor("document.querySelectorAll('#cards .card').length>0 && document.querySelectorAll('.japan-map-marker').length===67");
  assert.equal(await evaluate('OnsenAuth.enabled()'), false);
  assert.equal(await evaluate("document.getElementById('loginBtn').textContent"), '記録はこの端末に保存');
  const bad = JSON.parse(await evaluate(`(async()=>{const r=[];for(const f of ${JSON.stringify(collect())}){const x=await fetch(f);if(!x.ok)r.push(f+' '+x.status)}return JSON.stringify(r)})()`));
  assert.deepEqual(bad, []);
  // 公開されないはずのファイルは存在しない(404)
  const hidden = JSON.parse(await evaluate(`(async()=>{const r=[];for(const f of ['scratch/','tests/auth.test.cjs','scripts/build-staging.cjs','docs/google-login-setup.md','README.md','.git/config','firebase.json','package.json']){const x=await fetch(f);if(x.ok&&x.headers.get('content-type')&&!/text\\/html/.test(x.headers.get('content-type')))r.push(f)}return JSON.stringify(r)})()`));
  assert.deepEqual(hidden, []);
  ws.close();
});
