# hair-trend-dashboard

美容師向けのヘアスタイル・美容業界トレンド収集アプリです。

個人利用、またはサロン内の少人数利用を想定しています。手動登録URL、RSS、公式API、AI生成を使って、毎日の投稿ネタ作りや接客提案に使える情報を整理します。

SNSスクレイピングは禁止です。外部情報は、手動登録、公式API、RSS、利用許可のある公開情報だけを扱います。

## 主な機能

- ホーム: 今日のおすすめ、最近見た記事、お気に入り、AIワンクリック生成
- トレンド一覧: URL登録、検索、カテゴリフィルター、並び替え、削除
- トレンド自動生成: RSS/登録済みURLからAIで候補生成
- YouTube周回: 公式YouTube Data APIで登録キーワードに合う新着動画を検索
- 取得元管理: RSS、公式サイト、自社サイト、メーカー、美容ディーラー、美容メディアを管理
- キーワード管理: キーワード、カテゴリ、優先度、メモを管理
- SNS投稿登録: SNS投稿URLを手動登録し、AIで美容師向けに分類
- 投稿ネタ生成: Instagram投稿文、リール台本、カウンセリング説明、ブログ記事などを生成
- 画像分析: ヘア画像を保存し、AIでスタイル特徴を分析
- バックアップ: JSON/CSVエクスポート、JSONインポート
- 設定: Supabase、AI API、YouTube API、アプリ保護の確認

## 技術構成

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- OpenAI API
- Gemini API
- YouTube Data API
- Vercel

## ローカルで起動する

Windowsの場合は、プロジェクトフォルダにある `START_HERE.cmd` をダブルクリックしてください。

手動で起動する場合:

```bash
cd hair-trend-dashboard
npm install
copy .env.local.example .env.local
npm run dev
```

PowerShellで `npm` が止まる場合:

```bash
npm.cmd install
npm.cmd run dev
```

ブラウザで開くURL:

```txt
http://localhost:3000
```

## よく使うコマンド

```bash
npm run dev
npm run lint
npm run build
```

PowerShellでは以下でもOKです。

```bash
npm.cmd run lint
npm.cmd run build
```

## 環境変数

環境変数は `.env.local` に書きます。`.env.local` はGitHubへ上げないでください。

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
AI_PROVIDER=mock
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini
OPENAI_VISION_MODEL=gpt-5.4-mini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
YOUTUBE_API_KEY=
YOUTUBE_DAILY_VIDEO_LIMIT=6
YOUTUBE_KEYWORD_LIMIT=4
CRON_SECRET=
APP_USER=salon
APP_PASSWORD=
```

| 変数名 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | SupabaseのプロジェクトURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabaseのanon key |
| `AI_PROVIDER` | `openai`、`gemini`、`mock` |
| `OPENAI_API_KEY` | OpenAI APIキー。サーバー側だけで使用 |
| `GEMINI_API_KEY` | Gemini APIキー。サーバー側だけで使用 |
| `YOUTUBE_API_KEY` | YouTube Data APIキー。サーバー側だけで使用 |
| `YOUTUBE_DAILY_VIDEO_LIMIT` | YouTube周回で1日に保存する動画候補数。未設定時は6件 |
| `YOUTUBE_KEYWORD_LIMIT` | YouTube周回で1回に検索するキーワード数。未設定時は4個 |
| `CRON_SECRET` | Vercel Cron用の秘密文字列 |
| `APP_USER` | アプリ保護ユーザー名 |
| `APP_PASSWORD` | アプリ保護パスワード |

`OPENAI_API_KEY`、`GEMINI_API_KEY`、`YOUTUBE_API_KEY`、`APP_PASSWORD` は秘密情報です。GitHubへpushしないでください。

## Supabase設定

1. Supabaseでプロジェクトを作成します。
2. Supabase管理画面の `SQL Editor` を開きます。
3. [supabase/schema.sql](</supabase/schema.sql>) のSQLを貼り付けて実行します。
4. `Project Settings > API` でURLとanon keyを確認します。
5. `.env.local` またはVercel環境変数へ設定します。

作成される主なテーブル:

- `keywords`
- `trend_links`
- `trend_sources`
- `sns_posts`
- `ai_outputs`

## AI API設定

Geminiを使う場合:

```bash
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
```

OpenAIを使う場合:

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-5.4-mini
OPENAI_VISION_MODEL=gpt-5.4-mini
```

