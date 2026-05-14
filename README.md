# hair-trend-dashboard

美容師向けの「ヘアスタイル・美容業界トレンド収集アプリ」です。

個人利用、またはサロン内の少人数利用を想定しています。手動で登録したトレンドURL、キーワード、メモ、AI生成結果を整理し、毎日の投稿ネタ作りや接客提案に使えます。

SNSスクレイピングは行いません。外部情報は、手動登録、公式API、RSS、利用許可のある公開情報だけを扱う方針です。

## このアプリでできること

- ホーム: 今日のおすすめ、最近見た記事、お気に入り、ワンクリックAI生成を確認できます。
- トレンド一覧: URL、タイトル、カテゴリ、メモを登録し、検索・絞り込み・並び替えができます。
- 取得元管理: RSS、公式サイト、自社サイト、メーカー、美容ディーラー、美容メディアを登録できます。
- キーワード管理: キーワード、カテゴリ、優先度、メモを登録できます。
- SNS投稿登録: Instagram、YouTube、Pinterest、TikTok、X、Otherの投稿URLを手動登録し、AIで美容師向けに分類できます。
- 投稿ネタ生成: Instagram投稿文、リール台本、カウンセリング説明、次回来店提案、店販提案、ブログ記事、朝礼ネタ、トレンド解説を生成できます。
- 画像分析: ヘア画像をSupabase Storageへ保存し、AIでスタイル特徴を分析できます。
- データバックアップ: JSON/CSVエクスポート、JSONインポート、バックアップ復元ができます。
- 設定: Supabase、AI API、アプリ保護、スクレイピング禁止方針を確認できます。

## 技術構成

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- OpenAI API
- Gemini API
- Vercel

## まず動かす

### 1. 必要なもの

- Node.js
- npm
- Windowsの場合はPowerShell、またはコマンドプロンプト

SupabaseやAI APIキーがなくても、最初はダミーデータとモックレスポンスで動きます。

### 2. 一番簡単な起動方法

Windowsの場合は、プロジェクトフォルダにある `START_HERE.cmd` をダブルクリックしてください。

コマンドで実行する場合:

```bash
.\START_HERE.cmd
```

終了するときは、起動した黒い画面で `Ctrl + C` を押してください。

### 3. 手動で起動する方法

```bash
cd hair-trend-dashboard
npm install
copy .env.local.example .env.local
npm run dev
```

ブラウザで以下を開きます。

```txt
http://localhost:3000
```

PowerShellで `npm` がうまく動かない場合は、`.cmd` を付けます。

```bash
npm.cmd install
npm.cmd run dev
```

## よく使うコマンド

```bash
npm run dev
npm run lint
npm run build
```

PowerShellで止まる場合:

```bash
npm.cmd run lint
npm.cmd run build
```

## 環境変数一覧

環境変数は `.env.local` に書きます。

