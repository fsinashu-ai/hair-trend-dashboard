# hair-trend-dashboard

美容師向けの「ヘアスタイル・美容業界トレンド収集アプリ」です。

個人利用、またはサロン内の少人数利用を想定しています。手動で登録したトレンドURL、キーワード、メモ、AI生成結果を整理し、毎日の投稿ネタ作りや接客提案に使えます。

SNSスクレイピングは行いません。外部情報は、手動登録、公式API、RSS、利用許可のある公開情報だけを扱う方針です。

## このアプリでできること

- ホーム
  - 今日のおすすめトレンドを確認
  - 最近見たトレンドを確認
  - よく使うキーワードへすぐ移動
  - AIワンクリック生成を実行

- トレンド一覧
  - URL、タイトル、カテゴリ、メモを登録
  - RSS/登録済みURLをもとにトレンド候補を自動生成
  - YouTube公式APIで登録キーワードに合う新着動画を検索
  - キーワード検索
  - カテゴリフィルター
  - 投稿日順、人気順の並び替え
  - 一覧表示、削除

- 取得元管理
  - RSS、公式サイト、自社サイト、メーカー、美容ディーラー、美容メディアを登録
  - 有効/無効を切り替え
  - メモ、最終取得日時を確認
  - RSS取得テストを実行

- キーワード管理
  - キーワード、カテゴリ、優先度、メモを登録
  - 検索とカテゴリフィルター
  - 一覧表示、削除

- SNS情報取得
  - Instagram、YouTube、Pinterest、TikTok、X、Otherの公開投稿URLを登録
  - URLからSNS種別を自動判定
  - サーバー側でtitle、description、OGP、canonical URL、公開日候補を確認
  - robots.txt、タイムアウト、応答サイズ、ドメイン間隔を確認
  - AIでトレンド名、カテゴリ、要約、タグ、関連度を分類
  - Instagram投稿案、ブログ記事案、カウンセリング活用例を生成
  - canonical URLとタイトル類似度で重複候補を確認
  - SNS取得元の取得方式、有効/無効、優先度、最終確認、警告を管理
  - 取り込み済み情報からトレンド化、ブログ化、投稿案作成

- ブログ管理
  - SEOブログ記事の下書きを作成、保存、編集
  - タイトル検索、カテゴリ絞り込み、ステータス絞り込み
  - AIでSEOタイトル、構成、本文、メタディスクリプションを生成
  - Instagram投稿文、Before/After画像用キャプション、LINE予約CTAを生成
  - WordPress貼り付け用HTMLプレビューを表示
  - トレンド、SNS投稿、YouTube取得データからブログ化

- 投稿ネタ生成
  - Instagram投稿文案
  - リール動画台本
  - カウンセリング説明
  - 次回来店提案
  - 店販提案
  - ブログ記事
  - 朝礼ネタ
  - トレンド解説
  - 20代、30代、40代、50代の切り替え
  - 女性、男性の切り替え
  - 上品、カジュアルの文体切り替え
  - 短め、標準、長めの文字数切り替え
  - ハッシュタグ自動生成
  - OpenAI API、Gemini API、モックレスポンスを切り替え

- 画像分析
  - ヘア画像アップロード
  - Supabase Storageへ保存
  - AI APIでヘアスタイル特徴を分析
  - 推定カテゴリ、SNS投稿向け説明、メニュー提案を表示
  - SupabaseまたはAI API未設定時はモック分析で動作

- データバックアップ
  - JSONエクスポート
  - CSVエクスポート
  - JSONインポート
  - 追加復元、上書き復元

- 設定
  - Supabase、AI API、アプリ保護の設定状況を確認
  - SNSスクレイピング禁止方針を確認

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

先に以下を用意してください。

- Node.js
- npm
- Windowsの場合はPowerShell、またはコマンドプロンプト

SupabaseやAI APIキーがなくても、最初はダミーデータとモックレスポンスで動きます。

### 2. 一番簡単な起動方法

Windowsの場合は、プロジェクトフォルダにある `START_HERE.cmd` をダブルクリックしてください。

`START_HERE.cmd` は、実際には `start-app.cmd` を呼び出すだけの分かりやすい入口です。

このファイルが行うこと:

