# Apify無料運用への調整

確認時点（2026-08-02）のApify Personal workspaceは、請求期間が `2026-07-19 UTC - 2026-08-18 UTC`、無料のPlatform usageが `$5.00 / $5.00` に到達していました。上限を超えたままActorを実行すると、無料枠だけでの継続はできません。

## 今回のアプリ側の変更

`POST /api/automation/import-social` に次のオプションを追加しました。

```json
{
  "budgetMode": "free",
  "maxItems": 30,
  "aiLimit": 3
}
```

- `budgetMode: "free"` は、指定がない場合でも取り込みを最大30件、AI分類を最大3件に制限します。
- `maxItems` は1〜50件の範囲で指定できます。無料モードでは指定しても最大30件です。
- `aiLimit` は無料モードでは最大3件です。
- APIレスポンスにも `budgetMode`、`itemLimit`、`aiLimit`、`truncatedCount` を返すため、n8nの実行結果で制限が働いたか確認できます。

これはSupabaseとGeminiの処理量を抑えるアプリ側の安全弁です。Apifyの料金はActor実行中に発生するため、Apifyの無料枠を守るには、Actorを起動する前にn8n側でも運用制御が必要です。

## 推奨運用

1. 実行頻度は毎日から週1回に変更する。SNSの変化が大きい曜日だけ実行し、必要ならInstagramとTikTokを隔週で交互にする。
2. Actorの各ハッシュタグ取得数を5件以下に固定し、対象ハッシュタグを毎回19個すべて回さず、グループをローテーションする。
3. Apify taskの `MAXIMUM COST PER RUN` を `Unlimited` のままにしない。無料枠の残額から余裕を残した実行上限を設定する。
4. n8nで `GET https://api.apify.com/v2/users/me/limits` をActor起動前に実行し、使用額が安全基準（例 `$4.00`）以上ならActorを起動せず終了する。APIレスポンスのフィールド名は、実際のApify APIレスポンスを確認してからIF条件に固定する。
5. Actor実行後のDataset取得やDashboard APIの再試行では、同じActorを再起動しない。`actorRunId` をIdempotency-Keyに使い、Dashboard APIの `duplicateRun: true` は成功扱いにする。

リセット予定は請求期間終了後です。表示上のUTC期間終了と日本時間の境界にずれがあり得るため、8月19日（日本時間）にApify ConsoleのUsage画面とLimits APIで残額を確認してから再開してください。

## n8nテンプレート

`automation/n8n/apify-social-import.workflow.example.json` は、週1回実行、Actor側最大30件、Dashboard側 `budgetMode: "free"`、AI分類最大3件の設定に調整済みです。これは認証情報を含まない例です。実運用では、Actor起動前のLimits APIゲートを追加してから有効化してください。