`.env.local` は秘密情報を含むため、GitHubへ上げないでください。このプロジェクトでは `.gitignore` で除外済みです。

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
AI_PROVIDER=mock
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini
OPENAI_VISION_MODEL=gpt-5.4-mini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
CRON_SECRET=
APP_USER=salon
APP_PASSWORD=
```

| 変数名 | 必須 | 用途 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 任意 | SupabaseのプロジェクトURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 任意 | Supabaseのanon key |
| `AI_PROVIDER` | 任意 | `openai`、`gemini`、`mock` |
| `OPENAI_API_KEY` | 任意 | OpenAI APIキー |
| `OPENAI_MODEL` | 任意 | 投稿生成で使うOpenAIモデル名 |
| `OPENAI_VISION_MODEL` | 任意 | 画像分析で使うOpenAIモデル名 |
| `GEMINI_API_KEY` | 任意 | Gemini APIキー |
| `GEMINI_MODEL` | 任意 | Geminiで使うモデル名 |
| `CRON_SECRET` | Vercel Cron利用時は必須 | 毎朝の自動生成APIを保護する秘密文字列 |
| `APP_USER` | 任意 | アプリ全体のパスワード保護ユーザー名 |
| `APP_PASSWORD` | 公開時は推奨 | アプリ全体のパスワード保護パスワード |

`OPENAI_API_KEY`、`GEMINI_API_KEY`、`APP_PASSWORD` は秘密情報です。GitHubへpushしないでください。

## Supabase設定

Supabaseを設定すると、トレンド、キーワード、AI生成結果、画像、SNS投稿メモを保存できます。

1. Supabaseで新しいプロジェクトを作成します。
2. Supabase管理画面の `SQL Editor` を開きます。
3. [supabase/schema.sql](</supabase/schema.sql>) のSQLを貼り付けて実行します。
4. `Project Settings > API` でURLとanon keyを確認します。
5. `.env.local` に以下を設定します。

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

作成されるテーブル:

- `keywords`
- `trend_links`
- `trend_sources`
- `sns_posts`
- `ai_outputs`

画像アップロード用に、Supabase Storageの `hair-images` バケットも作成します。

すでに古いSQLを実行済みの場合も、最新の [supabase/schema.sql](</supabase/schema.sql>) をもう一度実行してください。`sns_posts` テーブル、RLSポリシー、Storage設定が追加されます。

## AI API設定

OpenAI APIキーまたはGemini APIキーを設定すると、投稿ネタ生成、画像分析、トレンド分類、SNS投稿分類が実際のAI生成になります。

Gemini APIを使う場合:

```bash
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
```

OpenAI APIを使う場合:

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

APIキーが未設定、または生成に失敗した場合は、画面上ではモックレスポンスを表示します。

## アプリ全体のパスワード保護

個人利用やサロン内利用でVercelへ公開する場合は、`APP_PASSWORD` を設定してください。

```bash
APP_USER=salon
APP_PASSWORD=your-private-app-password
```

`APP_PASSWORD` を設定すると、全画面、API Route、Next.jsの静的ファイルがBasic認証で保護されます。

## 使い方

### 毎日の使い方

1. ホームを開きます。
2. 今日のおすすめトレンドを確認します。
3. よく使うキーワードから気になるテーマを開きます。
4. 投稿ネタ生成で、Instagram投稿文や接客説明の下書きを作ります。
5. 必要に応じてトレンド一覧にURLやメモを追加します。

### トレンドを登録する

1. `トレンド一覧` を開きます。
2. URL、タイトル、カテゴリ、メモを入力します。
3. `登録する` を押します。
4. 検索、カテゴリフィルター、並び替えで整理します。

### トレンド候補を自動生成する

1. `トレンド一覧` を開きます。
2. `トレンド自動生成` の `自動生成する` を押します。
3. アプリが登録済みURL、キーワード、RSS記事、取得元管理の有効なURLを確認します。
4. AIが美容師向けにカテゴリ、メモ、タグを作ります。
5. 既存URLと重複しない候補だけ `trend_links` に保存します。

### RSS・情報取得元を管理する

1. `取得元管理` を開きます。
2. 取得元タイトル、URL、種別、有効/無効、メモを入力します。
3. `追加する` を押します。
4. `取得テスト` でRSSが取得できるか確認できます。

RSS以外の種別は、HTMLスクレイピングをせず、手動登録URLとしてAI分類の参考にします。

### SNS投稿を登録する

1. `SNS投稿登録` を開きます。
2. Instagram、YouTube、Pinterest、TikTok、Xなどの投稿URLを貼ります。
3. URLからSNS種別が自動判定されます。
4. タイトル、メモ、カテゴリ、タグを入力します。
5. `AIで分類する` を押すと、美容トレンド名、カテゴリ、メモ、タグ、Instagram投稿ネタ、カウンセリング活用例が生成されます。
6. `SNS投稿を保存` を押して保存します。
7. 必要に応じて、保存済みカードの `トレンド化` を押すと `trend_links` に候補として追加できます。

SNS利用時の注意:

- Instagram、TikTok、Xの非公式スクレイピングは行いません。
- URL先の本文や画像を自動取得せず、手動で確認したURL、タイトル、メモだけを扱います。
- YouTubeは将来、公式YouTube Data APIで連携できる設計にしています。
- Instagram、Pinterestも将来、公式API連携に切り替えられるようにSNS種別を分けています。
- 公開許可のない投稿や個人情報を含む投稿は登録しないでください。

### 毎朝7時に自動生成する

Vercel Cron Jobsを使うと、毎朝自動で `/api/trends/auto-generate` を実行できます。

このプロジェクトには [vercel.json](</vercel.json>) を追加済みです。

```json
{
  "crons": [
    {
      "path": "/api/trends/auto-generate",
      "schedule": "0 22 * * *"
    }
  ]
}
```

Vercel CronはUTC時間で指定します。日本時間の朝7時は、UTCの前日22時なので `0 22 * * *` です。

Vercelの `Project Settings > Environment Variables` に以下を設定してください。

```bash
CRON_SECRET=自分だけが知っている長いランダム文字列
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
APP_USER=salon
APP_PASSWORD=your-private-app-password
```

## GitHubへpushする手順

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/your-name/hair-trend-dashboard.git
git push -u origin main
```

