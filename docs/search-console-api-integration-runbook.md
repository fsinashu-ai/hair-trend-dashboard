# Search Console API 取得状況と導入手順書

更新日: 2026-08-05

## 1. 結論

このプロジェクトでは、Google Search Console APIから検索実績を直接取得する機能は未実装です。現在動いているのは、Search Consoleから手動で書き出したCSVをアプリへ取り込み、Supabaseへ保存・分析する処理です。

本番Supabaseの保存状況もCSV由来で、直近の取り込みは次のとおりです。

| データ種別 | ファイル名 | 対象期間 | 行数 | 取り込み日時（UTC） |
| --- | --- | --- | ---: | --- |
| クエリ | `クエリ.csv` | 2026-07-01〜2026-07-04 | 483 | 2026-07-04 07:59 |
| ページ | `ページ.csv` | 2026-07-01〜2026-07-04 | 34 | 2026-07-04 07:58 |

2026-08-05時点では、2026-07-05以降のSearch Consoleデータは保存されていません。

## 2. 調査した範囲

| 確認項目 | 状態 | 根拠 |
| --- | --- | --- |
| Search Console取得APIルート | 未実装 | `src/app/api/seo/search-console`には`import/route.ts`と`analyze/route.ts`だけがあり、`fetch/route.ts`はない |
| 画面からの直接取得 | 未実装 | Search Console画面とREADMEに「API直接連携は未対応」と明記されている |
| CSV取り込み | 実装済み | `/seo/search-console/import`からCSVをプレビュー・保存できる |
| Supabase保存 | 実装済み | `seo_search_console_imports`と`seo_search_console_rows`へ保存している |
| Search Console専用環境変数 | 未設定 | ローカル`.env.local`に`SEARCH_CONSOLE_*`、`GSC_*`がない |
| サービスアカウント環境変数 | ローカル未設定 | ローカル`.env.local`に`GOOGLE_SERVICE_ACCOUNT_EMAIL`、`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`がない。本番環境の値は本調査では参照していない |
| Google認証の共通実装 | 一部再利用可能 | GA4 Data API用にサービスアカウントJWT認証が実装済み |
| Search ConsoleのCron | 未実装 | `vercel.json`にはトレンド生成とGA4取得の2件だけがある |
| 本番アクセス状況 | CSV機能のみ確認 | 直近30日のVercelログには画面、CSV取込、履歴、`/api/seo/search-console/import`だけがあり、API取得パスはない |
| API取得元の識別列 | 未実装 | 保存テーブルに`source`列がなく、現状はファイル名でしかCSV/APIを区別できない |

本番画面はBasic認証で保護されているため、外部フェッチでは画面内容を直接確認できませんでした。ただし、デプロイ元コード、Vercel実行ログ、本番Supabase保存データの3点が一致しており、Search Console API取得は動いていないと判断できます。

## 3. 推奨する導入方針

既存GA4連携と同じく、Next.jsのサーバー側だけでGoogleサービスアカウントを使います。ブラウザへ秘密鍵やアクセストークンは返しません。

導入は次の順序にします。

1. Google CloudでSearch Console APIを有効化する。
2. 既存GA4用サービスアカウントをSearch Consoleプロパティへ「フルユーザー」として追加する。
3. APIでアクセス可能なプロパティを確認する。
4. Next.jsに認証ヘルパー、取得処理、保護されたRoute Handlerを追加する。
5. 既存のCSV保存形式へ変換し、Supabaseへ保存する。
6. 手動取得を検証してから、既存GA4 Cronと統合して月次自動取得する。

Search Console API自体は無料ですが、利用上限があります。初期導入では、現在の月次分析画面に合わせて「前月のクエリ」と「前月のページ」を月1回ずつ取得する構成を推奨します。

## 4. Google側の準備

### 4.1 Search Consoleプロパティを確認する

Search Consoleで対象サイトを開き、プロパティ名を正確に確認します。

- ドメインプロパティの例: `sc-domain:ef-mayke-s.com`
- URLプレフィックスプロパティの例: `https://www.ef-mayke-s.com/`

