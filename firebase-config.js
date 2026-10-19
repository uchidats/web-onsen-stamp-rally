// Firebase Authentication(Googleログイン)の設定。Phase 1 は「認証だけ」で、Firestore等は使わない。
//
// ・ここに入れるのは Firebase の「Webアプリ設定」(apiKey など)だけ。これは公開されても問題ない値で、秘密ではない。
//   Admin SDK の秘密鍵・サービスアカウント鍵・OAuthクライアントシークレットは、絶対にこのリポジトリへ入れない。
// ・config を null のままにした環境では、ログイン機能は完全に無効(画面にも出ない。従来どおりの動作)。
// ・本番(production / uchidats.github.io)は、ここに config を入れても有効にならない。auth.js 側に「有効にできる環境」の固定リストがあり、本番を有効にするにはコードの変更とレビューが必要。
// ・staging(試験サイト)は Firebase Hosting の https://my-onsen-journey-staging.web.app/ 。deploy の手順は docs/google-login-setup.md を参照。
// ・環境ごとに hosts(その環境で使うホスト名)と config を分ける。本番(production)と試験(staging)で別の Firebase プロジェクトを使うこと。
//   ページを開いたホスト名が hosts に含まれる環境の config だけが使われ、どれにも当てはまらない/config が不完全ならログインは無効になる。
// ・設定の手順と確認項目は docs/google-login-setup.md を参照。
// ・sdkVersion は Firebase Web SDK(modular)の固定バージョン。更新する時は動作確認してから変更する。
(function () {
// 試験用プロジェクト(my-onsen-journey-staging)のWeb設定。公開してよい値で、秘密ではない。localhost と試験サイト(Firebase Hosting)で共通。
const STAGING_WEB_CONFIG = {
  apiKey: 'AIzaSyDPzEQLDtgeuRt47OKf5HejcenwGMliY_s',
  authDomain: 'my-onsen-journey-staging.firebaseapp.com',
  projectId: 'my-onsen-journey-staging',
  appId: '1:183881233571:web:08b2a48f63f748338b7b16'
};
window.ONSEN_FIREBASE = window.ONSEN_FIREBASE || {
  sdkVersion: '10.14.1',
  environments: {
    production: {
      hosts: ['uchidats.github.io'],
      config: null // 本番用プロジェクトの Web 設定。ここに入れても本番では有効にならない(auth.js の固定リストとブロック)
    },
    staging: {
      // 試験サイト(Firebase Hosting)。GitHub Pagesの本番とは別のホスト名・別のオリジン(localStorageも別)。
      // *.firebaseapp.com 側のホスト名は意図的に含めない(認証はこの .web.app でだけ有効にする)。
      hosts: ['my-onsen-journey-staging.web.app'],
      config: STAGING_WEB_CONFIG
    },
    local: {
      // 手元確認用。Googleログインを試す時は http://localhost:<ポート>/ で開く(localhost は Firebase の既定の承認済みドメイン)。
      // 127.0.0.1 は意図的に含めない(未登録で認証できず、自動テストのサーバーが実Firebaseへ接続しないため)。
      hosts: ['localhost'],
      config: STAGING_WEB_CONFIG
    }
  }
};
})();
