# SNS巡回機能メモ

## X公式API巡回

- 公式X APIのBearer Tokenだけを使います。
- 非公式スクレイピング、ログイン回避、Cookie使い回し、CAPTCHA回避は行いません。
- Vercelまたは`.env.local`に`X_BEARER_TOKEN`を設定すると実データ取得になります。
- 未設定の場合はモック候補で動きます。
- 取得数は`X_KEYWORD_LIMIT`と`X_RUN_POST_LIMIT`で控えめに制限します。

## TikTok URL取り込み

- TikTokは公式oEmbedで取得できるタイトル、サムネイルURL、作者名だけを確認します。
- 動画ファイルや画像ファイルはコピー保存しません。
- 取得できない場合は手動入力に戻します。

## 安全方針

- Instagram、TikTok、Xの非公式な大量スクレイピングは禁止です。
- 公式API、手動URL登録、RSS、公開許可された情報だけを扱います。
- 元投稿の本文や画像を無断転載せず、短い要約と元URLを保存します。
