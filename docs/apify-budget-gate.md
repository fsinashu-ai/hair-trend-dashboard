# Apify予算ゲートの実装

無料運用のため、SNSトレンド取得は次の二重制御でActorを起動します。

1. n8nの `Get Apify limits` が `GET https://api.apify.com/v2/users/me/limits` を呼び出す。
2. `Check Apify free budget` が `data.current.monthlyUsageUsd < $4.00` を確認する。
3. 条件を満たす場合だけActorへ進み、満たさない場合はそこで終了する。
4. Actor起動URLにも `maxTotalChargeUsd=0.5` を付け、1回の上限を$0.50にする。

## 実運用へ反映済みの設定

- n8n workflow `Instagramトレンド取得` にLimits APIとIFゲートを追加し、公開済み。
- ApifyのInstagram Task `Instagram-hair-trends` の `MAXIMUM COST PER RUN` を `$0.5` に設定。
- ApifyのTikTok Task `tiktok-hair-trends` の `MAXIMUM COST PER RUN` を `$0.5` に設定。
- 無料モードのDashboard payloadは `budgetMode: "free"`, `maxItems: 30`, `aiLimit: 3`。

## 注意点

- `$4.00` は無料枠を使い切る前の安全マージンである。無料枠・課金状態を変更した場合は、n8nのIF条件も見直す。
- `$0.50` は実行ごとの上限であり、月間使用額を保証するものではない。スケジュール頻度を増やさない。
- n8nのApify認証は `Apify API Bearer` という `httpBearerAuth` Credentialへ移行済み。Limits取得とActor起動の両方で、Authorizationヘッダーをノード設定へ直接保存しない。

## Credential運用

- n8nのCredential名: `Apify API Bearer`
- Credential種別: `Bearer Auth` (`httpBearerAuth`)
- 割り当て済みノード: `Get Apify limits`、`HTTP Request1`
- ワークフローJSONを別環境へ移す場合は、先に同名Credentialを作成し、テンプレート内の `<APIFY_HTTP_BEARER_CREDENTIAL_ID>` を対象環境のIDへ置き換える。
- Token本体はCredential画面だけで管理し、workflow export・Git・ログへ出力しない。
- このドキュメントとテンプレートには実トークンを含めない。
