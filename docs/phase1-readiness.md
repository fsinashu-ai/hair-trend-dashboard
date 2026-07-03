# Phase 1 Readiness Checklist

このメモは、`hair-trend-dashboard` をモック中心の状態から、個人利用・サロン内利用向けの実データ運用へ進めるための確認表です。

## 目的

Phase 1では、次の3つを安定して動かします。

- Supabaseへ保存・取得できる
- GeminiでAI生成できる
- YouTube公式API、必要に応じてX公式APIを安全に使える

SNSの非公式スクレイピングは行いません。扱う外部情報は、手動登録URL、公式API、RSS、公開許可された情報だけです。

## 1. Supabase

確認すること:

- `supabase/schema.sql` をSupabase SQL Editorで実行済み
- `NEXT_PUBLIC_SUPABASE_URL` を設定済み
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定済み
- `keywords`、`trend_links`、`trend_sources`、`social_sources`、`social_posts`、`blog_posts` が作成済み
- RLSが有効
- 公開版では `APP_PASSWORD` でアプリ全体を保護

動作確認:

- キーワードを追加・削除できる
- トレンドURLを追加・削除できる
- ブログ下書きを保存できる
- SNS受信箱に投稿候補を保存できる

## 2. AI

確認すること:

- 実AI生成を使う場合は `GEMINI_API_KEY` を設定
- `GEMINI_MODEL` は任意。未設定時はアプリの既定モデルを使用
- APIキー未設定時はモック生成へ切り替わる

動作確認:

- 投稿ネタ生成で実AIまたはモック結果が返る
- ブログ生成でタイトル、本文、meta descriptionが返る
- SNS分類でカテゴリ、タグ、関連度が返る
- 画像分析で特徴、投稿文、カウンセリング説明が返る

## 3. YouTube公式API

確認すること:

- `YOUTUBE_API_KEY` を設定済み
- `YOUTUBE_DAILY_VIDEO_LIMIT` は個人利用向けに低め
- `YOUTUBE_KEYWORD_LIMIT` は初期値の6前後
- `YOUTUBE_RUN_VIDEO_LIMIT` は最大30件程度

動作確認:

- トレンド一覧の `YouTube周回` を押せる
- 重複URLが保存されない
- AI要約、活用ポイント、Instagram投稿ネタ、リール台本案が生成される
- ef.mayke`sとの関連度が `高`、`中`、`低` で保存される

## 4. X公式API

確認すること:

- `X_BEARER_TOKEN` を設定済み
- Valueには `Bearer ` を付けない
- X Developer Portal側でRecent Searchを使えるプランまたはクレジットがある
- `X_KEYWORD_LIMIT` は最大5件程度
- `X_RUN_POST_LIMIT` は最大20件程度

注意:

- `402` はX API側の課金・クレジット不足の可能性が高い
- `401` はトークン間違いの可能性が高い
- `429` はレート制限
- X公式APIが使えない場合は、SNS URL手動登録で運用する

## 5. Vercel Cron

確認すること:

- `CRON_SECRET` を設定済み
- `vercel.json` に `0 22 * * *` が設定済み
- 日本時間の朝7時はUTCの前日22時
- 環境変数を追加・変更したら再デプロイする

動作確認:

- VercelのCron Jobs画面で `/api/trends/auto-generate` が有効
- 手動の `Run` でエラーにならない
- トレンド候補が重複せず保存される

## 6. 公開前チェック

ローカルで実行:

```bash
npm run lint
npm run build
```

画面で確認:

- 設定画面の `フェーズ1 実データ接続チェック`
- トレンド一覧
- キーワード管理
- 投稿ネタ生成
- SNS情報取得
- SNS受信箱
- ブログ管理
- バックアップ

## 7. 秘密情報

GitHubに含めないもの:

- `.env.local`
- `GEMINI_API_KEY`
- `YOUTUBE_API_KEY`
- `X_BEARER_TOKEN`
- `CRON_SECRET`
- `APP_PASSWORD`

環境変数の見本だけを共有する場合は `.env.local.example` を使います。