AIを使わずモックで動かす場合:

```bash
AI_PROVIDER=mock
```

## YouTube周回の使い方

目的: 登録キーワードをもとに、美容師向けのYouTube動画を検索し、トレンド一覧へ保存します。

1. `トレンド一覧` を開きます。
2. `YouTube周回` の検索期間を `過去7日` または `過去30日` から選びます。
3. `YouTube周回` ボタンを押します。
4. 公式YouTube Data APIで動画を検索します。
5. AIが美容師向けにカテゴリ、メモ、タグを作ります。
6. 重複URLを除外して `trend_links` に保存します。

初期検索キーワード:

- 髪質改善
- 縮毛矯正
- 白髪ぼかし
- 大人ショート
- 韓国ヘア
- ボブ
- レイヤー
- 美容師 集客
- 美容室 Instagram

設定ファイル:

- [youtubeTrendKeywords.ts](</src/config/youtubeTrendKeywords.ts>)

安全方針:

- YouTube公式APIだけを使います。
- 動画本文、コメント、SNS本文のスクレイピングはしません。
- `YOUTUBE_API_KEY` はAPI Route内だけで使い、フロントには出しません。
- 1日の保存数は `YOUTUBE_DAILY_VIDEO_LIMIT` で制限します。
- 1回の検索キーワード数は `YOUTUBE_KEYWORD_LIMIT` で制限します。
- 重複URLは保存しません。

## YouTube APIキー取得方法

1. Google Cloud Consoleを開きます。
2. 新しいプロジェクトを作成、または既存プロジェクトを選びます。
3. `APIとサービス > ライブラリ` を開きます。
4. `YouTube Data API v3` を検索して有効化します。
5. `APIとサービス > 認証情報` を開きます。
6. `認証情報を作成 > APIキー` を選びます。
7. 作成されたAPIキーを `.env.local` に設定します。

```bash
YOUTUBE_API_KEY=your-youtube-api-key
YOUTUBE_DAILY_VIDEO_LIMIT=6
YOUTUBE_KEYWORD_LIMIT=4
```

Vercelで使う場合は、Vercelの `Project Settings > Environment Variables` に同じ値を設定し、再デプロイしてください。

## Vercel公開方法

1. Vercelアカウントを作成します。
2. GitHubと連携します。
3. `New Project` から `hair-trend-dashboard` をImportします。
4. 環境変数を設定します。
5. `Deploy` を押します。
6. Deploymentsが `Ready` になったら公開URLを確認します。

Vercelに設定する主な環境変数:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
YOUTUBE_API_KEY=your-youtube-api-key
YOUTUBE_DAILY_VIDEO_LIMIT=6
YOUTUBE_KEYWORD_LIMIT=4
CRON_SECRET=your-random-cron-secret
APP_USER=salon
APP_PASSWORD=your-private-app-password
```

公開URLで使う場合、`APP_PASSWORD` は必ず設定してください。

## セキュリティ注意点

- SNSスクレイピングは禁止です。
- Instagram、TikTok、Xなどの投稿本文を自動取得しません。
- YouTube周回は公式YouTube Data APIだけを使います。
- `.env.local` はGitHubへ上げないでください。
- `public` フォルダに `.env.local` やAPIキーを置かないでください。
- APIキーはサーバー側のAPI Routeだけで使います。
- 個人利用・サロン内利用で公開する場合は `APP_PASSWORD` を設定してください。

## 主なフォルダ

```txt
src/
  app/          画面とAPI Route
  components/   画面部品
  config/       RSS/SNS/YouTubeなどの設定
  data/         ダミーデータ
  lib/          AI、RSS、YouTube、Supabase処理
  types/        TypeScriptの型
supabase/
  schema.sql    Supabase用SQL
```

## 公開前チェック

```bash
npm run lint
npm run build
```

PowerShellの場合:

```bash
npm.cmd run lint
npm.cmd run build
```
