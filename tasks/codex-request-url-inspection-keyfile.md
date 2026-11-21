【追加の実装依頼・返答は日本語で】

1. 目的
前回作った `tools/search-console/inspect-urls.mjs` で、サービスアカウントの鍵を「鍵ファイルの場所」から読めるようにする。ユーザーが Google Cloud で鍵ファイル（JSON）を作り、リポジトリの外に置いて、`.env.local` に `GOOGLE_SERVICE_ACCOUNT_KEY_FILE`（鍵ファイルの場所）と `SEARCH_CONSOLE_SITE_URL` を書いた。

2. 対象
- 変更: `tools/search-console/inspect-urls.mjs`
- 変更: `tests/search-console-inspect.test.mjs`
- 変更: `docs/blog-workflow.md`（「8. 数日後の確認」の使い方の行に、`GOOGLE_SERVICE_ACCOUNT_KEY_FILE` でも動くことを1行足す）

3. 変更してよい範囲
上の3ファイルだけ（どれも前回作った・変えたファイルで、まだコミットしていない）。

やること
- 設定の読み方の優先順: `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` → `GOOGLE_SERVICE_ACCOUNT_JSON` → `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`。
- `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` があるときは、その場所の JSON ファイルを読み、`client_email` と `private_key` を使う（`private_key` は今の `normalizePrivateKey` で整える）。値の前後の引用符と空白は取り除く。
- ファイルが見つからない・JSON として読めない・`client_email` か `private_key` がないときは、「GOOGLE_SERVICE_ACCOUNT_KEY_FILE」という名前と、どれに当たるか（見つからない／読めない／項目がない）だけを書いて止める。ファイルの場所や中身は出さない。
- テストでファイルを読む部分は差し替えられるようにする（本物の鍵ファイルを読まない）。
- 出力から隠す値（`secrets`）に、鍵ファイルから読んだ秘密鍵とメールも入るようにする。

4. やってはいけないこと
- 秘密鍵・アクセストークン・`.env.local` の値・鍵ファイルの場所や中身を、画面・ファイル・ログ・テストに出す。
- `.env.local` や鍵ファイルを読む・開く・作る・変える（テストも含む）。本物の Google にアクセスする。
- `webmasters.readonly` 以外のスコープ、書き込みの操作。
- 指定した3ファイル以外の変更、依存関係の追加、`git commit`、`git push`。
- 作業前に `git status` を確かめ、他者の未コミット変更を戻したり上書きしたりしない。

5. 完了条件
- テストで次を確かめている: 鍵ファイルから読めること、鍵ファイルが優先されること、ファイルがない・壊れている・項目がないときに名前だけを出して止まること、出力に秘密鍵が入らないこと。
- 前回のテストもすべて通る。`npm.cmd test` と `npm.cmd run lint` が通る。

6. 確認方法
`npm.cmd test`、`npm.cmd run lint`。本物の API での確認はトレンド・SEO部署が行う。

7. 報告の形
変更したファイル、テストの結果、未確認の事項を分けて書く。