- 依存パッケージがなければ `npm install` を実行
- `.env.local` がなければ `.env.local.example` から作成
- ブラウザで `http://localhost:3000` を開く
- 開発サーバーを起動
- すでに起動中の場合は、新しく起動せずブラウザだけ開く

コマンドで実行する場合:

```bash
.\START_HERE.cmd
```

終了するときは、起動した黒い画面で `Ctrl + C` を押してください。

起動方法だけを短く確認したい場合は、[HOW_TO_START.txt](</HOW_TO_START.txt>) も見てください。

### 3. 手動で起動する方法

プロジェクトフォルダへ移動します。

```bash
cd hair-trend-dashboard
```

依存パッケージをインストールします。

```bash
npm install
```

`.env.local` を作ります。

```bash
copy .env.local.example .env.local
```

開発サーバーを起動します。

```bash
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

見本は [.env.local.example](</.env.local.example>) にあります。

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
YOUTUBE_DAILY_VIDEO_LIMIT=30
YOUTUBE_KEYWORD_LIMIT=6
YOUTUBE_RUN_VIDEO_LIMIT=30
CRON_SECRET=
APP_USER=salon
APP_PASSWORD=
```

| 変数名 | 必須 | 用途 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 任意 | SupabaseのプロジェクトURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 任意 | Supabaseのanon key |
| `AI_PROVIDER` | 任意 | `openai`、`gemini`、`mock`。未設定時はGemini、OpenAIの順で自動判定 |
| `OPENAI_API_KEY` | 任意 | 投稿生成、画像分析で使うOpenAI APIキー |
| `OPENAI_MODEL` | 任意 | 投稿生成で使うモデル名 |
| `OPENAI_VISION_MODEL` | 任意 | 画像分析で使うモデル名 |
| `GEMINI_API_KEY` | 任意 | 投稿生成、画像分析で使うGemini APIキー |
| `GEMINI_MODEL` | 任意 | Geminiで使うモデル名 |
| `YOUTUBE_API_KEY` | YouTube周回利用時は必須 | YouTube Data APIのAPIキー。サーバー側だけで使います |
| `YOUTUBE_DAILY_VIDEO_LIMIT` | 任意 | YouTube周回で1日に保存する動画候補数の上限。未設定時は30件、最大30件 |
| `YOUTUBE_KEYWORD_LIMIT` | 任意 | YouTube周回で1回に検索するキーワード数の上限。未設定時は6個、最大6個 |
| `YOUTUBE_RUN_VIDEO_LIMIT` | 任意 | YouTube周回1回あたりに扱う候補数の上限。未設定時は30件、最大30件 |
| `CRON_SECRET` | Vercel Cron利用時は必須 | 毎朝の自動生成APIを保護する秘密文字列 |
| `APP_USER` | 任意 | アプリ全体のパスワード保護ユーザー名 |
| `APP_PASSWORD` | 公開時は推奨 | アプリ全体のパスワード保護パスワード |

`NEXT_PUBLIC_` で始まる値はブラウザ側にも公開されます。Supabaseのanon keyは、RLS設定やアプリ全体のパスワード保護とセットで使ってください。

`OPENAI_API_KEY`、`GEMINI_API_KEY`、`YOUTUBE_API_KEY`、`APP_PASSWORD` は秘密情報です。GitHubへpushしないでください。

## Supabase設定

Supabaseを設定すると、トレンド、キーワード、AI生成結果、画像を保存できます。

### 1. Supabaseプロジェクトを作る

1. Supabaseで新しいプロジェクトを作成します。
2. Supabase管理画面の `SQL Editor` を開きます。
3. [supabase/schema.sql](</supabase/schema.sql>) のSQLを貼り付けて実行します。
4. `Project Settings > API` でURLとanon keyを確認します。
5. `.env.local` に以下を設定します。

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 2. 作成されるテーブル

- `keywords`
- `trend_links`
- `trend_sources`
- `sns_posts`
- `social_sources`
- `social_posts`
- `blog_posts`
- `ai_outputs`

画像アップロード用に、Supabase Storageの `hair-images` バケットも作成します。

`trend_links` には自動生成用の `tags` カラムもあります。古いSQLを実行済みの場合は、最新の [supabase/schema.sql](</supabase/schema.sql>) をもう一度実行してください。

