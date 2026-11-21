【実装依頼・返答は日本語で】

1. 目的
Search Console の URL 検査 API で、ブログ記事が Google に登録されたか（インデックス登録の状態）を、手元のコマンド1つで確かめられるようにする。これまでは Chrome で Search Console の画面を見ていたが、部署スレッドの Codex は Chrome を使えないため、公式 API に切り替える。読み取りだけで、登録リクエストなどの操作はしない。

2. 対象
- 新規: `tools/search-console/inspect-urls.mjs`
- 新規: `tests/search-console-inspect.test.mjs`
- 変更: `package.json` の scripts に `"sc:inspect": "node tools/search-console/inspect-urls.mjs"` を1行足す
- 変更: `docs/blog-workflow.md` の「8. 数日後の確認」に、使い方を2〜3行足す

3. 変更してよい範囲
上の4ファイルだけ。

作り
- `.env.local` を `tools/blog-brief/export-blog-brief.mjs` と同じやり方で読む（`process.cwd()` の `.env.local`）。
- 使う値: `GOOGLE_SERVICE_ACCOUNT_EMAIL`、`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`（または `GOOGLE_SERVICE_ACCOUNT_JSON`）、`SEARCH_CONSOLE_SITE_URL`。読み方と秘密鍵の整え方は `src/lib/google/serviceAccount.server.ts` と同じにする（依存関係は増やさず、`node:crypto` で JWT を作る）。
- スコープは `https://www.googleapis.com/auth/webmasters.readonly` だけ。
- API: `POST https://searchconsole.googleapis.com/v1/urlInspection/index:inspect`（body: `inspectionUrl`、`siteUrl`、`languageCode: "ja"`）。
- 使い方: `npm.cmd run sc:inspect -- <URL> [<URL> ...]`。URL は1回に20件まで。1件ずつ順番に問い合わせる。
- 出力（画面と `runtime-data/search-console/inspect-YYYYMMDD.md`。日付は日本時間、同じ日は上書き）: URL ごとに次を表にする。
  - `indexStatusResult` の `verdict`、`coverageState`、`lastCrawlTime`（日本時間に直す）、`googleCanonical`、`userCanonical`、`robotsTxtState`、`indexingState`、`pageFetchState`、`sitemap`
- 値がないときは「なし」と書く。
- エラーのとき: URL ごとに HTTP の番号と、Google が返した `error.message` だけを書き、ほかの URL は続ける。設定が足りないときは、どの名前が足りないかだけを書いて止める。

4. やってはいけないこと
- 秘密鍵・アクセストークン・`.env.local` の値を、画面・ファイル・ログ・テストに出す。
- `webmasters.readonly` 以外のスコープ、登録リクエスト、サイトマップの送信など、書き込みの操作。
- 指定した4ファイル以外の変更、依存関係の追加、`.env.local` の作成や変更、`git commit`、`git push`。
- テストで本物の Google にアクセスする（`fetch` を差し替えて試す）。
- 作業前に `git status` を確かめ、他者の未コミット変更を戻したり上書きしたりしない。

5. 完了条件
- `npm.cmd run sc:inspect` を URL なしで実行すると、使い方を表示して終わる。
- 設定がないときは、足りない名前だけを表示して止まる（値は出さない）。
- テストで次を確かめている: 秘密鍵の整え方、API の応答から表を作る処理、エラーの応答のとき次の URL へ進むこと、出力に秘密鍵やトークンが入らないこと。
- `npm.cmd test` と `npm.cmd run lint` が通る。

6. 確認方法
- `npm.cmd test`、`npm.cmd run lint`。
- `.env.local` にまだ鍵がないので、本物の API での確認はしない（トレンド・SEO部署が、ユーザーが鍵を置いたあとに行う）。

7. 報告の形
変更したファイル、テストの結果、未確認の事項を分けて書く。