`SEARCH_CONSOLE_SITE_URL`には、Search Consoleに表示される値と完全に一致する文字列が必要です。`www`の有無や末尾スラッシュを推測で決めないでください。このプロジェクトは`www`付き・なしのURLを両方扱っているため、利用可能ならドメインプロパティを優先します。

### 4.2 Google CloudでAPIを有効化する

1. GA4 Data APIで使用しているGoogle Cloudプロジェクトを開く。
2. 「APIとサービス」→「ライブラリ」を開く。
3. `Google Search Console API`を検索する。
4. 「有効にする」を押す。

別プロジェクトを新規作成する必要はありません。既存GA4用プロジェクトとサービスアカウントを再利用した方が、秘密情報と運用箇所を増やさずに済みます。

### 4.3 サービスアカウントへSearch Console権限を付与する

1. Google Cloudの「IAMと管理」→「サービス アカウント」で、GA4取得に使っているサービスアカウントのメールアドレスを確認する。
2. Search Consoleで対象プロパティを開く。
3. 「設定」→「ユーザーと権限」→「ユーザーを追加」を開く。
4. サービスアカウントのメールアドレスを入力する。
5. 権限は「フル」を選択して保存する。

Search Console APIの読み取りには`https://www.googleapis.com/auth/webmasters.readonly`スコープを使用します。プロパティ側にも読み取り権限がないと、OAuthトークンを取得できてもSearch Analyticsは403になります。

### 4.4 APIでプロパティを検証する

実装した認証ヘルパーで次を呼び出します。

```http
GET https://www.googleapis.com/webmasters/v3/sites
Authorization: Bearer <access-token>
```

レスポンスの`siteEntry[].siteUrl`に`SEARCH_CONSOLE_SITE_URL`と同じ値があることを確認します。ここで表示されない場合は、プロパティ名またはSearch Console側のユーザー権限が誤っています。

## 5. 環境変数

ローカル`.env.local`とVercelのProduction環境へ、次を設定します。

```dotenv
# Search Consoleに表示されるプロパティ名と完全一致させる
SEARCH_CONSOLE_SITE_URL=sc-domain:ef-mayke-s.com

# GA4と共用するサーバー専用認証情報
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@example-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# 既存値を再利用する
CRON_SECRET=replace-with-a-long-random-value
SUPABASE_SERVICE_ROLE_KEY=replace-with-current-server-only-key
```

既に本番VercelへGA4用サービスアカウントを登録済みなら、追加が必要なのは原則`SEARCH_CONSOLE_SITE_URL`だけです。本番の環境変数名を確認してから重複登録してください。

注意事項:

- 秘密鍵、アクセストークン、`SUPABASE_SERVICE_ROLE_KEY`に`NEXT_PUBLIC_`を付けない。
- 実値をREADME、ログ、Gitへ保存しない。
- 秘密鍵の改行は既存GA4実装と同じく`\n`形式を許容する。
- Vercelの環境変数変更後はProductionを再デプロイする。

## 6. 実装手順

### 6.1 Google認証を共通化する

新規ファイル:

- `src/lib/google/serviceAccount.server.ts`

既存`src/lib/ga4/dataApi.server.ts`内のJWT生成・トークン交換を、スコープを引数に取るサーバー専用関数へ切り出します。

```ts
getGoogleServiceAccountAccessToken({
  scope: "https://www.googleapis.com/auth/webmasters.readonly",
})
```

要件:

- `GOOGLE_SERVICE_ACCOUNT_JSON`がある場合はそれを優先する。
- なければ`GOOGLE_SERVICE_ACCOUNT_EMAIL`と`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`を使う。
- `node:crypto`でRS256署名し、`https://oauth2.googleapis.com/token`でアクセストークンへ交換する。
- トークン、秘密鍵、JWT本文をログへ出さない。
- Node.jsランタイムで実行する。

既存方式を再利用すれば、新しいnpm依存関係は不要です。`google-auth-library`を使う場合は、現在の推移依存へ頼らず`package.json`へ直接・固定バージョンで追加してください。