`trend_sources` はRSS・情報取得元を管理するテーブルです。`category`、`priority`、RSS確認状態、連続失敗回数も保存します。取得元管理画面で追加・編集した内容は、トレンド自動生成で使われます。

最新のSQLでは、美容業界ニュース、ヘアスタイル、サロン経営、メーカー、海外トレンドの初期取得元も追加されます。同じURLがすでにある場合は重複登録しません。

`sns_posts` は手動登録したSNS投稿URLを管理するテーブルです。SNS本文を自動取得せず、入力したタイトル、メモ、カテゴリ、タグをAI分類して保存します。

`social_sources` はSNS名、アカウント名、プロフィールURL、取得方式、優先度、有効/無効、最終確認日時、取得警告を管理します。

`social_posts` は確認済みの公開投稿URLと、title、description、OGP画像URL、canonical URL、公開日候補、AI分類結果を保存します。OGP画像はURLだけを参考表示し、画像ファイルをSupabase Storageへコピーしません。

`blog_posts` はブログ下書きを管理するテーブルです。WordPressへ直接投稿せず、タイトル、本文、メタディスクリプション、貼り付け用HTMLの元データを保存します。

### 3. RLSとStorageの考え方

このアプリは個人利用・サロン内利用向けです。

現在の [supabase/schema.sql](</supabase/schema.sql>) は、アプリ全体の `APP_PASSWORD` 保護を前提に、anon/authenticatedのテーブル読み書きを許可しています。

`hair-images` バケットはprivateです。アプリでは選択中画像のブラウザ内プレビューを表示し、保存済み画像を一般公開する機能はありません。

すでに古いSQLを実行済みの場合も、最新の [supabase/schema.sql](</supabase/schema.sql>) をもう一度実行してください。古いMVP用ポリシーを削除し、Storageバケットをprivateへ更新します。

複数人で本格運用する場合は、Supabase Authを追加して、ユーザー単位のRLSへ変更してください。

## AI API設定

OpenAI APIキーまたはGemini APIキーを設定すると、投稿ネタ生成と画像分析が実際のAI生成になります。

OpenAI APIとGemini APIは、`.env.local` の `AI_PROVIDER` で切り替えます。

### サロン設定をAIに反映する

AI生成では [dummySettings.ts](</src/data/dummySettings.ts>) のサロン設定を参照します。

現在は `ef.mayke`s` 向けに、髪質改善、ストレート、くせ毛改善、パサつき改善、艶髪、白髪ぼかしを重視する設定にしています。

反映される機能:

- 投稿ネタ生成
- ブログ記事生成
- 画像分析
- トレンド自動生成
- SNS投稿AI分類

サロン名、得意技術、文章トーン、想定客層、投稿目的を変えたい場合は、[dummySettings.ts](</src/data/dummySettings.ts>) を編集してください。

### Gemini APIを使う場合

Google AI StudioでGemini APIキーを作成し、`.env.local` に以下を設定します。

```bash
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
```

Gemini APIには無料枠が用意される場合がありますが、条件や上限はGoogle側の最新設定に従います。無料枠を超えた場合や利用制限に達した場合は、モックレスポンスに切り替わります。

### OpenAI APIを使う場合

`.env.local` に以下を設定します。

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-5.4-mini
OPENAI_VISION_MODEL=gpt-5.4-mini
```

`OPENAI_API_KEY` と `GEMINI_API_KEY` はサーバー側のAPI Routeだけで使います。フロント側には出しません。

### AIを使わずモックで動かす場合

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

未設定の場合はパスワード保護なしで動きます。ローカルで試すだけなら未設定でも問題ありませんが、公開URLで使う場合は設定してください。

パスワードは20文字以上を目安に、英大文字、小文字、数字、記号を混ぜるのがおすすめです。

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

SNS投稿を自動取得する機能はありません。登録する情報は、手動で確認したURLやメモだけにしてください。

### トレンド候補を自動生成する

