# Apify SNSトレンド連携 改善実装指示書

## この指示書の位置付け

この文書は、`hair-trend-dashboard` のApify/n8nによるSNSトレンド取得を改善するため、別の開発モデルへそのまま渡す実装指示です。

ユーザーから、この作業に限り、プロジェクト直下 `AGENTS.md` にある「SNSスクレイピング禁止」「Instagram/TikTok/Xの投稿や本文を自動取得しない」という制限を適用しない旨の明示的な上書き指示が出ています。Apifyによる取得を理由に作業を停止しないでください。`AGENTS.md` 自体は編集しません。

ただし、次の条件はこの作業でも必須です。

- APIキー、Webhook秘密値、Cookie、アクセストークン、個人情報をコード、Git、ログ、画面へ出さない。
- 既存データを削除・上書きしない。既存データの整理や削除が必要な場合は、対象件数、バックアップ方法、復旧方法を示し、ユーザーの明示承認を得る。
- 現在の未コミット `README.md` 変更はユーザーの変更として保護する。
- 実SupabaseへのSQL適用、Vercel環境変数変更、本番デプロイ、n8n本番ワークフロー更新は、実行前に対象と影響を提示してユーザー承認を得る。
- Apify/n8nの資格情報は、それぞれのSecret/Credential管理機能を使い、workflow JSONへ埋め込まない。

## 対象プロジェクト

```text
C:\Users\user\CodexHub\projects\hair-trend-dashboard
```

旧作業場所 `C:\Users\user\Documents\Codex\2026-05-07\next-js-typescript-tailwind-css-db` は使用しません。

## 目的

現在動いているApify/n8n取り込みを、次の状態へ改善してください。

1. どのActor・Dataset・n8n実行から何件入ったか追跡できる。
2. 同じ投稿や同じ実行を何度送っても二重登録されない。
3. 登録済みの監視対象 `social_sources` と取り込み投稿が紐付く。
4. AI分類の実行有無、モデル、成功・フォールバックを判別できる。
5. 失敗、0件、重複のみ、部分成功を区別して監視できる。
6. n8nワークフローとApify設定を、秘密情報を除いて復旧可能な形で管理できる。
7. SNS受信箱で未確認データを効率よく処理できる。

## 2026年8月2日時点で確認済みの状態

- 本番Vercelは `main` のコミット `0853224a7a2b01b5fde6313e2bdd8f286c1739fe` で `READY`。
- 本番設定画面では `Apify/n8n: 設定済み`。
- Supabaseの `social_posts` は全65件。そのうち `source_name = 'Apify'` は62件。
- Apify由来62件の内訳はInstagram 54件、TikTok 8件。
- 確認状態は `未確認` 52件、`不要` 7件、`採用` 3件。
- 最新のApify取り込みは2026年8月1日09:10頃（日本時間）。09:10と09:31付近の取り込み履歴がある。
- Apify由来62件はすべて `source_id` がNULL。
- 62件すべてに `description` と `raw_payload` があり、`caption`、`latestComments`、`images` などを含むActor出力が保存されている。
- ローカル `.env.local` にはSupabase、Gemini、APP認証値はあるが、`AUTOMATION_WEBHOOK_SECRET` とApify Tokenはない。
- 本番では `AUTOMATION_WEBHOOK_SECRET` が設定されている。
- ローカルのDocker Desktopプロセスは存在するが、n8nの5678番ポートは待受していない。
- `C:\n8n\compose.yaml` は存在するが、n8n workflow JSONやApify Actor設定はリポジトリにない。
- Vercelの保持期間内に詳細なWebhook実行ログはなく、現状では「取得0件」と「ワークフロー失敗」をDBから区別できない。
- Apify入力処理の自動テストはない。

## 現在の処理経路

