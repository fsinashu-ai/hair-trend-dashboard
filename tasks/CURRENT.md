# Hair Trend Dashboard 作業状況

最終更新: 2026-11-06

## 現在の状態

- Windows の週次タスク HairTrendDashboard-ApifyWeeklyCatchup は、2026-09-22、09-29、10-06、10-13 にすべて成功。各回で Docker 起動、Instagram/TikTok 取込、Docker 停止まで完了し、C:\n8n\logs\apify-weekly-catchup.log で確認済み。
- 毎週「今週の実行記録なし → 実行」と判定されているため、現状はこのスケジュールタスクが実質唯一の実行元。2026-09-15 の週のデータは未バックフィル。
- 2026-10-20 の週次実行も成功。件数ログは Instagram・TikTok とも `counts unavailable` だったが、Supabase の social_import_runs では件数付きの成功記録を確認（10/20: 受信3・保存3、受信1・重複1。10/13: 受信1・保存1）。原因はスクリプト側の n8n 出力解析と判断し、解析の改善と値を含まない診断行を追加（2026-10-20）。実出力での動作は 2026-10-27 の週次ログで確認する。
- 週あたりの受信が1〜3件と少ない（上限30件）。2026-10-22 に Codex の Chrome で Apify を確認（画面のみ）: Free plan、請求期間 10/19〜11/18 の使用額 $0.55 / $5.00。Instagram（apify/instagram-scraper、タスク Instagram-hair-trends、入力20個、resultsPerPage=5）は 9/22〜10/20 の毎週火曜に成功し毎回95件・約$0.26。TikTok（clockworks/tiktok-scraper、タスク tiktok-hair-trends、入力19個・各5件）は毎回79件・約$0.29。Max cost per run はどちらも $0.50。→ Apify は95件/79件を取れているのに、ダッシュボードの受信は3件/1件なので、件数は n8n の実際のワークフロー内で減っている（手本 `apify-social-import.workflow.example.json` の通りなら全件送るはずなので、実際のワークフローは手本と違うと推測）。2026-10-22 に n8n の実ワークフロー定義（Instagramトレンド取得 / TikTokトレンド取得、秘密を伏せた写しを scratch/n8n-workflow-review/ に保存、Git 対象外）を確認し原因を特定: (1) Apify 呼び出し（HTTP Request1、run-sync-get-dataset-items）の URL に `limit=5` があり、Apify が95件/79件取っても n8n が受け取るのは先頭5件だけ（費用は全件分かかっている）。(2) 続く Code ノード「Filter Keywords」が caption/title/description/text にサロン向けキーワードを含むものだけ残すため、5件→3件/1件に減る。(3) 送信ノード（HTTP Request2）は executeOnce で本番 hair-trend-dashboard.vercel.app に1回だけ送っている。手本 `apify-social-import.workflow.example.json` とは構成が違う。2026-10-22 ユーザー承認で A（limit=5→30）だけ実施: 変更前の定義を `C:\n8n\backups\2026-10-22-before-limit30\` に書き出し（Git 外。秘密を含みうるので共有しない）、両ワークフローの HTTP Request1 の URL を limit=30 に変えて n8n CLI で取り込み。取り込みで無効化されたため有効に戻して n8n を再起動し、書き出し直して limit=30・他ノードと接続は変更なし・active=true を確認。Docker は停止済み。戻す方法: Docker と n8n を起動し、バックアップを `n8n import:workflow` で取り込み、`n8n publish:workflow --id=<ID>` で有効化して再起動。フィルター（B）は保留。2026-10-27 の週次実行で効果を確認（2026-10-31、Codex 全体管理チャットが Supabase の social_import_runs を画面で確認）: Instagram 受信28・保存19・重複9、TikTok 受信11・保存8・重複3、いずれも success・エラー0・AI分類3件ずつ。10/20（受信4・保存3）から大きく増えた。件数ログは両方とも `counts unavailable: missing fields`（Instagram keys=previousNode,previousNodeOutput,previousNodeRun、TikTok keys=id,name,title,cover）で、n8n の rawOutput の最後の JSON がダッシュボードの応答ではない。取り込み自体は正常で件数は Supabase で見られるため、ログの件数表示は優先度低の未解決。
- 2026-10-31 ユーザー判断で、AI分類の上限を1回3件→10件に変更（Gemini は無料枠のまま。支払い設定なしをユーザーが確認）。週の Gemini 呼び出しは最大20回程度。上限を超えた分や無料枠を超えた分は仮の分類になるだけ。(1) ダッシュボード側: import-social の `freeAiLimit` を 10 にし、処理時間の上限 `maxDuration = 60` を追加（Codex 実装、lint・test 25件成功を Claude も確認）。2026-10-31 に push（f4aeacb）し本番反映済み。(2) n8n 側: 2つのワークフローの送信内容（HTTP Request2）の `aiLimit: 3` を 10 に変更。変更前の定義を `C:\n8n\backups\2026-10-31-before-ailimit10\` に書き出し（Git 外）、取り込み → `publish:workflow` → 再起動。書き出し直して、変わったのは aiLimit だけ・limit=30 のまま・active=true を確認。Docker は停止済み。push 前に週次実行が来ても、ダッシュボード側が3件に抑えるだけで問題はない。戻し方は 10/22 と同じ手順でこのバックアップを取り込む。効果は 2026-11-03 の週次実行（Supabase の social_import_runs の AI分類件数）で確認する。
- 2026-10-04 に GA4 クリック指標の照合、モバイル表示修正、本番確認を実施。詳細: [GA4指標照合メモ](../docs/ga4-metric-reconciliation-2026-10-04.md)
- 今回のセキュリティ修正: Basic 認証のIP別失敗回数制限、12時間有効の署名付き v2 ログインCookie、Cron/自動取込シークレットの定時間比較、n8nログの数値件数だけの出力を追加。

## 9/15時点の確認メモ

- 週次タスクは火曜09:45（日本時間）指定で Ready。Docker Desktop は常時起動せず、タスク実行時のみ起動・停止する構成。
- 9/15の初回確認では PowerShell 5.1 の Docker 停止判定で標準エラー処理に問題が発生。終了コード判定と起動確認モードを追加し、その後の起動確認は成功。

- 2026-11-06 ブログ作成の Codex 連携（ユーザー承認の第1段階）: 手順は ①ネタ帳書き出し → ②トレンド・市場レポートとテーマ候補 → ③ユーザーがテーマ選択 → ④本文 → ⑤図解・アイキャッチ（Codex作成）＋本文内はサロンの実写真 → ⑥Claude チェック → ⑦ダッシュボードに下書き保存。Gemini/Apify は無料枠のまま、執筆は Codex/Claude のトークンで行う。WordPress への下書き登録は第2段階でホームページ部署と調整。①を実装: `npm.cmd run blog:brief`（読み取りのみ、出力は Git 外の runtime-data/blog-brief/、投稿URL・ハンドル・本文などは含めない。詳細 [docs/blog-brief.md](../docs/blog-brief.md)）。初回書き出しでは keywords・seo_keywords が0件、SNS は直近90日分、既存記事は公開5件・下書き3件（ダッシュボードの既存記事はサイト全体の40件を反映していないため、重複確認は公開サイトの記事一覧でも行う）。②レポート（runtime-data/blog-brief/report-20261106.md、Git 外）: 検索で表示が多いのにクリック0の「縮毛矯正 ビビリ毛」「ファッションカラーとは」「髪の履歴とは」などから候補5つ。ユーザーが C「髪の履歴とは？どこまで伝える？」（新規）を選択。④⑤⑥: Codex が本文・WordPress 用 HTML・meta・アイキャッチ・髪の履歴メモ画像を作成（runtime-data/blog-drafts/kami-rireki/）、Claude が表現・既存記事6171との役割分担・リンク・画像を確認し店名表記を修正。ダッシュボードの保存処理は img タグを除くため、⑦はユーザー判断で WordPress への下書き登録に変更し、2026-11-06 ユーザー承認でホームページ部署へ依頼（公開はしない）。次: ホームページ部署の結果確認 → ユーザーが内容を確認して公開判断 → 2本目（A ビビリ毛の書き直し）。

## 未対応事項

- D1（2026-10-16 決定）: Apify 経由の Instagram/TikTok 取り込みは AGENTS.md の例外として継続。保存は URL・ハンドル・日付・数値・ハッシュタグ・AI要約に限定し、本文・rawPayload の文字列・サムネイルURLは保存しない（2026-10-18 に push し、Vercel の2プロジェクトでデプロイ成功を確認。本番でのログインと取り込みの動作は未確認）。既存データの本文・rawPayload は残したまま。消去するかは未定。
- 2026-10-21 Supabase 確認（Codex の Chrome、画面のみ）: keywords・trend_links・blog_posts・social_posts・social_import_runs・social_sources はすべて RLS 有効で anon 向け読み取りポリシーなし。hair-images バケットは Private。匿名キーでの読み取りテストは未実施。
- 2026-10-21 Vercel 確認（名前のみ、値は未表示）: Codex は hair-trend-dashboard の一覧に APP_USER・APP_PASSWORD・GEMINI_API_KEY を見つけられなかったが、同日ユーザーの目視で3つとも「ある」と確認（Codex の見落とし）。hair-trend-dashboard-wnan は環境変数ゼロで同じリポジトリを本番デプロイしている（不要なら整理を検討）。OPENAI_API_KEY は Vercel に無く、ローカルの .env.local だけに残る。
- 2026-10-21 npm audit（本番依存）: next 16.2.9 に critical（Middleware/Proxy のすり抜け）。16.3.8 以降で修正。undici（override で 7.28.0 固定）、postcss、sharp なども high。同日ユーザー承認で next・eslint-config-next を ^16.3.8（実際は 16.4.2）、undici override を 7.30.1 に更新（Codex の環境は npm に接続できず、Claude が直接実施）。lint・test 25件・build 成功、critical と undici の high は解消。残りは postcss・nanoid・source-map-js（high、主にビルド時）と protobufjs・baseline-browser-mapping（moderate）で、いずれも `npm audit fix`（--force なし）で修正可能。2026-10-21 にユーザー承認で push（5878805）。Vercel 2プロジェクトともデプロイ成功。両方の本番URLで、未ログインのページと API が 401（Basic 認証要求、X-Frame-Options: DENY）になることを確認。同日ユーザーが本番にログインし、トレンド一覧が問題なく開くことを確認。問題があれば直前のコミットに戻して push する（ユーザー了承済み）。

## 保留（2026-10-22 ユーザー判断）

- 残りの npm 脆弱性（postcss・nanoid・source-map-js の high、protobufjs・baseline-browser-mapping の moderate）を `npm audit fix` で直すか。
- Supabase に保存済みの投稿本文・rawPayload を消去するか。
- ローカルの .env.local にだけ残る OPENAI_API_KEY の、OpenAI 側での無効化（ユーザー作業）。
- Vercel の2つ目のプロジェクト hair-trend-dashboard-wnan の整理: 2026-10-22 ユーザー判断で「Git 連携の解除」に決定（プロジェクトは残す。戻すときは wnan の Settings > Git で fsinashu-ai/hair-trend-dashboard をつなぎ直す）。同日ユーザー承認のもと Codex が Chrome で解除を実施し、wnan は「not connected to a Git repository」、本番 hair-trend-dashboard は引き続き main に接続中であることを画面で確認（Codex 報告）。2026-10-22 の push（756e72c）で GitHub のステータスが hair-trend-dashboard の1件だけになり、デプロイ成功を確認。2026-10-22 に Codex の Chrome で確認（画面のみ）: どちらも独自ドメインなし（hair-trend-dashboard.vercel.app と hair-trend-dashboard-wnan.vercel.app だけ）。どちらも同じリポジトリの main に接続し、vercel.json の Cron 2件（毎日の auto-generate、毎月5日の monthly-fetch）が両方で有効。wnan は環境変数が無く CRON_SECRET も無いため、wnan 側の Cron は認証で弾かれ実データには触れない（推測）。本番の Cron は hair-trend-dashboard 側で直近12時間に auto-generate の実行1件を確認。