1. `トレンド一覧` を開きます。
2. `トレンド自動生成` の `自動生成する` を押します。
3. アプリが登録済みURL、キーワード、RSS記事、取得元管理の有効なURLを確認します。
4. AIが美容師向けにカテゴリ、メモ、タグ、ef.mayke`sとの関連度を作ります。
5. 既存URLと重複しない候補だけ `trend_links` に保存します。

RSS取得先は [trendSources.ts](</src/config/trendSources.ts>) にまとめています。

取得元管理画面で登録した取得元も、固定configと合わせて使われます。

### YouTube周回を実行する

1. `トレンド一覧` を開きます。
2. `YouTube周回` の検索期間を `過去7日` または `過去30日` から選びます。
3. `YouTube周回` ボタンを押します。
4. 登録済みキーワードと初期キーワードをもとに、公式YouTube Data APIで動画を検索します。
5. AIが美容師向けにカテゴリ、メモ、タグを作ります。
6. 既存URLと重複しない候補だけ `trend_links` に保存します。

初期検索キーワードは [youtubeTrendKeywords.ts](</src/config/youtubeTrendKeywords.ts>) にあります。

初期値:

- 髪質改善
- 縮毛矯正
- 白髪ぼかし
- 大人ショート
- 韓国ヘア
- ボブ
- レイヤー
- 美容師 集客
- 美容室 Instagram

安全方針:

- YouTube公式APIだけを使います。
- 動画本文やコメントのスクレイピングはしません。
- APIキーは `YOUTUBE_API_KEY` として `.env.local` またはVercel環境変数に置きます。
- APIキーはフロント側には出しません。
- 1日に保存する件数は `YOUTUBE_DAILY_VIDEO_LIMIT` で制限します。
- 1回に検索するキーワード数は `YOUTUBE_KEYWORD_LIMIT` で制限します。
- 1キーワードあたり最大5件まで取得します。
- 1回の周回で扱う候補は最大30件までです。
- 初期設定では過去30日以内の動画を優先します。
- 重複URLは保存しません。
- 保存済みタイトルや同じ周回内のタイトルに近い動画は、重複候補として除外します。
- YouTube Data APIの `search.list` は検索ごとに使用量を消費します。個人利用ではキーワード数を増やしすぎず、必要な時だけ手動実行してください。

保存される内容:

- 動画ごとのAI要約
- 美容師向け活用ポイント
- Instagram投稿ネタ
- リール台本案
- カウンセリングでの使い方
- ef.mayke`s向けの髪質改善・縮毛矯正・白髪ぼかしとの関連度

関連度は `高`、`中`、`低` で保存されます。既存のSupabaseテーブルを使っている場合は、[supabase/schema.sql](<supabase/schema.sql>) をもう一度SQL Editorで実行してください。既存データは残したまま、必要なカラムだけ追加されます。

### YouTube APIキーを取得する

1. Google Cloud Consoleを開きます。
2. 新しいプロジェクトを作成、または既存プロジェクトを選びます。
3. `APIとサービス > ライブラリ` を開きます。
4. `YouTube Data API v3` を検索して有効化します。
5. `APIとサービス > 認証情報` を開きます。
6. `認証情報を作成 > APIキー` を選びます。
7. 作成されたAPIキーを `.env.local` に設定します。

```bash
YOUTUBE_API_KEY=your-youtube-api-key
YOUTUBE_DAILY_VIDEO_LIMIT=30
YOUTUBE_KEYWORD_LIMIT=6
YOUTUBE_RUN_VIDEO_LIMIT=30
```

Vercelで使う場合は、Vercelの `Project Settings > Environment Variables` に同じ値を設定し、再デプロイしてください。

YouTube Data APIの `search.list` はAPI使用量を消費します。初期設定では検索キーワード数、1キーワードあたりの取得数、1回あたりの候補数を絞っています。Vercel Cronで頻繁に実行したり、キーワード数を増やしすぎたりするとAPI使用量が増えるため、個人利用では低めの上限を保ってください。

### RSS・情報取得元を管理する

1. 最新の [supabase/schema.sql](</supabase/schema.sql>) をSupabase SQL Editorで実行します。
2. `取得元管理` を開きます。
3. 初期取得元がSupabaseへ重複なく同期されます。
4. 取得元タイトル、URL、種別、カテゴリ、優先度、有効/無効、メモを入力します。
5. `追加する` を押します。
6. 登録済みの取得元は `編集` から更新できます。
7. `RSS確認` を押すと、公開RSS候補を自動確認できます。