### 6.2 Search Console取得ライブラリを追加する

新規ファイル:

- `src/lib/searchConsole/dataApi.server.ts`

必要な公開関数:

```ts
listAccessibleSearchConsoleSites(): Promise<SiteEntry[]>

fetchSearchConsoleApiPreview(input: {
  startDate: string;
  endDate: string;
  dimension: "query" | "page";
  searchType?: "web";
}): Promise<SearchConsoleCsvPreview>
```

Search Analyticsの呼び出し:

```http
POST https://www.googleapis.com/webmasters/v3/sites/{encodedSiteUrl}/searchAnalytics/query
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "startDate": "2026-07-01",
  "endDate": "2026-07-31",
  "dimensions": ["query"],
  "type": "web",
  "dataState": "final",
  "rowLimit": 25000,
  "startRow": 0
}
```

ページ取得時は`dimensions`を`["page"]`にします。現行DBは1取り込みにつき1種類の`row_type`を持つため、クエリとページは別々の取り込みとして保存します。

ページング:

1. `rowLimit`は25,000にする。
2. 取得行がある間、`startRow`を25,000ずつ増やす。
3. 0行が返った時点で終了する。
4. 同一リクエストを無制限に再試行しない。
5. 429または一時的な5xxだけ、待機時間を増やしながら最大2回再試行する。

レスポンスの変換:

| APIレスポンス | `SearchConsoleRow` |
| --- | --- |
| `keys[0]`（query） | `query` |
| `keys[0]`（page） | `pageUrl` |
| `clicks` | `clicks` |
| `impressions` | `impressions` |
| `ctr` | `ctr`。0〜1の小数のまま保存 |
| `position` | `position` |
| 取得ディメンション | `rowType` |

`SearchConsoleCsvPreview`へ変換し、既存`saveSearchConsoleImport()`を再利用します。`contentHash`は少なくとも、取得元、プロパティ、検索タイプ、期間、ディメンション、正規化済み行を含めてSHA-256で作ります。

ファイル名は実ファイルではなく、取得元を判別できる仮想名にします。

```text
search-console-api-query-2026-07-01_2026-07-31.json
search-console-api-page-2026-07-01_2026-07-31.json
```

### 6.3 取得元をDBへ記録する

推奨変更:

```sql
alter table public.seo_search_console_imports
  add column if not exists source text not null default 'csv',
  add column if not exists source_property text,
  add column if not exists search_type text not null default 'web';

alter table public.seo_search_console_imports
  drop constraint if exists seo_search_console_imports_source_check;

alter table public.seo_search_console_imports
  add constraint seo_search_console_imports_source_check
  check (source in ('csv', 'search_console_api'));
```

既存行は`default 'csv'`で保護されます。API保存時だけ`source='search_console_api'`と`source_property`を記録します。

この変更は既存テーブルへの列追加なので、新規テーブル公開設定は不要です。将来、新しいテーブルを作る場合は、Supabaseの2026年の変更によりData API用の明示的な`GRANT`が必要になる可能性があります。ブラウザから直接書き込ませず、引き続きサーバー側のservice role経由に限定します。

### 6.4 保護されたAPIルートを追加する

新規ファイル:

- `src/app/api/seo/search-console/fetch/route.ts`

要件:

- `export const runtime = "nodejs"`
- `export const maxDuration = 60`
- `GET`: Vercel Cron専用。`Authorization: Bearer ${CRON_SECRET}`が一致しない場合は401。
- `POST`: 既存のアプリ認証、または`CRON_SECRET`で保護した手動実行。
- POST本文の`startDate`、`endDate`を厳密に検証する。
- 省略時は前月1日〜末日を使う。
- `query`と`page`を取得後、それぞれSupabaseへ保存する。
- 重複時は既存取り込みIDを返し、同じ行を増やさない。
- レスポンスにアクセストークン、秘密鍵、Googleの生エラー本文を含めない。

成功レスポンス例:

```json
{
  "ok": true,
  "siteUrl": "sc-domain:ef-mayke-s.com",
  "periodStart": "2026-07-01",
  "periodEnd": "2026-07-31",
  "results": [
    { "type": "query", "rowCount": 483, "duplicate": false },
    { "type": "page", "rowCount": 34, "duplicate": false }
  ]
}
```

エラー分類:

| 状態 | アプリ側メッセージ | 主な確認先 |
| --- | --- | --- |
| 400 | 期間または設定値が不正 | 日付形式、開始・終了日、`SEARCH_CONSOLE_SITE_URL` |
| 401 | Google認証またはアプリ認証に失敗 | サービスアカウント秘密鍵、`CRON_SECRET` |
| 403 | プロパティの閲覧権限がない | Search Consoleのユーザーと権限、API有効化 |
| 404 | 指定プロパティが見つからない | `sc-domain:`、`www`、末尾スラッシュ |
| 409 | 同じ期間・種別を保存済み | 正常な重複防止として扱う |
| 429 | Google API利用上限 | 再取得を止め、15分以上空ける |
| 500/502 | GoogleまたはSupabase処理失敗 | Vercelログ。秘密情報は記録しない |

### 6.5 画面を更新する

主な変更先:

- `src/components/seo/search-console/SearchConsoleImportManager.tsx`
- `src/components/marketing/MarketingSectionNav.tsx`
- `src/app/settings/page.tsx`
- `src/components/seo/SeoDashboard.tsx`
- `src/components/seo/search-console/SearchConsoleDashboard.tsx`

最低限追加する表示:

- 「Search Console APIから前月を取得」ボタン
- 取得対象期間
- 接続状態（未設定、権限不足、接続済み）
- 取得元（CSV / Search Console API）
- 最終取得日時と対象期間
- API取得失敗時の安全な日本語メッセージ

CSV取り込みは削除せず、障害時の手動代替として残します。

### 6.6 Cronを追加せず、既存GA4 Cronへ統合する

現在の`vercel.json`には次の2件があります。

```json
{
  "crons": [
    { "path": "/api/trends/auto-generate", "schedule": "0 22 * * *" },
    { "path": "/api/seo/ga4/fetch", "schedule": "0 0 2 * *" }
  ]
}
```

Search Console用の3件目をそのまま追加すると、VercelプランのCron上限に触れる可能性があります。SEO月次取得を1ルートへ統合します。

新規ファイル:

- `src/app/api/seo/monthly-fetch/route.ts`
- `src/lib/seo/monthlyFetch.server.ts`

`monthlyFetch.server.ts`からGA4とSearch Consoleの共有取得関数を直接呼び出します。HTTPで自分自身のAPIを呼ばないでください。

推奨`vercel.json`:

```json
{
  "crons": [
    { "path": "/api/trends/auto-generate", "schedule": "0 22 * * *" },
    { "path": "/api/seo/monthly-fetch", "schedule": "0 0 5 * *" }
  ]
}
```

`0 0 5 * *`は毎月5日00:00 UTC（日本時間9:00）です。Search Consoleの確定データは通常2〜3日遅れるため、毎月2日より5日の方が前月分を安定して取得できます。

Vercel CronはProductionデプロイだけで動きます。ルート側で必ず`CRON_SECRET`を検証します。

## 7. 無料・低負荷での運用

Search Console APIは無料です。ただし、同じ長期間を繰り返し取得すると負荷クォータを消費します。

初期運用:

- 毎月5日に前月分を1回取得する。
- `web`だけを対象にする。
- `query`と`page`を別々に各1回取得する。
- `dataState: "final"`だけを保存する。
- 同一期間・種別の重複保存を拒否する。
- 手動再取得は失敗時に限定する。
- 429では連続再試行せず、15分以上空ける。

Googleは網羅性を優先する場合、2〜3日前の1日分を毎日取得する方式を推奨しています。ただし、現行アプリは月単位の取り込みを前提としているため、日次化は日次行を月次集計するDB設計を追加してから行います。

公式上限の要点:

