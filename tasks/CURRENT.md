# Hair Trend Dashboard 作業状況

最終更新: 2026-10-16

## 現在の状態

- Windows の週次タスク HairTrendDashboard-ApifyWeeklyCatchup は、2026-09-22、09-29、10-06、10-13 にすべて成功。各回で Docker 起動、Instagram/TikTok 取込、Docker 停止まで完了し、C:\n8n\logs\apify-weekly-catchup.log で確認済み。
- 毎週「今週の実行記録なし → 実行」と判定されているため、現状はこのスケジュールタスクが実質唯一の実行元。2026-09-15 の週のデータは未バックフィル。
- 2026-10-04 に GA4 クリック指標の照合、モバイル表示修正、本番確認を実施。詳細: [GA4指標照合メモ](../docs/ga4-metric-reconciliation-2026-10-04.md)
- 今回のセキュリティ修正: Basic 認証のIP別失敗回数制限、12時間有効の署名付き v2 ログインCookie、Cron/自動取込シークレットの定時間比較、n8nログの数値件数だけの出力を追加。

## 9/15時点の確認メモ

- 週次タスクは火曜09:45（日本時間）指定で Ready。Docker Desktop は常時起動せず、タスク実行時のみ起動・停止する構成。
- 9/15の初回確認では PowerShell 5.1 の Docker 停止判定で標準エラー処理に問題が発生。終了コード判定と起動確認モードを追加し、その後の起動確認は成功。

## 未対応事項

- D1（2026-10-16 決定）: Apify 経由の Instagram/TikTok 取り込みは AGENTS.md の例外として継続。保存は URL・ハンドル・日付・数値・ハッシュタグ・AI要約に限定し、本文・rawPayload の文字列・サムネイルURLは保存しない（コード修正済み、本番未デプロイ）。既存データの本文・rawPayload は残したまま。消去するかは未定。
- Supabase の RLS / Storage 公開設定と Vercel 環境変数の確認。ユーザー側の作業。