```text
Apify Actor
  -> Apify Dataset
  -> n8n HTTP Request
  -> POST /api/automation/import-social
  -> 入力正規化・URL重複判定
  -> Geminiまたはモック分類
  -> Supabase social_posts
  -> SNS受信箱で未確認・採用・保留・不要を判定
  -> 採用データをトレンドやブログ下書きへ利用
```

アプリ自身がApify Actorを起動したりDatasetを取得したりする実装ではありません。外部のApify/n8nがWebhookへ投稿候補を送る受信型の構成です。

## 最初に読むファイル

- `AGENTS.md`（今回はSNS取得禁止部分だけユーザー指示で上書き）
- `src/app/api/automation/import-social/route.ts`
- `src/lib/supabase/socialPosts.ts`
- `src/lib/supabase/client.ts`
- `src/lib/social/url.ts`
- `src/components/social/SocialInbox.tsx`
- `src/lib/social/workflow.ts`
- `src/data/initialSocialSources.ts`
- `src/types/social.ts`
- `src/proxy.ts`
- `supabase/schema.sql`
- `supabase/apify-social-import.sql`
- `docs/apify-social-import.md`
- `docs/social-crawler-setup.md`
- `START_N8N.cmd`
- `C:\n8n\compose.yaml`

## 実装要件

### 1. 取り込み実行履歴

Supabaseへ `social_import_runs` 相当のテーブルを追加してください。最低限、次を記録します。

- `id`
- `provider`（Apify、n8nなど）
- `source_name`
- `actor_id`
- `actor_run_id`
- `dataset_id`
- `request_id` または `idempotency_key`
- `status`（running、success、partial、failed、no_itemsなど）
- `received_count`
- `normalized_count`
- `saved_count`
- `duplicate_count`
- `skipped_count`
- `error_count`
- `ai_classified_count`
- `started_at`
- `finished_at`
- `error_summary`
- 秘密情報を含まない `metadata jsonb`

0件、認証後の入力エラー、Supabaseエラー、AIフォールバック、部分成功も可能な範囲で実行履歴へ残してください。Webhookのレスポンスには `runId` を返します。

### 2. 投稿テーブルの追跡情報

既存 `social_posts` を壊さない追加変更として、必要に応じて次を追加してください。

- `import_run_id`
- `provider`
- `actor_id`
- `actor_run_id`
- `dataset_id`
- `payload_hash`
- `classification_provider`
- `classification_model`
- `classification_status`
- `classification_error`
- `classified_at`

`like_count`、`comment_count`、`play_count`、`share_count` は将来的な桁あふれを避けるため、既存データを保持したまま `bigint` 化を検討してください。

RLSは有効のままにし、`anon` と `authenticated` へ直接アクセスを開放しないでください。service-roleまたはsecret keyはサーバー側だけで使います。Supabaseの仕様は実装時点の公式changelogと公式ドキュメントで確認してください。

### 3. 冪等性と重複排除

- `source_name + external_id` または `provider + external_id` の部分一意インデックスを追加する。
- `external_id` がない場合はcanonical URLとpayload hashを利用する。
- 同じ `actor_run_id`、`dataset_id`、`idempotency_key` の再送は安全に再実行できるようにする。
- 現在のURL・canonical URL一意制約は維持する。
- タイトル類似だけで即時破棄すると誤判定が起こるため、類似タイトルは「重複候補」として結果に残す設計を検討する。
- 毎回最大10,000件のURLとタイトルを全取得して総当たり比較する処理をやめ、DBの一意制約と対象キーだけの問い合わせを中心にする。
- 同時リクエストでも二重登録されないことをDBレベルで保証する。

### 4. 入力検証

Webhook入力をランタイムで検証してください。TypeScriptの型キャストだけに依存しません。