- 1レスポンスの`rowLimit`は最大25,000。
- `startRow`でページングする。
- Search Analyticsが公開するデータは検索タイプごとに1日最大50,000行。
- ページ・クエリを含む長期間の取得は負荷が高い。
- 同じデータ範囲を繰り返し再取得しない。

## 8. テスト手順

### 8.1 ローカル設定確認

値は表示せず、環境変数名だけを確認します。

```powershell
Get-Content .env.local |
  Where-Object { $_ -match '^(SEARCH_CONSOLE_SITE_URL|GOOGLE_SERVICE_ACCOUNT_EMAIL|GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY|CRON_SECRET)=' } |
  ForEach-Object { ($_ -split '=', 2)[0] }
```

期待値は4項目です。

### 8.2 接続確認

1. `sites.list`で対象プロパティが返る。
2. 直近7日を`dimensions: ["date"]`で取得できる。
3. ログにアクセストークンや秘密鍵がない。

### 8.3 手動取得確認

1. 前月の`query`を取得する。
2. 前月の`page`を取得する。
3. `seo_search_console_imports.source`が`search_console_api`になっている。
4. `seo_search_console_rows`の行数が取り込み情報と一致する。
5. CTRがパーセント値ではなく0〜1の小数で保存されている。
6. `/seo/search-console`で取得データを表示できる。
7. 同じ期間を再取得し、重複行が増えない。

### 8.4 回帰確認

```powershell
npm.cmd run lint
npm.cmd run build
```

追加する自動テスト:

- サービスアカウント設定不足
- 日付範囲の検証
- query/pageの`keys`マッピング
- 25,000行ページング
- 403、404、429の安全なエラー変換
- 重複取り込み
- Cronの`CRON_SECRET`不一致
- 既存CSV取り込みが引き続き成功すること

## 9. 本番反映手順

1. Google CloudでSearch Console APIを有効化する。
2. サービスアカウントをSearch Consoleプロパティのフルユーザーへ追加する。
3. `sites.list`で正確なプロパティ名を確認する。
4. Vercel Productionに`SEARCH_CONSOLE_SITE_URL`を追加する。
5. 必要な場合だけサービスアカウント環境変数を追加・更新する。
6. DBの`source`列追加SQLを適用する。
7. アプリ変更をProductionへデプロイする。
8. 手動で前月分を取得する。
9. Supabase、画面、Vercelログを確認する。
10. 既存GA4 Cronを月次統合ルートへ切り替える。
11. 翌月5日のCron結果を確認する。

Cron切り替えは手動取得が成功した後に行います。認証やプロパティ名が誤った状態で自動実行を先に有効化しないでください。

## 10. ロールバック

問題が起きた場合は、次の順で戻します。

1. `vercel.json`の月次Cronを既存`/api/seo/ga4/fetch`へ戻す。
2. API取得ボタンを非表示にし、CSV取り込みを継続する。
3. `source='search_console_api'`の取り込みは削除せず、画面で非選択にする。
4. 原因を確認してから再取得する。

DB列追加は既存CSV行を壊さないため、緊急時に列を削除する必要はありません。データ削除が必要になった場合は、対象取り込みIDと復旧方法を確認してから実施します。

## 11. 完了条件

- `sites.list`で対象プロパティと権限を確認できる。
- アプリから前月のquery/pageを取得できる。
- API取得元、プロパティ、期間、行数をSupabaseに記録できる。
- 同一データの二重保存がない。
- CSV取り込みが引き続き使える。
- 秘密情報がブラウザ、ログ、Gitへ出ない。
- `npm.cmd run lint`と`npm.cmd run build`が成功する。
- Productionで手動取得が成功した後、月次Cronが成功する。

## 12. 公式資料

- [Search Analytics: query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)
- [Search Console APIの認可](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing)
- [Search Console Sites: list](https://developers.google.com/webmaster-tools/v1/sites/list)
- [パフォーマンスデータの取得方法](https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data)
- [Search Console APIの利用上限](https://developers.google.com/webmaster-tools/limits)
- [Search Consoleのユーザーと権限](https://support.google.com/webmasters/answer/7687615)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Vercel Cronの保護](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Supabase Data APIの公開設定変更](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