種別:

- RSS
- 公式サイト
- 自社サイト
- メーカー
- 美容ディーラー
- 美容メディア

優先度は `high`、`medium`、`low` の3段階です。初期データでは `high` だけが有効です。必要な取得元だけ有効にすると、毎朝の処理時間とAI利用量を抑えられます。

RSS確認では、登録URLから一般的な公開RSS URLを確認します。サイト本文のHTMLは解析しません。RSSが見つからない取得元は、手動参照URLとして残ります。

初期取得元の主な分類:

- 美容業界ニュース: Beautopia、KAMIU、BeautyTech.jp、WWDJAPAN BEAUTYなど
- ヘアスタイル: HOT PEPPER Beauty、MAQUIA、美的など
- サロン経営: HOT PEPPER Beauty Academy、美容センサス
- メーカー: アリミノ、ナプラ、ミルボン、ルベル、資生堂プロフェッショナルなど
- 海外トレンド: Allure、Vogue、Harper's Bazaar、Behindthechair.com

安全方針:

- Instagram、TikTok、XなどのSNSスクレイピングはしません。
- RSS、公式API、公開許可された情報、手動登録URLだけを使います。
- RSSがないサイトは無理にHTML取得しません。
- RSS取得に失敗した場合も、アプリ全体は止めません。
- 取得失敗が2回以上続く取得元は警告表示しますが、自動で無効にはしません。
- 1サイトあたり1回最大5記事です。
- 過去30日以内の記事を優先します。
- 同じ記事URLは正規化して重複保存しません。
- 保存するのはタイトル、短い要約、元記事URLなどです。本文の無断転載はしません。
- AIは髪質改善、縮毛矯正、くせ毛、パサつき、艶髪、白髪、大人女性、ショート、ボブ、ホームケア、松江市の美容室集客との関連度を `高`、`中`、`低` で保存します。
- AI APIキーが未設定の場合は、モック候補を表示します。

### SNS情報を取り込む

1. `SNS情報取得` を開きます。
2. `SNS取得元管理` で、日常的に確認するアカウントと取得方式を登録します。
3. `URLから取り込む` に戻り、Instagram、Pinterest、TikTok、X、YouTubeなどの公開投稿URLを貼ります。
4. URLからSNS種別が自動判定されます。
5. 必要に応じてタイトル、メモ、カテゴリ、タグを入力します。
6. `URLから取り込む` を押します。
7. サーバー側でrobots.txtと公開範囲を確認し、必要最小限のメタデータだけを取得します。
8. AIがトレンド名、カテゴリ、要約、タグ、ef.mayke`sとの関連度、投稿案、ブログ案、カウンセリング活用例を生成します。
9. 同じcanonical URLは保存せず、似たタイトルは重複候補として表示します。
10. 保存後は `トレンド化`、`ブログ化`、`投稿案作成` を利用できます。

メタデータを取得できない場合:

1. 403、429、robots.txt禁止、タイムアウトなどを画面に表示します。
2. 自動取得はその場で停止します。
3. URL、タイトル、メモを自分で確認して入力します。
4. `手入力内容だけで保存` を押します。

SNS利用時の注意:

- 公式APIは、サービスが許可する範囲で構造化データを取得する方法です。利用できる場合は公式APIを優先します。
- URL取り込みは、公開ページのtitle、description、OGP、canonical URL、公開日候補だけを確認する補助機能です。
- Instagram、TikTok、Xなどの非公式な大量スクレイピングは行いません。
- ログイン回避、CAPTCHA回避、Cookie使い回し、IPローテーションは行いません。
- 非公開投稿、ログインが必要な投稿、取得を拒否するページは取り込みません。
- 1回に確認できるURLは最大10件です。画面では誤操作を防ぐため1件ずつ取り込みます。
- 同じドメインへ連続アクセスする場合は数秒間隔を空けます。
- リトライは最大1回で、403、429、robots.txt禁止の場合はリトライせず停止します。
- URL先の本文や画像ファイルを保存・転載しません。
- OGP画像は元ページの画像URLを参考表示するだけで、Supabaseへコピーしません。
- YouTube周回は公式YouTube Data APIだけを使います。
- Instagram、Pinterest、TikTok、Xも、連携を追加する場合は各サービスの公式APIを使います。
- 公開許可のない投稿や個人情報を含む投稿は登録しないでください。
- 元投稿の著作権と各サービスの利用規約を確認し、保存した短い要約から必ず元URLへ戻れる状態にしてください。

### ブログ記事を作成する

1. `ブログ管理` を開きます。
2. `AIブログ生成` タブでメインキーワード、ターゲット、悩み、記事タイプ、文字数目安を選びます。
3. 必要に応じて、参考にしたいトレンドやSNS投稿を選びます。
4. `ブログ下書きを生成` を押します。
5. 生成結果を確認し、`下書きとして編集する` を押します。
6. `ブログ編集` でタイトル、スラッグ、本文、タグ、ステータスを調整します。
7. `下書きを保存` を押します。
8. `WordPressプレビュー` でタイトル、スラッグ、メタディスクリプション、本文HTMLをコピーします。

ブログ管理でできること:

- 記事一覧
- タイトル検索
- カテゴリ絞り込み
- ステータス絞り込み
- 作成日順ソート
- 編集
- 削除
- 複製

ブログカテゴリ:

- 髪質改善
- 縮毛矯正
- 白髪ぼかし
- 大人女性ヘア
- ショート
- ボブ
- ヘアカラー
- ホームケア
- 松江市美容室
- SNS投稿ネタ

ステータス:

- `idea`: ネタ
- `draft`: 下書き
- `ready`: 確認済み
- `published`: 公開済み

WordPress貼り付け用プレビューでは、本文を `h2`、`h3`、`p` タグを使ったHTMLに整形します。CTAには以下を使います。

```txt
本気で髪を綺麗にしたい方は、まずはLINEからご相談ください。
https://lin.ee/jjqQEFX
```

WordPress APIへ直接投稿する機能はまだありません。まずは下書き保存とコピー用整形を優先しています。

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
OPENAI_API_KEY=your-openai-api-key
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
YOUTUBE_API_KEY=your-youtube-api-key
YOUTUBE_DAILY_VIDEO_LIMIT=30
YOUTUBE_KEYWORD_LIMIT=6
YOUTUBE_RUN_VIDEO_LIMIT=30
```

