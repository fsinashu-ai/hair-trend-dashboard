# Hair Trend Dashboard 作業状況

最終更新: 2026-10-21

## 現在の状態

- Windows の週次タスク HairTrendDashboard-ApifyWeeklyCatchup は、2026-09-22、09-29、10-06、10-13 にすべて成功。各回で Docker 起動、Instagram/TikTok 取込、Docker 停止まで完了し、C:\n8n\logs\apify-weekly-catchup.log で確認済み。
- 毎週「今週の実行記録なし → 実行」と判定されているため、現状はこのスケジュールタスクが実質唯一の実行元。2026-09-15 の週のデータは未バックフィル。
- 2026-10-20 の週次実行も成功。件数ログは Instagram・TikTok とも `counts unavailable` だったが、Supabase の social_import_runs では件数付きの成功記録を確認（10/20: 受信3・保存3、受信1・重複1。10/13: 受信1・保存1）。原因はスクリプト側の n8n 出力解析と判断し、解析の改善と値を含まない診断行を追加（2026-10-20）。実出力での動作は 2026-10-27 の週次ログで確認する。
- 週あたりの受信が1〜3件と少ない（上限30件）。Apify 側の取得件数・ハッシュタグ設定と使用量は未確認（Codex の Chrome では Apify がログイン画面になり確認できず）。
- 2026-10-04 に GA4 クリック指標の照合、モバイル表示修正、本番確認を実施。詳細: [GA4指標照合メモ](../docs/ga4-metric-reconciliation-2026-10-04.md)
- 今回のセキュリティ修正: Basic 認証のIP別失敗回数制限、12時間有効の署名付き v2 ログインCookie、Cron/自動取込シークレットの定時間比較、n8nログの数値件数だけの出力を追加。

## 9/15時点の確認メモ

- 週次タスクは火曜09:45（日本時間）指定で Ready。Docker Desktop は常時起動せず、タスク実行時のみ起動・停止する構成。
- 9/15の初回確認では PowerShell 5.1 の Docker 停止判定で標準エラー処理に問題が発生。終了コード判定と起動確認モードを追加し、その後の起動確認は成功。

## 未対応事項

- D1（2026-10-16 決定）: Apify 経由の Instagram/TikTok 取り込みは AGENTS.md の例外として継続。保存は URL・ハンドル・日付・数値・ハッシュタグ・AI要約に限定し、本文・rawPayload の文字列・サムネイルURLは保存しない（2026-10-18 に push し、Vercel の2プロジェクトでデプロイ成功を確認。本番でのログインと取り込みの動作は未確認）。既存データの本文・rawPayload は残したまま。消去するかは未定。
- 2026-10-21 Supabase 確認（Codex の Chrome、画面のみ）: keywords・trend_links・blog_posts・social_posts・social_import_runs・social_sources はすべて RLS 有効で anon 向け読み取りポリシーなし。hair-images バケットは Private。匿名キーでの読み取りテストは未実施。
- 2026-10-21 Vercel 確認（名前のみ、値は未表示）: Codex は hair-trend-dashboard の一覧に APP_USER・APP_PASSWORD・GEMINI_API_KEY を見つけられなかったが、同日ユーザーの目視で3つとも「ある」と確認（Codex の見落とし）。hair-trend-dashboard-wnan は環境変数ゼロで同じリポジトリを本番デプロイしている（不要なら整理を検討）。OPENAI_API_KEY は Vercel に無く、ローカルの .env.local だけに残る。
- 2026-10-21 npm audit（本番依存）: next 16.2.9 に critical（Middleware/Proxy のすり抜け）。16.3.8 以降で修正。undici（override で 7.28.0 固定）、postcss、sharp なども high。同日ユーザー承認で next・eslint-config-next を ^16.3.8（実際は 16.4.2）、undici override を 7.30.1 に更新（Codex の環境は npm に接続できず、Claude が直接実施）。lint・test 25件・build 成功、critical と undici の high は解消。残りは postcss・nanoid・source-map-js（high、主にビルド時）と protobufjs・baseline-browser-mapping（moderate）で、いずれも `npm audit fix`（--force なし）で修正可能。2026-10-21 にユーザー承認で push（5878805）。Vercel 2プロジェクトともデプロイ成功。両方の本番URLで、未ログインのページと API が 401（Basic 認証要求、X-Frame-Options: DENY）になることを確認。正しいパスワードでのログインと画面表示はユーザー確認待ち。問題があれば直前のコミットに戻して push する（ユーザー了承済み）。
