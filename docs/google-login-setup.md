# Googleログイン(Firebase Authentication)の設定

本番(GitHub Pages)・試験サイト(Firebase Hosting)・手元(localhost)は、**すべて同じFirebaseプロジェクト `my-onsen-journey-staging`**(同じAuthentication・同じFirestore・同じSecurity Rules)を使います。クラウド同期の仕組みは [cloud-sync.md](cloud-sync.md) を参照してください。

ログインしなくても、従来どおりすべての機能をブラウザのlocalStorageだけで利用できます。

## 環境と、同じクラウドデータの共有

|環境|ホスト名|Firebaseプロジェクト|状態|
|---|---|---|---|
|production(本番)|`uchidats.github.io`|`my-onsen-journey-staging`|有効|
|staging(試験サイト)|`my-onsen-journey-staging.web.app`(Firebase Hosting)|`my-onsen-journey-staging`|有効|
|local|`localhost`|`my-onsen-journey-staging`|有効(手元での確認用)|

- **本番と試験サイトは同じクラウドデータを共有します。** 同じGoogleアカウントでログインすれば、どちらのサイトでも同じ訪問履歴・メモが同期されます。試験で作った記録は本番にも表示され、その逆も同様です。試験用の架空データを入れる場合は、別のGoogleアカウントを使ってください。
- ただし、ブラウザの**localStorage(ログインしない場合の保存先)はサイトごとに別**です(`uchidats.github.io` と `my-onsen-journey-staging.web.app` では共有されません)。クラウドに同期した記録だけが共通になります。
- ログインを有効にするホスト名は `firebase-config.js` の `hosts` と**完全一致**した時だけです(`127.0.0.1`・`*.firebaseapp.com`・サブドメイン・類似ホスト名は無効)。有効にできる環境名は `auth.js` の固定リスト(`local` / `staging` / `production`)に限られ、`firebase-config.js` に別の環境を足しても有効になりません。
- Web設定値(`apiKey` など)は公開してよい値で、秘密ではありません。Admin SDK・サービスアカウント鍵・OAuthクライアントシークレットはリポジトリに入れません。

## Firebase側の設定(確認済み)

- **Authentication**: Google プロバイダが有効。承認済みドメイン(Authorized domains)に `localhost` / `my-onsen-journey-staging.firebaseapp.com` / `my-onsen-journey-staging.web.app` / `uchidats.github.io` が登録済み(パスは入れない)。
- **Firestore**: データベース `(default)`、Standardエディション、`asia-northeast1`(東京)、本番環境モード、Sparkプラン。
- **Security Rules・インデックス**: `firebase deploy --only firestore --project my-onsen-journey-staging` で適用済み。クラウドのRulesが手元の `firestore.rules` と一致していることの確認方法は cloud-sync.md を参照。
- 本番と試験のどちらからのアクセスも、同じRulesで評価されます(自分のUIDの領域だけ読み書き可)。Rulesはホスト名で区別しません。

## 認証方式と保持

- 認証方式はGoogleの**ポップアップ**(`signInWithPopup`)。redirect方式へは自動で切り替えません。ポップアップが成立しない端末があれば、原因を調べて認証構成を再検討します(ブラウザの保護設定を無効にさせない)。
- 要求する権限はGoogleの標準(プロフィール・メール)のみ。Drive等の追加権限は要求せず、アクセストークンを保存しません。画面に出すのは**表示名だけ**です。
- 認証状態の保持: 既定は「このタブだけ」(session)。「この端末でログインを保持する」にチェックした時だけ端末に保持(local)します。共有の端末ではチェックしないでください。チェックの状態は保存しません。
- ログアウトしても、ブラウザ内の記録は残ります(自動では消しません)。共有端末の注意は cloud-sync.md を参照。

## 手元(localhost)での確認

1. リポジトリの直下で `python -m http.server 8080` を起動し、**`http://localhost:8080/index.html`** を開く(`127.0.0.1` ではなく `localhost`)。
2. 「Googleでログイン」→ アカウントを選んで許可 → 「ログイン中: 表示名」。確認画面で「統合して同期を開始」を選ぶまで、クラウドへは何も送られません。
3. 開発者ツールで `onsen-rally-*` のキーがログイン前後で変わらないこと(同期を開始するまで)を確認する。

## 公開サイトの配信

- 本番: GitHub Pages(`main` への push で更新)。
- 試験サイト: Firebase Hosting。`npm run staging:files`(公開ファイル一覧)→ `npm run staging:build` → `firebase deploy --only hosting --project my-onsen-journey-staging`。公開対象は許可リスト方式で、`.git`・`scratch/`・テスト・開発資料は含まれません。`firebase.json` はHosting(公開ディレクトリ `dist-staging`、`noindex`)、Firestore(Rules・インデックス)、ローカルのエミュレータ設定だけで、Functions・Storage・決済は含みません。

## プライバシー説明とデータの削除

「プライバシー・アクセス解析の設定」画面とフッターに、Googleログインして「同期を開始」した場合だけ、訪問記録とメモがあなたのGoogleアカウントに紐づけてFirebase(東京リージョンのFirestore)に保存されること、およびクラウドデータの**セルフサービス削除の手順**(削除される範囲・端末に残るデータ・再ログイン時の挙動)を明記しています。ログインしなければクラウドへは何も送られません。

クラウドのデータは、ログイン中の「クラウドデータの削除…」から、運営者への連絡なしにいつでも削除できます(クラウドのデータだけ、または Firebaseのログイン用アカウントも含めて)。削除の仕組みと順序、世代IDによる再アップロードの防止は [cloud-sync.md](cloud-sync.md) を参照してください。