Geminiを使う場合は、`OPENAI_API_KEY` の代わりに以下でも動きます。

```bash
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
```

`CRON_SECRET` はAPI Routeの不正アクセス防止に使います。Cron実行時は `Authorization: Bearer CRON_SECRET` を確認します。

画面の `自動生成する` ボタンは手動実行用です。ログイン済みのアプリ画面から使う前提なので、そのまま実行できます。

### キーワードを管理する

1. `キーワード管理` を開きます。
2. キーワード名、カテゴリ、優先度、メモを入力します。
3. `追加する` を押します。
4. よく使う言葉を残し、不要なものは削除します。

### 投稿ネタを生成する

1. `投稿ネタ生成` を開きます。
2. 作りたい種類を選びます。
3. 年代、対象、文体、文字数を選びます。
4. 生成結果を確認します。
5. 必要に応じてサロンの表現に直して使います。

ブログを書きたい場合は、種類で `ブログ記事` を選びます。タイトル案、導入文、見出し、本文、まとめを含む形で生成されます。

AI APIキーが未設定の場合は、モックレスポンスが表示されます。

### ヘア画像を分析する

1. `画像分析` を開きます。
2. JPEG、PNG、WebPの画像を選びます。
3. `画像を保存してAI分析` を押します。
4. 特徴、推定カテゴリ、SNS投稿向け説明を確認します。

画像分析はあくまで補助です。実際の髪質、履歴、ダメージ状態はカウンセリングで確認してください。

### データをバックアップする

1. `設定` から `バックアップ画面を開く` を押します。
2. 復元用には `JSONを書き出す` を押します。
3. 表で確認したい場合は `CSVを書き出す` を押します。
4. 戻したいときはJSONを読み込み、`追加で復元` または `上書き復元` を選びます。

JSONは復元用、CSVは確認用です。CSVはアプリへの復元には使いません。

## GitHubへpushする手順

### 1. Gitを初期化する

```bash
git init
```

### 2. .gitignoreを確認する

`.gitignore` では `.env.local` を含む環境変数ファイルを除外しています。

