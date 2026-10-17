# Apify Social Import

Apifyやn8nで集めたInstagram/TikTok投稿候補を、アプリのSNS受信箱へ入れるための受け口APIです。

## API

```txt
POST /api/automation/import-social
```

認証ヘッダー:

```txt
Authorization: Bearer <AUTOMATION_WEBHOOK_SECRET>
```

Vercel公開版で `APP_PASSWORD` を設定していても、このヘッダーが正しければ専用APIだけ通ります。

## 環境変数

`.env.local` またはVercel Environment Variablesに追加します。

```env
AUTOMATION_WEBHOOK_SECRET=長いランダム文字列
```

Supabaseへ保存する場合は、以下も必要です。

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

AI分類を実AIで行う場合は、`GEMINI_API_KEY`も設定します。

## 送信できる形式

配列そのもの、または `items`、`posts`、`results`、`data`、`datasetItems` の配列を受け取れます。

```json
{
  "sourceName": "Apify Instagram Actor",
  "items": [
    {
      "platform": "Instagram",
      "url": "https://www.instagram.com/reel/xxxx/",
      "caption": "髪質改善ストレートの仕上がり例 #髪質改善 #艶髪",
      "ownerUsername": "sample_salon",
      "ownerFullName": "Sample Salon",
      "timestamp": "2026-06-19T08:00:00.000Z",
      "likesCount": 120,
      "commentsCount": 8,
      "videoPlayCount": 2400,
      "thumbnailUrl": "https://example.com/thumb.jpg",
      "shortCode": "xxxx"
    }
  ]
}
```

TikTokの例:

```json
{
  "sourceName": "Apify TikTok Actor",
  "items": [
    {
      "platform": "TikTok",
      "webVideoUrl": "https://www.tiktok.com/@sample/video/1234567890",
      "text": "大人女性向けの艶髪ストレート",
      "authorMeta": {
        "name": "sample",
        "nickName": "Sample Stylist"
      },
      "createTimeISO": "2026-06-19T08:00:00.000Z",
      "diggCount": 240,
      "commentCount": 12,
      "playCount": 5000,
      "shareCount": 20,
      "videoId": "1234567890"
    }
  ]
}
```

## 保存先

保存先はSupabaseの `social_posts` です。保存時は次のように扱います。

- `review_status` は `未確認`
- URLとcanonical URLの重複は保存しない
- AIが作成したトレンド名が近い場合は、同じリクエスト内の重複候補として除外
- AI分類に成功した場合はカテゴリ、タグ、関連度、投稿案、ブログ案を保存
- AI未設定時はモック分類で保存

### 保存する情報と本文の扱い

Apifyによる公開投稿の取り込みは週1回を目安にし、件数・Apify予算・AI分類数に上限を設けてください。APIは1回最大50件、標準設定でAI分類は最大10件です。

投稿に由来する情報として保存するのは、投稿URL、アカウント名・ハンドル、投稿日、数値指標、ハッシュタグ、AIが自分の言葉で作成したトレンド名・要約・投稿案です。コメント数などの数値は保存できますが、コメント本文は保存しません。

送信された投稿本文は、タグ抽出とAI分類の処理中だけ使います。`description` は空文字で保存し、タイトルはAIが生成したトレンド名を使います。AIトレンド名がない場合は「`@handle の投稿`」のような中立的なタイトルにします。分類結果や投稿案は本文を転載・再現せず、AI自身の言葉で作成します。

`rawPayload` には数値と真偽値だけを残し、文字列は保存しません。本文、コメント、画像データ、サムネイルURLも保存対象外です。`payloadHash` はこの文字列除去後の `rawPayload` から計算します。重複判定は投稿URL、canonical URL、import keyだけで行います。AI生成トレンド名は別々の投稿で重なることがあるため、タイトル類似による重複判定は行いません。

## 件数制限

1回のリクエストで最大50件まで処理します。AI分類は初期設定で最大10件までです。

AI分類数を変える場合:

```json
{
  "aiLimit": 5,
  "items": []
}
```

AI分類を使わずに取り込む場合:

```json
{
  "skipAi": true,
  "items": []
}
```

保存せず確認だけ行う場合:

```json
{
  "dryRun": true,
  "items": []
}
```

## n8n設定例

HTTP Requestノード:

- Method: `POST`
- URL: `https://あなたのVercel URL/api/automation/import-social`
- Authentication: なし
- Headers:
  - `Authorization`: `Bearer <AUTOMATION_WEBHOOK_SECRET>`
  - `Content-Type`: `application/json`
- Body: Apify Datasetの配列を `items` に入れる

## Supabase SQL

最新の `supabase/schema.sql` をSupabase SQL Editorで再実行してください。既存データは残し、足りないカラムだけ追加されます。