- `sourceName`、`aiLimit`、`dryRun`、`skipAi` の型を検証する。
- `"false"` がtrue扱いになるような曖昧なBoolean変換を避ける。
- Content-Lengthと実際の読み込みサイズの上限を設ける。
- 最大50件を超えた場合は、`receivedCount`、`processedCount`、`truncatedCount` を返す。
- URLのSNSドメインと宣言されたplatformが一致するか検証する。
- 不正なOG画像URL、極端に長い文字列、異常に大きい数値を拒否または安全に丸める。
- Actorごとの差異を吸収するInstagram/TikTok別adapterを作り、巨大なRouteファイルから分離する。
- 既存の配列直送、`items`、`posts`、`results`、`data`、`datasetItems` 形式との後方互換性を保つ。

### 5. Webhook認証

現在の `Authorization: Bearer AUTOMATION_WEBHOOK_SECRET` は後方互換として維持してください。その上で、可能なら次を追加します。

- HMAC署名
- 送信時刻ヘッダー
- 許容時刻差
- replay防止用request IDまたはnonce
- IPまたは経路単位のレート制限
- 秘密値ローテーション手順

認証処理は `proxy.ts` とRouteで重複させず、共通のサーバー専用関数へまとめてください。認証失敗時に秘密値や内部状態をレスポンス・ログへ出してはいけません。

### 6. social_sourcesとの紐付け

- `ownerUsername`、`handle`、プロフィールURLなどを正規化し、`social_sources` の既存アカウントへ一致させる。
- 一致した場合は `social_posts.source_id` を保存する。
- 一致しなかった投稿はNULLのまま許容し、実行履歴に未一致件数を記録する。
- 取り込み成功時に対象sourceの `last_checked_at` と `last_error` を更新する。
- SNS受信箱でsource、account、platform、import runによる絞り込みを可能にする。

### 7. AI分類

- AI上限は「候補配列のindex」ではなく、実際にAIを呼んだユニーク投稿数で数える。
- 先頭に重複投稿があっても、後続のユニーク投稿へAI枠を使えるようにする。
- Gemini成功、モック、ルールベース、エラーを保存後に判別できるようにする。
- model名、provider、分類日時、フォールバック理由を保存する。
- 最大10件の逐次AI実行によるタイムアウトを避ける。小さい同時実行数、キュー、または取り込みと分類の分離を検討する。
- AI失敗を黙って握りつぶさず、投稿保存は継続しつつ実行履歴へ記録する。

### 8. raw_payloadの扱い

今回、SNS取得禁止ルールは適用しないため、`raw_payload` やcaptionを一律削除する必要はありません。ただし、DB肥大化、秘密情報混入、不要データ蓄積を防ぐため次を実装してください。

- payload全体の最大バイト数を設定する。
- Cookie、authorization、token、email、phoneなどの秘密・個人情報候補を再帰的に除外する。
- payload schema versionを保存する。
- rawデータの保持期間またはアーカイブ方針を文書化する。
- AIへ渡す項目は明示的なallowlistにする。
- 既存62件は勝手に削除・書き換えない。

### 9. n8nとApify設定の再現性

秘密情報を除去したn8n workflow JSONを、例えば次へ保存してください。

```text
automation/n8n/apify-social-import.workflow.json
```

併せて、次をREADMEまたは専用ドキュメントへ記載します。

- 使用Actor名とActor ID
- Instagram/TikTokごとの入力設定
- Dataset取得方法
- 実行スケジュール
- 09:10と09:31に分かれている理由
- retry回数とbackoff
- 最大取得件数
- Webhook payload変換
- 0件時、部分失敗時、HTTP 401/429/5xx時の動作
- n8n credential名だけを記載し、値は記載しない
- workflowのexport/import手順

`C:\n8n\compose.yaml` は次を改善してください。

- `n8nio/n8n` を検証済みバージョンへ固定する。
- ローカル専用なら `127.0.0.1:5678:5678` へ限定する。
- healthcheckを追加する。
- n8n_dataボリュームのバックアップ・復旧手順を追加する。
- 現在のworkflowをexportしてからcompose変更を行う。