```txt
.env*
!.env.local.example
```

`.env.local` がGitに入っていないことを確認します。

```bash
git status
```

### 3. GitHubリポジトリを作る

GitHubで新しいリポジトリを作成します。

- Repository name: `hair-trend-dashboard`
- Public / Private: 必要に応じて選択
- README、.gitignore、Licenseは追加しなくてOK

### 4. commitしてpushする

```bash
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/your-name/hair-trend-dashboard.git
git push -u origin main
```

`your-name` は自分のGitHubユーザー名、またはOrganization名に置き換えてください。

## Vercel公開方法

このアプリはNext.jsアプリなので、Vercelで公開できます。

### 1. Vercelアカウントを作る

1. [Vercel](https://vercel.com/) を開きます。
2. `Sign Up` からアカウントを作成します。
3. GitHubでログインすると、リポジトリ連携が簡単です。

### 2. GitHubと連携する

1. Vercelダッシュボードを開きます。
2. `Add New...` または `New Project` を選びます。
3. GitHub連携を許可します。
4. `hair-trend-dashboard` リポジトリを選びます。

### 3. Import Projectする

1. 対象リポジトリの `Import` を押します。
2. Framework Presetが `Next.js` になっていることを確認します。
3. Root Directoryを確認します。

GitHubリポジトリ直下にこのアプリがある場合、Root DirectoryはそのままでOKです。

もしリポジトリの中に `hair-trend-dashboard` フォルダが入っている構成なら、Root Directoryに `hair-trend-dashboard` を指定してください。

### 4. Vercelに環境変数を設定する

VercelのImport画面、またはデプロイ後の `Project Settings > Environment Variables` で以下を設定します。

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-5.4-mini
OPENAI_VISION_MODEL=gpt-5.4-mini
YOUTUBE_API_KEY=your-youtube-api-key
YOUTUBE_DAILY_VIDEO_LIMIT=30
YOUTUBE_KEYWORD_LIMIT=6
YOUTUBE_RUN_VIDEO_LIMIT=30
CRON_SECRET=your-random-cron-secret
APP_USER=salon
APP_PASSWORD=your-private-app-password
```

個人利用・サロン内利用で公開する場合、`APP_PASSWORD` は必ず設定してください。

環境変数を変更した場合、既存のデプロイには反映されません。変更後は再デプロイしてください。

### 5. Deployする

Import画面で `Deploy` を押します。

デプロイが終わったら、発行されたURLを開いて確認します。

確認すること:

- 最初にパスワード入力が出る
- ホームが開ける
- トレンド一覧が開ける
- キーワード管理が開ける
- 投稿ネタ生成が動く
- 画像分析画面が開ける
- 設定画面からバックアップ画面を開ける
- スマホ幅でも下部ナビとカードが崩れない

参考:

- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Managing Vercel Environment Variables](https://vercel.com/docs/environment-variables/managing-environment-variables)
- [Next.js on Vercel](https://vercel.com/docs/concepts/next.js/overview)

## 公開前チェック

公開前には以下を実行します。

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
- データバックアップ画面でJSON/CSVを書き出せる
- JSONを読み込むと追加復元と上書き復元が表示される
- Vercel公開時は `APP_PASSWORD` が有効になっている

## セキュリティと注意点

- SNSスクレイピングは禁止です。
- SNS URL取り込みは公開ページの必要最小限のメタデータだけを確認し、本文や画像ファイルを無断保存しません。
- 403、429、robots.txt禁止、非公開投稿、ログイン必須ページは取得を停止します。
- ログイン回避、CAPTCHA回避、Cookie使い回し、IPローテーションは実装しません。
- YouTube周回は公式YouTube Data APIだけを使います。
- Instagram、Pinterestなどを自動連携する場合は、各サービスの公式APIだけを使ってください。
- 外部サイトの情報は、手動登録、公式API、RSS、利用許可のある公開情報だけを扱います。
- `.env.local` はGitHubへ上げないでください。
- `OPENAI_API_KEY`、`GEMINI_API_KEY`、`YOUTUBE_API_KEY` はサーバー側のAPI Routeだけで使います。
- `APP_PASSWORD` を設定すると、画面、API Route、静的JS/CSSがBasic認証で保護されます。
- `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` はブラウザ側に出る値です。
- 現在のSupabase RLSは個人利用・サロン内利用向けです。
- 複数サロンや外部ユーザー向けに公開する場合は、ログイン機能とユーザー単位RLSを追加してください。
- ヘア画像分析は補助機能です。お客様への提案は必ずカウンセリングと美容師の判断を優先してください。
- 画像Storageの `hair-images` バケットはprivateです。公開共有機能はありません。

## バックアップ方針

このアプリには、日常的な控えとしてJSON/CSVエクスポートがあります。

おすすめ:

- 編集前にJSONを書き出す
- 月末にJSONを書き出す
- パソコン変更前にJSONを書き出す
- Supabase設定変更前にJSONを書き出す

Supabaseを使っている場合は、Supabase側のバックアップも確認してください。

- Supabase Dashboardの `Database > Backups` でバックアップを確認できます。
- プランによって保持期間や復元範囲が変わります。
- より細かい時点へ戻したい場合はPoint-in-Time Recoveryを検討します。
- 手元に論理バックアップを残したい場合はSupabase CLIの `supabase db dump` を使います。
- Supabase Storageの画像ファイルは、データベースバックアップには実体が含まれません。必要ならStorage側のファイルも別途保管してください。

参考:

- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)

## よくある困りごと

### 画面が開かない

- `npm install` が完了しているか確認します。
- `npm run dev` が動いているか確認します。
- ブラウザで `http://localhost:3000` を開いているか確認します。

### Supabaseに保存されない

- `.env.local` の `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を確認します。
- Supabaseで [supabase/schema.sql](</supabase/schema.sql>) を実行したか確認します。
- RLSポリシーが作成されているか確認します。
- Vercelでは環境変数を設定後に再デプロイしてください。

### AI生成がモックになる

- `AI_PROVIDER` が `openai`、`gemini`、`mock` のどれかになっているか確認します。
- `AI_PROVIDER=gemini` の場合は `GEMINI_API_KEY` が設定されているか確認します。
- `AI_PROVIDER=openai` の場合は `OPENAI_API_KEY` が設定されているか確認します。
- APIキーの前後に余計な空白がないか確認します。
- 各AIサービスの無料枠、課金設定、利用上限を確認します。
- Vercelでは環境変数を設定後に再デプロイしてください。

### Vercelでパスワード入力が出ない

- `APP_PASSWORD` が設定されているか確認します。
- `Production` 環境に設定されているか確認します。
- 設定後に再デプロイしてください。
- `APP_USER` を未設定にした場合、ユーザー名は `salon` です。

## 主なフォルダ

```txt
src/
  app/                 画面とAPI Route
  components/          画面部品
  config/              RSS/外部参照先の設定
  data/                ダミーデータ
  lib/salonProfile.ts  AIに渡すサロン設定
  lib/rss.ts           RSS取得処理
  lib/trendGenerator.ts トレンド候補生成処理
  lib/backup/          JSON/CSVバックアップ処理
  lib/supabase/        Supabase接続処理
  types/               TypeScriptの型

supabase/
  schema.sql           Supabase用SQL
```

初心者が編集しやすい場所:

- 画面を変える: `src/app`
- カードやフォームを変える: `src/components`
- サロン名やAIの基本トーンを変える: `src/data/dummySettings.ts`
- ダミーデータを変える: `src/data`
- バックアップ処理を変える: `src/lib/backup`
- Supabase接続を変える: `src/lib/supabase`
- 型を変える: `src/types`

## 今後追加できる機能

- ログイン機能
- サロン別、スタッフ別のデータ管理
- ユーザー単位のSupabase RLS
- トレンドとキーワードの編集機能
- AI生成結果の保存履歴
- 投稿案のコピー、保存、再生成
- RSSまたは公式APIからの安全な情報取得
- トレンド詳細画面
- バックアップの定期リマインド
- 画像一覧と削除機能
- E2Eテスト、ユニットテスト
- サロンのブランドトーン設定

## 最後に

このアプリは、個人利用・サロン内利用で毎日使いやすい形を目指した完成版です。

まずはダミーデータで触り、必要に応じてSupabase、Gemini APIまたはOpenAI API、Vercel公開を追加してください。
