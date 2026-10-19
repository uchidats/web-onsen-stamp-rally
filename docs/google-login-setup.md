# Googleログイン(Firebase Authentication)の設定 — Phase 1

Phase 1 は**認証だけ**です。Firestore・Cloud Functions・決済は使わず、訪問記録・メモ・localStorage・JSONバックアップには一切触れません。
`firebase-config.js` の `config` が `null`(未設定)の環境では、ログイン機能は完全に無効で、画面にも出ません(従来どおりの動作)。

## 現在の設定状態

|環境|ホスト名|Firebaseプロジェクト|状態|
|---|---|---|---|
|local|`localhost`|`my-onsen-journey-staging`(試験用)|**有効**(手元での実接続確認用)|
|staging|`my-onsen-journey-staging.web.app`(Firebase Hosting)|`my-onsen-journey-staging`(試験用)|**有効**(設定済み。初回deployは未実施)|
|production|`uchidats.github.io`|(未作成)|**無効**|

- **本番サイト(`https://uchidats.github.io/web-onsen-stamp-rally/`)ではGoogleログインは有効になりません。** `auth.js` に「有効にできる環境」の固定リスト(`local` / `staging`)と「有効にしないホスト」(`uchidats.github.io`)があり、`firebase-config.js` に設定値を足しても本番では有効になりません。本番で有効にするには `auth.js` の変更(コード変更・レビュー)が必要です。
- `my-onsen-journey-staging.firebaseapp.com` など上記以外のホスト名でも無効です(認証を有効にするのは `localhost` と `my-onsen-journey-staging.web.app` だけ)。自動テストのサーバー(`127.0.0.1`)でも無効です(実Firebaseへ接続させないため)。ログインを試す時は **`localhost`** で開いてください。
- Firebase Authentication の Google 認証だけを使います。Firestoreは使わず、ログイン後も記録は**この端末のブラウザにだけ**保存されます(クラウド保存・端末間同期は未対応。画面にもそう表示します)。

## 実接続テストの手順(localhost)

1. リポジトリの直下で簡易サーバーを起動する: `python -m http.server 8080`
2. ブラウザ(Chrome/Edge)で **`http://localhost:8080/index.html`** を開く(`127.0.0.1` ではなく `localhost`)。
3. ヘッダーに「Googleでログイン」と小さな説明の行が出ていることを確認する(出ない場合は `firebase-config.js` の `local` の設定とホスト名を確認)。
4. 試験用のGoogleアカウントでログインする。ポップアップが開くので、アカウントを選んで許可する。
   - ログイン後、「ログイン中: 表示名」と「ログアウト」になる(メール・写真は表示されない)。
   - 「この端末でログインを保持する」を付けなければ、ブラウザを閉じるとログイン状態は消える。
5. 開発者ツールの Application > Local Storage で、`onsen-rally-*` の各キーがログイン前後で変わらないことを確認する。ログアウト後も記録が残ること、JSONバックアップが同じ内容で出力できることも確認する。
6. 確認するエラーケース: ポップアップを閉じる/ブロックする、機内モードで試す(ネットワークエラーの案内)、複数のGoogleアカウント、別タブ、再読み込み、Android Chrome(同じネットワーク内のPCのIPアドレスで開く場合は `localhost` でないため、承認済みドメインへの追加が別途必要)。
7. Firebase Console の Authentication > Users に、試験ログインしたアカウントが1件ずつ作られることを確認する(Firestoreにはデータが作られないこと)。

自動テストでは偽のSDKで検証しています(`tests/auth.test.cjs`、`tests/e2e-auth.test.cjs`)。実際のGoogleアカウントでの認証は、上の手順で人が確認するまで**未検証**です。

## Firebase Hosting の試験サイト(Android実機用)

試験サイトは `https://my-onsen-journey-staging.web.app/` です。GitHub Pagesの本番(`uchidats.github.io`)とはホスト名もオリジンも別なので、localStorage(訪問記録)も共有されません。**初回deployはまだ実施していません**(下の手順は確認後に実行します)。

