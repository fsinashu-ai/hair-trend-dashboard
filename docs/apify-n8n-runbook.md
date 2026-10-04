# Apify SNS import runbook

この資料は、Apify Actor の実行結果を n8n から `import-social` API へ渡すための運用手順です。認証情報・Actor ID・実URLはリポジトリへ保存しません。

## 構成

```text
Schedule Trigger (Asia/Tokyo)
  -> POST Apify Actor run
  -> wait / poll until SUCCEEDED
  -> GET Dataset items
  -> POST /api/automation/import-social
```

アプリ側のAPIは、`items` / `posts` / `results` / `data` / `datasetItems` のいずれかの配列を受け付けます。推奨payloadは次の形です。

```json
{
  "provider": "Apify",
  "sourceName": "Apify Instagram Actor",
  "actorId": "<actor-id>",
  "actorRunId": "<run-id>",
  "datasetId": "<dataset-id>",
  "requestId": "<n8n-execution-id>",
  "idempotencyKey": "Apify:<actor-id>:<run-id>",
  "items": []
}
```

## n8n secrets

n8nの環境変数またはcredentialで次の値を管理します。値そのものはworkflow exportに含めません。

- n8n Credential `Apify API Bearer` (`httpBearerAuth`) に保存するToken（環境変数には置かない）
- `APIFY_INSTAGRAM_ACTOR_ID`
- `APIFY_TIKTOK_ACTOR_ID`
- `SOCIAL_IMPORT_URL`
- `AUTOMATION_WEBHOOK_SECRET`

HTTP Request nodeでは、`Apify API Bearer` (`httpBearerAuth`) Credentialを利用してください。ApifyのAuthorizationヘッダーをノード設定や環境変数へ直接書かないでください。アプリ向けリクエストには次のヘッダーを付与します。

```text
Authorization: Bearer {{$env.AUTOMATION_WEBHOOK_SECRET}}
Content-Type: application/json
Idempotency-Key: Apify:<actor-id>:<run-id>
```

## 実行とリトライ

1. Schedule Triggerのtimezoneを `Asia/Tokyo` に固定する。
2. Actor run開始後は、固定sleepだけに依存せず `actor-runs/<run-id>` をpollする。
3. `SUCCEEDED` になったときだけDataset itemsを取得する。
4. `RUNNING` / `READY` は指数backoffで最大5回までpollする。
5. `FAILED` / `ABORTED` / `TIMED-OUT` はアプリへ空配列を送らず、n8nのエラー処理へ送る。
6. Dataset取得またはアプリAPIが `429` / `5xx` の場合は、同じrunを再実行せずbackoffして最大3回再送する。
7. アプリAPIの `duplicateRun: true` は成功扱いにする。これは同じActor runの再送を意味する。

## API応答の確認

成功・preview・部分成功では、応答の次の値を実行ログに残します。

- `runId`
- `receivedCount`, `normalizedCount`, `savedCount`
- `duplicateCount`, `skippedCount`, `errorCount`
- `aiClassifiedCount`
- `sourceMatchedCount`
- `truncatedCount`

`runId` はSupabaseの `social_import_runs.id` と一致します。SNS InboxのImport runs欄でも直近実行を確認できます。

## データ保護

- Actor token、Webhook secret、n8n credentialはJSON export・Git・ログへ出力しない。
- `raw_payload` はアプリ側で深さ・配列数・文字数を制限し、authorization、cookie、password、secret、token、api key、email、phoneに該当するkeyを除外する。
- 本番DBへSQLを適用する前に `social_posts` と `social_import_runs` のバックアップを取得する。
- 本番のworkflow変更は、dry-run、少量dataset、再送確認の順で行う。

## SQL適用

通常は `supabase/schema.sql` を利用します。既存schemaへ追加だけを適用する場合は `supabase/apify-social-import-v2.sql` を使います。どちらも既存投稿を削除しない追加型です。

## 火曜日限定の週次実行

`automation/n8n/run-weekly-apify-catchup.ps1` は、火曜日に今週の成功履歴を確認し、不足しているInstagram/TikTokだけを1回実行します。

Windows予定タスク `HairTrendDashboard-ApifyWeeklyCatchup` は毎週火曜日09:45（日本時間）に設定します。`StartWhenAvailable` と `WakeToRun` は無効にし、火曜日の予定時刻にPCが利用可能な場合だけ実行します。予定時刻を逃した場合、別の曜日には取り戻し実行しません。通常のn8n実行が成功済みの場合は、Apify Actorを再実行しません。

この予定タスクの開始時にDocker Desktopが停止していれば自動起動し、処理後はこの予定タスクが起動したDocker Desktopだけを自動停止します。利用者が先にDocker Desktopを起動していた場合は、作業を妨げないよう停止しません。Windowsへのサインイン時には起動させないため、Docker設定の `AutoStart` を無効にし、WindowsのRun登録に `Docker Desktop` が残っていないことも確認します。

ログは `C:\n8n\logs\apify-weekly-catchup.log` に保存されます。スクリプトにはApify TokenやWebhook Secretを保存しません。

### Docker起動の確認

2026-09-15、Windows PowerShell 5.1でDocker停止中の標準エラーが例外になり、自動起動へ進めない問題を修正しました。停止判定では終了コードを確認し、Docker Desktopの起動へ進みます。

取得処理を実行せず、Dockerとn8nの起動・終了だけを確認するには、次を使います。

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File automation/n8n/run-weekly-apify-catchup.ps1 -CheckStartupOnly
```

予定実行にはPCの電源が入り、対象ユーザーがWindowsへログインしている必要があります。Docker本体の起動後もエンジンが準備できない場合は、失敗をログに記録します。
