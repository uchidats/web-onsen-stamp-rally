// Firebase Hosting(試験環境)へ公開するファイルだけを dist-staging/ に集める(ホワイトリスト方式)。
//   node scripts/build-staging.cjs            公開用ディレクトリ dist-staging/ を作り直し、公開ファイルの一覧を表示する
//   node scripts/build-staging.cjs --list     ディレクトリは作らず、公開対象の一覧と検査結果だけを表示する
//   node scripts/build-staging.cjs --out DIR  出力先を変える(テスト用)
// リポジトリ全体(.git・scratch/・GitHub/・tests/・scripts/・docs/・調査資料・バックアップ等)は公開しない。
// 個人の訪問記録はブラウザのlocalStorageにだけあり、ここにも公開ディレクトリにも存在しない(ファイルとして含めない)。
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
// 公開してよいファイル・ディレクトリ(これ以外は含めない)
const FILES = ['index.html', 'design.css', 'about-site.js', 'account-menu.js', 'analytics.js', 'app.js', 'auth.js', 'bath-colors.js', 'data.js', 'feature-baths.js', 'firebase-config.js',
  'hero-copy.js', 'hero-background.js', 'hitou-membership.js', 'japan-map.js', 'kakenagashi.js', 'map.js', 'records.js', 'sync-core.js', 'sync-engine.js', 'sync-firestore.js', 'sync.js', 'assets/coordinate-credits.html', 'assets/hero-onsen-bg.png', 'assets/hero-onsen-bg.webp'];
const DIRS = ['assets/fonts', 'assets/licenses', 'vendor/leaflet', 'vendor/markercluster'];
// 公開物に入ってはいけないもの(名前・拡張子)。ホワイトリストが誤って広がった時の安全網
const FORBIDDEN = [/(^|\/)\./, /(^|\/)(scratch|GitHub|tests|scripts|docs|private|private-data|personal-data|backups?|node_modules)(\/|$)/i,
  /\.(cjs|mjs|md|ps1|zip|bak|backup|log|pem|key|xlsx?)$/i, /(backup|visits|private|migration|service-?account|firebase-adminsdk|credentials|secret)/i, /\.env/i];

function listFiles(rel) {
  const abs = path.join(ROOT, rel), st = fs.statSync(abs);
  if (st.isFile()) return [rel];
  return fs.readdirSync(abs).sort().flatMap(n => listFiles(rel + '/' + n));
}
function collect() {
  const files = [...FILES, ...DIRS.flatMap(listFiles)].map(f => f.split('\\').join('/'));
  return [...new Set(files)].sort();
}
// index.html / design.css が参照するローカルファイルがすべて公開対象に含まれているか
function referenced(files) {
  const set = new Set(files), missing = [];
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const m of html.matchAll(/(?:src|href)="([^"#?]+)[^"]*"/g)) if (!/^(https?:)?\/\//.test(m[1]) && !m[1].startsWith('mailto:')) if (!set.has(m[1])) missing.push(m[1]);
  const css = fs.readFileSync(path.join(ROOT, 'design.css'), 'utf8');
  for (const m of css.matchAll(/@import url\("([^"]+)"\)/g)) if (!set.has(m[1])) missing.push(m[1]);
  for (const c of ['assets/fonts/cards.css', 'assets/fonts/bathnames.css']) {
    const t = fs.readFileSync(path.join(ROOT, c), 'utf8');
    for (const m of t.matchAll(/url\(([^)"']+)\)/g)) if (!m[1].startsWith('data:') && !set.has('assets/fonts/' + m[1])) missing.push('assets/fonts/' + m[1]);
  }
  return missing;
}
function check(files) {
  const problems = [];
  for (const f of files) {
    if (!fs.existsSync(path.join(ROOT, f))) problems.push('存在しない: ' + f);
    if (FORBIDDEN.some(re => re.test(f))) problems.push('公開してはいけない名前: ' + f);
  }
  for (const m of referenced(files)) problems.push('参照されているが公開対象にない: ' + m);
  return problems;
}
function main(argv) {
  const listOnly = argv.includes('--list');
  const outIdx = argv.indexOf('--out'), out = path.resolve(ROOT, outIdx >= 0 ? argv[outIdx + 1] : 'dist-staging');
  const files = collect(), problems = check(files);
  if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; return { files, problems }; }
  if (!listOnly) {
    if (path.relative(ROOT, out).startsWith('..') && !out.startsWith(require('node:os').tmpdir())) throw Error('unsafe output directory: ' + out);
    fs.rmSync(out, { recursive: true, force: true });
    for (const f of files) { fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), path.join(out, f)); }
  }
  console.log(files.join('\n'));
  console.log(`\n${files.length} files, ${(files.reduce((n, f) => n + fs.statSync(path.join(ROOT, f)).size, 0) / 1024).toFixed(0)} KiB${listOnly ? ' (list only; nothing written)' : ' -> ' + path.relative(ROOT, out)}`);
  return { files, problems };
}
if (require.main === module) main(process.argv.slice(2));
module.exports = { collect, check, referenced, FILES, DIRS, FORBIDDEN };