### 準備済みのもの
- `firebase.json`(公開ディレクトリ `dist-staging`、`noindex` ヘッダー、リライト・Functions・Firestore設定なし)と `.firebaserc`(試験用プロジェクトだけ。本番のエイリアスは作らない)
- `scripts/build-staging.cjs`: 公開してよいファイルだけを `dist-staging/` に集める(ホワイトリスト方式。`.git`・`scratch/`・`GitHub/`・`tests/`・`scripts/`・`docs/`・調査資料・バックアップ・秘密鍵は入らない)
- `npm run staging:files`(公開ファイル一覧の確認。何も作らない)/ `npm run staging:build`(`dist-staging/` を作る。`.gitignore` 済み)
- 公開ファイルは35個(約880KiB): `index.html`、`design.css`、実行に必要なJS(`app.js` `auth.js` `firebase-config.js` `data.js` `records.js` `map.js` `japan-map.js` ほか)、`assets/fonts/*`、`assets/licenses/*`、`assets/coordinate-credits.html`、`vendor/leaflet/*`、`vendor/markercluster/*`。訪問記録はブラウザのlocalStorageにだけあり、ファイルとして公開されることはありません。
- `firebase.json` / `.firebaserc` はGitHub Pages側にも静的ファイルとして置かれますが、秘密は含みません(プロジェクトIDだけ)。

### 認証が有効になるホスト
`localhost`(手元確認)と `my-onsen-journey-staging.web.app`(試験サイト)だけ。`uchidats.github.io`(本番)は `auth.js` の固定ブロックで常に無効です。

### 初回deployの手順(まだ実行しない)
1. `firebase login`(試験用プロジェクトの所有者のGoogleアカウント。Firebase CLIは導入済み・未ログイン)
2. `firebase projects:list` で `my-onsen-journey-staging` が見えることを確認する。
3. Firebase Console の Build > Hosting で「始める」(Sparkのままでよい。既定サイト `my-onsen-journey-staging` が作られる)。
4. Console の Authentication > Settings > Authorized domains に `my-onsen-journey-staging.web.app` があることを確認する(既定で入っているはず。なければ追加)。`localhost` も確認する。
5. `npm run staging:files` で公開ファイル一覧(35個)を目で確認し、`npm run staging:build` で `dist-staging/` を作る。
6. `firebase deploy --only hosting --project my-onsen-journey-staging`
7. `https://my-onsen-journey-staging.web.app/` を開き、ヘッダーに「Googleでログイン」と説明の行が出ることを確認する(本番のGitHub Pagesには出ないこと)。
- 取り下げ: Console の Hosting でロールバック、またはサイトを無効化する(`firebase hosting:disable --project my-onsen-journey-staging`)。

### Android Chrome 実機テスト計画(deploy後)
準備: 試験用のGoogleアカウント(OAuth同意画面のテスト利用者に登録済みのもの)。まずPCで同じURLを開いて同じ操作ができることを確認してから、Androidで行う。

1. Android Chrome で `https://my-onsen-journey-staging.web.app/` を開く。ホーム画面のカード・達成率・地図が表示される。
2. **訪問記録の準備**: 試験サイトのlocalStorageは本番とは別です。いくつか訪問を登録し、達成率(例: `n / 67 施設を訪問済み`)とJSONバックアップを書き留める。
3. 「Googleでログイン」を押す → **Googleのポップアップが開く**(開かない/ブロックされた場合は「ポップアップがブロックされました」の案内が出る)。
4. アカウントを選んでログインできる。ヘッダーが「ログイン中: 表示名」と「ログアウト」になり、**表示名が正しい**(メール・写真は出ない)。
5. ログイン中に、施設詳細(公式サイトリンク)・地図(マーカー、都道府県選択)・フィルター・検索が使える。
6. 達成率・訪問履歴が**ログイン前と同じ**であること(数値、詳細の訪問日、バックアップの内容)。
7. 「ログアウト」で表示が戻り、記録はそのまま残る。再読み込み・別タブでも状態が正しい(保持にチェックしていなければ閉じるとログアウト状態)。
8. 機内モードで「Googleでログイン」を押すと、ネットワークエラーの案内が出て、サイトは使い続けられる。
9. Firebase Console の Authentication > Users に、ログインしたアカウントが反映される(ログイン日時)。
10. Firebase Console の Firestore Database が**未作成/データなし**であること(訪問履歴が送信されていない)。

ポップアップに問題があった場合は、勝手にリダイレクト方式へ切り替えず、原因と代替案を報告します。想定される原因: (a) ポップアップのブロック(ユーザー操作の直後に開く設計のため通常は起きない)、(b) Chromeのストレージ分割による認証結果の受け渡し失敗(`authDomain` が `…firebaseapp.com` で、サイトが `…web.app` と別ドメインのため)。(b) の代替案は、`authDomain` を `my-onsen-journey-staging.web.app` に合わせる(Google OAuthクライアントの承認済みリダイレクトURIに `https://my-onsen-journey-staging.web.app/__/auth/handler` を追加する必要がある)ことです。redirect方式は、その後の検討とします。

