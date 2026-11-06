# ヘアトレンドダッシュボードの運用

ダッシュボード全体を、いつ・何が・誰によって動いているかでまとめます。ブログ作成は [blog-workflow.md](blog-workflow.md)、細かい設定や手順は README と各 docs を参照してください。

最終更新: 2026-11-06（Supabase の記録で動作を確認）

## 1. 自動で動いているもの

| いつ | 何をする | 実行元 | 2026-11-06 の確認 |
| --- | --- | --- | --- |
| 毎朝7時 | トレンド候補の自動生成（RSS・取得元 → Gemini で分類 → `trend_links`） | Vercel Cron `/api/trends/auto-generate` | 直近14日で14件追加、最新 11/6 朝 |
| 毎週火曜 9:45 | Instagram・TikTok の公開投稿の取り込み（Apify → n8n → `/api/automation/import-social`、AI分類は1回10件まで） | Windows タスク `HairTrendDashboard-ApifyWeeklyCatchup`（Docker を起動して終わったら停止） | 11/3 成功（受信26・保存21・AI分類10、受信14・保存9・AI分類9） |
| 毎月5日 9時ごろ | 前月の Search Console・GA4 を取得 | Vercel Cron `/api/seo/monthly-fetch` | 11/5 に10月分を取得 |

- 定期処理の実行元は上の2つ（Vercel Cron と Windows タスク）だけにする。同じ処理を別の場所で動かさない。
- 週次タスクの記録: `C:\n8n\logs\apify-weekly-catchup.log`。取り込み結果は Supabase の `social_import_runs`。
- パソコンが火曜 9:45 に起動していないと、その週の取り込みは動かない（タスクの「開始時刻を過ぎたらすぐ実行」は オフ。2026-11-06 確認）。逃した週は、手動でタスクを実行すれば取り込める。次回は 11/10 9:45。

## 2. 人が行うこと

| 頻度 | 誰が | 何をする |
| --- | --- | --- |
| 毎日（任意） | ユーザー | ホームで今日のトレンドを見る。気になる URL やメモを登録する。投稿ネタ・接客の説明を作る |
| 毎週 | ユーザー＋トレンド・SEO | ブログ1本（流れは [blog-workflow.md](blog-workflow.md)）。火曜の取り込みが終わったあとにネタ帳を書き出すと新しいデータが入る |
| 毎週（火曜の後） | トレンド・SEO | 取り込みが成功したか（`social_import_runs` の件数）を確認し、失敗していれば報告する |
| 毎月（5日以降） | トレンド・SEO | 前月の Search Console・GA4 を見て、記事ごとの表示・クリック・LINE クリック、書き直す記事、次のテーマをまとめて報告する |
| 毎月 | トレンド・SEO | Apify の使用額（Free plan、月 $5 まで）と Gemini の無料枠に収まっているかを確認する |
| 必要なとき | ユーザー | 広告 CSV の取り込み、取得元（RSS など）の追加・停止 |

## 3. 費用

- Gemini・Apify は無料枠だけで使う（支払い設定なし）。上限を超えた分は、仮の分類になるか取り込まれないだけで、請求はされない。
- Apify は 10月の時点で1か月 約 $0.55（上限 $5.00）。
- ブログの執筆と画像は Codex（ChatGPT の契約内）と Claude で行う。

## 4. 担当

| 担当 | 役割 |
| --- | --- |
| ユーザー | 判断と承認（テーマ、公開、本番・外部に影響する変更）、日々の閲覧と登録 |
| トレンド・SEO（Claude Code） | 確認・集計・報告、Codex への指示、変更の確認とテスト |
| Codex | コードの実装・修正、ブログ本文と画像の作成 |
| ホームページ部署 | WordPress の下書き登録・公開・修正（分担の詳細は [role-split-homepage.md](role-split-homepage.md)） |

本番・外部に影響する作業（デプロイ、DB の変更、n8n・Vercel・Windows タスクの設定変更、データの削除）は、ユーザーの承認・元に戻す方法・実施後の確認項目の3つがそろってから行う。push もユーザーの指示があるときだけ。

## 5. 困ったとき

| 症状 | まず見るところ |
| --- | --- |
| トレンドが増えない | Vercel の Cron のログ、取得元管理で無効になっている取得元 |
| SNS の新しい投稿が入らない | `C:\n8n\logs\apify-weekly-catchup.log`、`social_import_runs`、[apify-n8n-runbook.md](apify-n8n-runbook.md) |
| SEO の数字が古い | `seo_search_console_imports`・`seo_ga4_imports` の最新日、[search-console-api-integration-runbook.md](search-console-api-integration-runbook.md) |
| ログインできない | Vercel の環境変数 APP_USER・APP_PASSWORD（値はチャットや文書に書かない） |

## 6. 使っていない機能・保留中のこと（2026-11-06）

- 使われていない: キーワード管理（0件）、投稿ネタの保存（`sns_posts` 0件）、AI 出力の保存（`ai_outputs` 0件）。ダッシュボードのブログ下書き（`blog_posts`）は 8月以降使っていない（記事は WordPress に直接下書きする運用に変更）。使い続けるか、画面から外すかはユーザー判断。
- 2026-11-06 ユーザー判断で、使っていない10画面をメニューと画面内のリンクから隠した（ページ・API・データは残し、URL を直接入力すれば開ける）: /keywords、/post-generator、/image-analysis、/quality-check、/seo/keywords・/seo/pages・/seo/reports（中身はダミー）、/seo/tasks、/ads/creatives、/ads/reports。戻すときは `src/data/navigation.ts` と `src/components/marketing/MarketingSectionNav.tsx` などのリンクを元に戻し、`tests/navigation-hidden.test.mjs` を直す。 2026-11-06 に push（469f389）し、Vercel のデプロイ成功と、未ログインでは 401 になることを確認。ログイン後の本番画面で10画面が消えていることをユーザーが確認。
- ユーザー判断待ち（[tasks/CURRENT.md](../tasks/CURRENT.md) の「保留」）: 残りの npm 脆弱性の修正、Supabase に残っている投稿本文・rawPayload の消去、OPENAI_API_KEY の無効化（ユーザー作業）。
