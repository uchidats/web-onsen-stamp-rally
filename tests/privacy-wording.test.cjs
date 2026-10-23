const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const dialog = html.match(/<dialog id="privacyDialog"[\s\S]*?<\/dialog>/)[0];
const footer = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/)[1];
const about = html.match(/<dialog id="aboutDialog"[\s\S]*?<\/dialog>/)[0];

test('privacy text says that Google login + sync stores visit history and memos in the cloud, tied to the account, and that login is optional', () => {
  const cloud = dialog.match(/<section[^>]*id="cloudPrivacy"[^>]*>([\s\S]*?)<\/section>/)[1];
  for (const phrase of ['Googleログインとクラウド同期', '訪問記録', 'メモ', 'Firebase', 'Firestore', '東京リージョン', 'Googleアカウントに紐づけて', '「同期を開始」',
    '他の利用者には公開されません']) assert.ok(cloud.includes(phrase), phrase);
  const local = dialog.match(/<section[^>]*id="localPrivacy"[^>]*>([\s\S]*?)<\/section>/)[1];
  for (const phrase of ['ログインしなくても', '全機能', 'ログアウトしても、この端末の記録は消えません']) assert.ok(local.includes(phrase), phrase);
  // 4項目に整理されている
  assert.deepEqual([...dialog.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map(m => m[1].replace(/^\d\. /, '')), ['この端末への保存', 'Googleログインとクラウド同期', 'クラウドデータの削除', 'アクセス解析(Google Analytics 4)']);
  // 削除は運営者への連絡ではなく、セルフサービスの手順として正確に説明する
  const del = dialog.match(/<section[^>]*id="cloudDeletePrivacy"[^>]*>([\s\S]*?)<\/section>/)[1];
  for (const phrase of ['クラウドデータの削除…', '運営者への連絡なしに', '訪問履歴', '施設メモ', '削除履歴', '競合情報', '同期の管理データ', 'ログイン用アカウント', 'Googleアカウント自体は削除されません',
    'この端末(ブラウザ)の記録', '他の端末に残っている記録', 'ダウンロード済みのバックアップ', '削除されません', '自動ではアップロードされず', '「同期を開始」', '取り消せない', 'バックアップを保存']) assert.ok(del.includes(phrase), phrase);
  assert.ok(!html.includes('運営者へご連絡') && !html.includes('削除画面は未実装'));
  // 従来の説明(ローカル保存・Google Analyticsへ送らない)は維持
  assert.ok(dialog.includes('ログインしない場合はこのブラウザ内にだけ保存されます'));
  assert.ok(dialog.includes('Google Analyticsへ送信しません'));
  assert.ok(dialog.includes('180日間'));
});

test('compact footer opens site information; original explanations and privacy entry remain available', () => {
  assert.ok(!footer.includes('Googleログインは今後の開発対象'));
  assert.ok(footer.includes('このサイトについて'));
  assert.ok(footer.includes('© 2026'));
  assert.ok(!footer.includes('<br>'));
  assert.ok(about.includes('ログインしない場合はこのブラウザ内にだけ保存されます'));
  assert.ok(about.includes('クラウドにも保存されます'));
  assert.ok(about.includes('プライバシー・アクセス解析の設定'));
});

test('public UI strings do not call the cloud sync a staging/test-only feature any more', () => {
  const ui = html + fs.readFileSync('sync.js', 'utf8');
  assert.ok(!ui.includes('試験環境'));
  assert.ok(!/<[^>]*id="syncDialog"[\s\S]*?試験/.test(html));
});
