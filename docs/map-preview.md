# 背景地図の表示と調査

背景は `https://tile.openstreetmap.org/{z}/{x}/{y}.png` のOpenStreetMap標準地図です。道路・地名・地形の表示を含みます。提供元は `map.js` の `config` にまとめてあり、将来の地形図はURL・帰属表示・利用条件をセットで追加してください。

## VS Codeでのプレビュー

Live Serverをインストール済みの場合、`index.html`を右クリックして **Open with Live Server** を選びます。アドレスが `http://127.0.0.1:5500/` または `http://localhost:5500/` で始まることを確認してください。ファイルのダブルクリックは `file://` になります。

Pythonが利用できる場合は、リポジトリのディレクトリで `python -m http.server 5500 --bind 127.0.0.1` を実行し、`http://127.0.0.1:5500/` を開く方法もあります。

GitHub Pagesでは同じ実装がHTTPSで動きます。HTMLだけでなく、CSS、JavaScript、`vendor/`、`assets/`を配置してください。タイルURLは絶対HTTPS URL、同梱ライブラリは相対パスなので、プロジェクト配下のURLにも対応します。

## 灰色になる原因

`file://`ではタイルを意図的に無効化しています。OSMのWeb利用には有効なHTTP Refererが必要です。HTTPで開き直してください。URLの変更でlocalStorageの保存先も変わるため、既存の訪問記録は元のURLでバックアップし、新しいURLで復元できます。

HTTP/HTTPSで灰色になる場合は、ブラウザの開発者ツールでConsoleとNetworkを確認してください。Networkの `tile.openstreetmap.org` のPNGが200またはキャッシュから正常に読み込まれるか確認します。403/429、通信ブロック、オフラインなどは背景タイル取得の問題です。ライブラリの404やJavaScript例外は別の初期化問題です。

タイル失敗時は案内と「背景地図を再読み込み」を表示します。通信が復旧してから押すと、施設マーカー・選択県・訪問履歴を維持したままタイル層だけを再作成します。12秒以上完了しない場合も案内します。自動連続再試行やキャッシュ回避は行いません。

県の表示とコンテナ寸法を確定し、`invalidateSize()` と余白付き `fitBounds()` を実行した後にタイルを追加します。サイズ変更時にも再調整します。

帰属表示と `strict-origin-when-cross-origin` の参照元ポリシーを維持してください。[OpenStreetMapタイル利用条件](https://operations.osmfoundation.org/policies/tiles/)に従い、オフライン一括取得や先読み機能は実装しません。