## Firebase側で必要な設定(参考。試験用プロジェクトの現状は上の表)

1. **Firebaseプロジェクトの作成(環境ごとに別プロジェクト)**
   - 試験用(staging)と本番(production)を**別プロジェクト**にする。まず試験用だけ作る。
   - プランは Spark(無料)のまま。Cloud Billing は紐づけない。Identity Platform へのアップグレード・Firestore・Functionsは有効にしない。
2. **Authentication > Sign-in method で Google を有効化**
   - 公開用のプロジェクト名とサポートメールを設定する。OAuth同意画面とテスト利用者(試験中)を確認する。
3. **Authentication > Settings > Authorized domains に公開ドメインを追加**
   - `uchidats.github.io`(**パスは入れない**。`/web-onsen-stamp-rally/` は不要)。手元確認なら `localhost` が登録されているか確認する。
   - `authDomain` には Firebase が発行した値(`<project>.firebaseapp.com`)をそのまま使う。サイトのURLやGitHub Pagesのパスを入れない。
   - OAuth クライアントの設定画面に出る「承認済みのJavaScript生成元」は `https://uchidats.github.io`、「承認済みのリダイレクトURI」は `https://<project>.firebaseapp.com/__/auth/handler`(Console表示に合わせる)。
4. **Webアプリの登録と設定値の取得**
   - Firebase Console の「プロジェクトの設定 > マイアプリ > ウェブ」で `apiKey` / `authDomain` / `projectId` / `appId` を取得する。
   - これらは公開してよい**Web設定値**です(秘密ではない)。`firebase-config.js` の該当環境の `config` に入れる。
   - **Admin SDK・サービスアカウント鍵・OAuthクライアントシークレットはリポジトリに入れない。**
5. **設定の反映**
   - `firebase-config.js` の `environments.staging.hosts` に試験用公開URLのホスト名(パスなし)を入れ、`config` を設定する。本番(`production`)は試験完了後に別プロジェクトの設定を入れる。
   - ホスト名が `hosts` に含まれる環境の `config` だけが使われます。どれにも当てはまらない/項目が欠けている/`YOUR_…` のままなら、ログインは無効のままです。

## 認証方式と保持

- 認証方式は Google の**ポップアップ**(`signInWithPopup`)。GitHub Pages 単体では redirect 方式の認証プロキシを作れず、第三者ストレージ制限の影響を受けるため、redirect には自動で切り替えません。PCのChrome/Edgeと Android Chrome で実機確認し、成立しない端末があれば認証構成を再検討します(ブラウザの保護設定を無効にさせない)。
- 要求する権限は Google の標準(プロフィール・メール)のみ。Drive等の追加権限は要求せず、アクセストークンを保存しません。画面に出すのは**表示名だけ**(メール・写真は表示・保持しません)。
- 認証状態の保持: 既定は「このタブだけ」(session)。「この端末でログインを保持する」にチェックした時だけ端末に保持(local)します。共有の端末ではチェックしないでください。チェックの状態は保存しません(毎回オフから)。
- ログアウトしても、ブラウザ内の記録はこれまでどおり残ります(自動では消さない)。**将来のクラウド同期では、共有端末でログアウトした後に他人の記録が見えない/混ざらないための対策(UID別の領域、ログアウト時の保護)が必要**です。これはPhase 2以降の設計課題として `scratch/google-login-cloud-sync-research/` に記録されています。

## 試験手順(設定後)

1. 試験用の公開URL/`localhost` で、`config` を設定したうえで開く。ヘッダーに「Googleでログイン」と小さな行(保持のチェック・保存先の説明)が出る。
2. PC(Chrome/Edge)とAndroid Chromeでログイン→表示名の確認→ログアウトを繰り返す。ポップアップのブロック・閉じる・ネットワーク切断・複数Googleアカウント・別タブ・再読込も確認する。
3. 操作の前後で、ブラウザの保存データ(`onsen-rally-*` の各キー)とJSONバックアップが**変わらない**ことを確認する(自動テストでも検証していますが、実Google認証での確認は未実施です)。
4. 実アカウント試験の記録は架空・使い捨てのデータで行う。

## 公開前に別途必要なこと

- プライバシー・アクセス解析の説明に、Firebase Authentication(Googleログイン)でのデータの扱いを追記する(現在の文言は「Googleログインは今後の開発対象」)。
- 本番(production)プロジェクトの作成と Authorized domains の設定。試験完了までは `production.config` を `null` のままにする。
