# 個人利用・サロン内利用のSupabase安全化

このファイルは、Supabaseのデータを匿名キーで直接読めないようにするための手順です。

## 先に確認すること

Vercelの `Project Settings > Environment Variables` に、次の3つが `Production` に入っていることを確認します。

```txt
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
APP_PASSWORD
```

`APP_USER` は省略できます。省略時のユーザー名は `salon` です。

`SUPABASE_SERVICE_ROLE_KEY` はSupabaseの `Project Settings > API Keys` にある `service_role` の秘密鍵です。この値は絶対にブラウザ、GitHub、`NEXT_PUBLIC_`付きの環境変数へ入れません。

## 実行する順番

1. このアプリの更新をVercelへデプロイし、状態が `Ready` になったことを確認します。
2. Supabaseで対象プロジェクトを開き、`SQL Editor` を開きます。
3. [server-only-data-access.sql](./server-only-data-access.sql) の内容をすべて貼り付けます。
4. `Run` を押し、`Success. No rows returned` と表示されることを確認します。
5. 公開版のアプリで、トレンドまたはブログを1件保存して確認します。

## このSQLが行うこと

- `keywords`、`trend_links`、`ai_outputs`、`trend_sources`、`sns_posts`、`social_sources`、`social_posts`、`blog_posts` の匿名・認証済みロールの直接権限を取り除きます。
- 過去の「全員に許可する」RLSポリシーを削除します。
- `hair-images` バケットの匿名アップロード・削除ポリシーを削除します。
- アプリのサーバーだけが `SUPABASE_SERVICE_ROLE_KEY` を使って、パスワード確認後にデータを扱える状態にします。

## 困ったとき

SQL実行後に保存できない場合は、先にVercelの最新デプロイが `Ready` になっているか確認してください。そのうえで、`SUPABASE_SERVICE_ROLE_KEY` と `APP_PASSWORD` の環境変数名・値・対象環境を確認し、再デプロイします。

このSQLは個人利用・サロン内利用向けです。将来スタッフごとのSupabaseログインを追加するときは、この方式をユーザー単位のRLSへ置き換えてください。