`.env.local` はGitHubへ上げないでください。

## Vercel公開方法

1. [Vercel](https://vercel.com/) でアカウントを作成します。
2. GitHubと連携します。
3. `New Project` から `hair-trend-dashboard` をImportします。
4. Framework Presetが `Next.js` になっていることを確認します。
5. 環境変数を設定します。
6. `Deploy` を押します。
7. Deploymentsが `Ready` になったらURLを開いて確認します。

環境変数を変更した場合、変更後に再デプロイしてください。

## 公開前チェック

```bash
npm run lint
npm run build
```

PowerShellで止まる場合:

```bash
npm.cmd run lint
npm.cmd run build
```

画面では以下も確認してください。

- Supabase未設定時にダミーデータで表示される
- AI APIキー未設定時にモックレスポンスが表示される
- エラー時にユーザー向けメッセージが表示される
- 保存中、削除中、生成中にローディング表示が出る
- 検索結果0件のときに空データ表示が出る
- スマホ表示で文字やボタンがはみ出さない
- Vercel公開時は `APP_PASSWORD` が有効になっている

## セキュリティと注意点

- SNSスクレイピングは禁止です。
- Instagram、TikTok、Xなどの投稿を自動取得、無断保存する機能はありません。
- SNS投稿登録は、手動で確認したURL、タイトル、メモだけを保存します。
- YouTube、Instagram、Pinterestなどを自動連携する場合は、各サービスの公式APIだけを使ってください。
- 外部サイトの情報は、手動登録、公式API、RSS、利用許可のある公開情報だけを扱います。
- `.env.local` はGitHubへ上げないでください。
- `OPENAI_API_KEY` と `GEMINI_API_KEY` はサーバー側のAPI Routeだけで使います。
- `APP_PASSWORD` を設定すると、画面、API Route、静的JS/CSSがBasic認証で保護されます。
- 現在のSupabase RLSは個人利用・サロン内利用向けです。
- 複数サロンや外部ユーザー向けに公開する場合は、ログイン機能とユーザー単位RLSを追加してください。
- ヘア画像分析は補助機能です。お客様への提案は必ずカウンセリングと美容師の判断を優先してください。

## 主なフォルダ

```txt
src/
  app/                 画面とAPI Route
  components/          画面部品
  config/              RSS/SNS/外部参照先の設定
  data/                ダミーデータ
  lib/                 AI、RSS、Supabase、バックアップ処理
  types/               TypeScriptの型

supabase/
  schema.sql           Supabase用SQL
```

## 今後追加できる機能

- ログイン機能
- サロン別、スタッフ別のデータ管理
- ユーザー単位のSupabase RLS
- YouTube Data API連携
- Instagram Graph API連携
- Pinterest公式API連携
- トレンドとキーワードの編集機能
- AI生成結果の保存履歴
- 投稿案のコピー、保存、再生成
- 画像一覧と削除機能
- E2Eテスト、ユニットテスト

## 最後に

このアプリは、個人利用・サロン内利用で毎日使いやすい形を目指しています。

まずはダミーデータで触り、必要に応じてSupabase、Gemini APIまたはOpenAI API、Vercel公開を追加してください。