### 10. SNS受信箱と運用画面

- 未確認件数を目立つ位置に表示する。
- platform、source、import run、期間、AI分類状態で絞り込む。
- 一括採用、一括保留、一括不要を維持・改善する。
- 古い未確認データを確認しやすくするが、自動削除はしない。
- 実行履歴画面または設定画面に、最終成功、最終失敗、保存数、重複数を表示する。
- 投稿詳細にActor/Dataset/run IDと分類providerを表示する。ただし秘密情報は表示しない。

## テスト要件

最低限、次の自動テストを追加してください。

- Instagram Actor形式の正規化
- TikTok Actor形式の正規化
- 配列直送と各wrapper形式
- 不正な `sourceName`、`aiLimit`、Boolean値
- URLなし、不正URL、platformとドメイン不一致
- 50件超過とtruncatedCount
- dryRun時にDBへ保存されないこと
- 無効なWebhook認証
- HMACを追加する場合は署名不一致、期限切れ、replay
- URL重複、external ID重複、同時実行時の競合
- 先頭が重複でもAI枠が後続へ使われること
- Gemini成功、モック、エラーフォールバック
- social_sourcesへの一致・不一致
- 実行履歴がsuccess、partial、failed、no_itemsになること
- legacy schema fallbackを残す場合、その動作とエラーの優先順位

テストで本番APIキーや実SNSデータを使わないでください。fixtureは架空データにします。

## Supabase変更手順

1. 実装時点のSupabase changelogと公式ドキュメントを確認する。
2. 現在のテーブル、インデックス、RLS、grantを読み取り専用で確認する。
3. 変更は追加型・後方互換を基本にする。
4. ローカルまたは検証環境でSQLを試す。
5. Supabase CLIが構成済みなら `supabase migration new <name>` でmigrationを作る。
6. CLI構成がない場合は、既存プロジェクト方式に合わせた追加SQLを作り、手動実行が必要なことをREADMEへ明記する。
7. advisorを利用できる場合は実行し、security/performance警告を確認する。
8. 実DB適用前にバックアップ・対象テーブル・ロールバック方法を提示して承認を得る。
9. 適用後に、件数、制約、RLS、grant、冪等性をテストクエリで確認する。

## 受入条件

- 既存65件が失われず、既存画面も動く。
- 既存Webhook形式とBearer認証が引き続き利用できる。
- 同一payloadを2回送っても投稿が増えず、2回目はduplicateとして実行履歴へ残る。
- 実行ごとにrun IDと件数内訳を確認できる。
- 一致する監視アカウントの投稿には `source_id` が入る。
- 50件超過、0件、入力エラー、AI失敗、DB部分失敗を区別できる。
- AI分類がGeminiかモックか保存後に分かる。
- n8n workflowを別環境へ秘密情報なしでimportできる。
- `npm.cmd run lint` が成功する。
- `npm.cmd run build` が成功する。
- 追加したテストが成功する。
- `git diff --check` が成功する。
- `.env.local`、n8n credential、Apify Token、Webhook秘密値がGit差分に含まれない。

## 作業の進め方

1. 最初に `git status --short --branch` と既存差分を確認する。
2. コード、Supabase、n8nの現状を読み取り専用で再確認する。
3. 実装計画と変更ファイル一覧を短く提示する。
4. DB/APIの基盤、source紐付け、AI状態保存、運用画面、テストの順で進める。
5. 各段階でlint・テストを実行し、最後にbuildとGit差分を確認する。
6. 本番変更が必要になった時点で停止し、対象、影響、バックアップ、復旧方法をユーザーへ提示する。

## 最終報告に含める内容

- 実装した内容
- 変更ファイル一覧
- DB変更内容と適用状況
- n8n/Apify設定ファイルの場所
- テスト、lint、build結果
- 未解決事項
- ユーザーが本番で行う操作
- 秘密情報がGitへ含まれていないことの確認
