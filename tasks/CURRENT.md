# ヘアトレンド・SEO管理 現在の作業

最終更新: 2026-09-15

## Docker / n8n の週次運用

- 目的: Docker Desktopを常時起動せず、Apify / n8nの週次処理に必要な時間だけ動かす。
- Windows予定タスク: `HairTrendDashboard-ApifyWeeklyCatchup`
- 実行日時: 毎週火曜日09:45（日本時間）。次回予定は2026-09-22 09:45。
- `StartWhenAvailable` と `WakeToRun` は無効。火曜日09:45にPCが利用可能な場合だけ実行し、別の曜日には取り戻し実行しない。
- Docker Desktopのサインイン時自動起動は無効化済み（`AutoStart: false`）。WindowsのRun登録も削除し、復旧用の値を `HKCU\Software\CodexHub\DisabledStartup` に退避した。
- 予定タスク開始時にDockerが停止していれば自動起動し、週次処理後にこのタスクが起動したDockerだけを停止する。
- 利用者が先にDockerを起動していた場合は、作業を妨げないよう処理後も停止しない。

## 確認結果

- Windows予定タスクは `Ready`、火曜日指定、対話ユーザー実行であることを確認した。
- PowerShellスクリプトの構文検査は成功した。
- Docker設定JSONは正常で、`AutoStart: false` を確認した。
- 2026-09-11、残存していたWindowsスタートアップ登録 `Docker Desktop` を特定して解除した。
- 予定タスクの `StartWhenAvailable: false`、`WakeToRun: false` を確認した。
- 2026-09-15 09:45の予定実行は失敗。Windows PowerShell 5.1でDocker停止判定の標準エラーが例外になり、自動起動へ進めなかった。
- 停止判定とコンテナ確認時だけ標準エラーで中断しないよう修正し、終了コードで判定する。取得を行わない `-CheckStartupOnly` を追加した。
- 11:36の起動テストはDockerエンジンの応答待ちでタイムアウト。Docker専用WSLを停止後、13:52の再テストは成功した。
- 13:52:46 Docker自動起動、13:53:11 Docker/n8n準備完了、13:53:29 Docker自動停止をログで確認。テスト終了コードは0。
- `npm.cmd run lint`、`npm.cmd run build` は成功。
- 本番のApify取得は今回再実行していない。今日の取得漏れは別途週次成功履歴を確認してから補完する。

## 次の確認

- 2026-09-22の予定実行後、`C:\n8n\logs\apify-weekly-catchup.log` でDocker起動、処理成功、Docker停止を確認する。PC電源とWindowsログインが必要。

## 関連ファイル

- `automation/n8n/run-weekly-apify-catchup.ps1`
- `docs/apify-n8n-runbook.md`
