import { PageHeader } from "@/components/sections/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { dummySettings } from "@/data/dummySettings";

const settingRows = [
  { label: "サロン名", value: dummySettings.salonName },
  { label: "得意ジャンル", value: dummySettings.specialty },
  { label: "標準トーン", value: dummySettings.defaultTone },
  { label: "想定客層", value: dummySettings.targetCustomer },
  { label: "投稿の目的", value: dummySettings.postingGoal },
];

const envItems = [
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    description: "SupabaseのプロジェクトURL。公開してよい値です。",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    description: "Supabaseのanonキー。RLS設定とセットで使います。",
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    description:
      "Search Console CSVをサーバーAPIから保存する秘密鍵です。NEXT_PUBLIC_を付けず、ブラウザへ公開しません。",
  },
  {
    name: "GEMINI_API_KEY",
    description: "Gemini APIキー。サーバー側だけで使い、画面には出しません。",
  },
  {
    name: "GEMINI_MODEL",
    description: "使用するGeminiモデル。未設定時はアプリの既定モデルを使います。",
  },
  {
    name: "YOUTUBE_API_KEY",
    description: "YouTube Data APIキー。YouTube周回API Routeのサーバー側だけで使います。",
  },
  {
    name: "YOUTUBE_DAILY_VIDEO_LIMIT",
    description: "YouTube周回で1日に保存する動画候補数の上限です。未設定時は30件です。",
  },
  {
    name: "YOUTUBE_KEYWORD_LIMIT",
    description: "YouTube周回で1回に検索するキーワード数の上限です。未設定時は6個です。",
  },
  {
    name: "YOUTUBE_RUN_VIDEO_LIMIT",
    description: "YouTube周回1回あたりに扱う候補数の上限です。未設定時は30件です。",
  },
  {
    name: "GA4_PROPERTY_ID",
    description: "GA4 Data APIで取得するプロパティIDです。数字だけを入れます。",
  },
  {
    name: "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    description: "Google Cloudで作成したサービスアカウントのメールアドレスです。",
  },
  {
    name: "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    description: "サービスアカウントJSON内のprivate_keyです。サーバー側だけで使い、Gitへ含めません。",
  },
  {
    name: "X_BEARER_TOKEN",
    description:
      "X公式APIのBearer Token。X巡回を使う場合だけ設定します。Bearerという文字は付けません。",
  },
  {
    name: "X_KEYWORD_LIMIT",
    description: "X巡回で1回に検索するキーワード数の上限です。未設定時は5個です。",
  },
  {
    name: "X_RUN_POST_LIMIT",
    description: "X巡回1回あたりに扱う投稿候補数の上限です。未設定時は20件です。",
  },
  {
    name: "CRON_SECRET",
    description:
      "Vercel Cronや自動実行APIを保護する秘密文字列です。公開時は必ず長いランダム文字列を使います。",
  },
  {
    name: "AUTOMATION_WEBHOOK_SECRET",
    description:
      "Apifyやn8nからSNS投稿候補を取り込む専用APIを保護する秘密文字列です。",
  },
  {
    name: "APP_USER",
    description: "任意のアプリ保護ユーザー名。未設定の場合はsalonを使います。",
  },
  {
    name: "APP_PASSWORD",
    description: "任意のアプリ保護パスワード。設定すると全画面とAPI RouteをBasic認証で守ります。",
  },
];

const allowedSources = [
  "手動登録したURLやメモ",
  "提供元が認める公式API",
  "サイト運営者が公開しているRSS",
  "利用・転載・保存が明確に許可された公開情報",
];

export default function SettingsPage() {
  const isSupabaseReady = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const isGeminiReady = Boolean(process.env.GEMINI_API_KEY);
  const isSearchConsoleStorageReady = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const isYoutubeReady = Boolean(process.env.YOUTUBE_API_KEY);
  const isGa4ApiReady = Boolean(
    process.env.GA4_PROPERTY_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  );
  const isXReady = Boolean(process.env.X_BEARER_TOKEN);
  const isCronReady = Boolean(process.env.CRON_SECRET);
  const isAutomationReady = Boolean(process.env.AUTOMATION_WEBHOOK_SECRET);
  const isAppPasswordReady = Boolean(process.env.APP_PASSWORD);
  const phaseOneItems = [
    {
      label: "Supabase保存",
      isReady: isSupabaseReady,
      note: isSupabaseReady
        ? "画面から登録・削除したデータをSupabaseへ保存できます。"
        : "未設定時はダミーデータとlocalStorageで動作します。",
    },
    {
      label: "Gemini生成",
      isReady: isGeminiReady,
      note: isGeminiReady
        ? "Geminiで生成結果を返せます。"
        : "未設定時は確認用のモック生成で動作します。",
    },
    {
      label: "Search Console保存",
      isReady: isSearchConsoleStorageReady,
      note: isSearchConsoleStorageReady
        ? "CSVと分析結果をサーバー経由でSupabaseへ保存できます。"
        : "未設定時は、この端末のlocalStorageで画面を確認できます。",
    },
    {
      label: "YouTube公式API",
      isReady: isYoutubeReady,
      note: isYoutubeReady
        ? "YouTube周回で公式APIの検索結果を候補化できます。"
        : "未設定時はYouTube周回がモック候補になります。",
    },
    {
      label: "GA4公式API",
      isReady: isGa4ApiReady,
      note: isGa4ApiReady
        ? "GA4 CSVを書き出さずに、サーバー経由で集客データを取得できます。"
        : "GA4 API自動取得を使う場合はGA4_PROPERTY_IDとGoogleサービスアカウントを設定してください。",
    },
    {
      label: "X公式API",
      isReady: isXReady,
      note: isXReady
        ? "X巡回で公式APIのRecent Searchを使う準備があります。"
        : "未設定時はX巡回がモック候補になります。X側の有料枠が必要な場合があります。",
    },
    {
      label: "毎朝自動実行",
      isReady: isCronReady,
      note: isCronReady
        ? "Vercel Cronからの自動生成APIを保護できます。"
        : "Vercel Cronを使う場合はCRON_SECRETを設定してください。",
    },
    {
      label: "Apify/n8n受け口",
      isReady: isAutomationReady,
      note: isAutomationReady
        ? "外部自動化ツールからSNS投稿候補を安全に受け取れます。"
        : "Apifyやn8nから取り込む場合はAUTOMATION_WEBHOOK_SECRETを設定してください。",
    },
    {
      label: "公開版の保護",
      isReady: isAppPasswordReady,
      note: isAppPasswordReady
        ? "Basic認証で画面とAPI Routeを保護できます。"
        : "公開URLで使う場合はAPP_PASSWORDを設定してください。",
    },
  ];

  return (
    <main className="py-6">
      <PageHeader
        eyebrow="Settings"
        title="設定"
        description="サロン情報、投稿トーン、Supabase/AI接続に必要な環境変数を確認する画面です。秘密情報は.env.localで管理します。"
      />

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-950">サロン設定</h2>
          <dl className="mt-5 grid gap-4">
            {settingRows.map((row) => (
              <div
                className="border-b border-stone-100 pb-4 last:border-0 last:pb-0"
                key={row.label}
              >
                <dt className="text-sm font-medium text-stone-500">{row.label}</dt>
                <dd className="mt-2 text-sm leading-6 text-stone-800">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="grid content-start gap-6">
          <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-stone-950">接続状況</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone={isSupabaseReady ? "success" : "warning"}>
                Supabase: {isSupabaseReady ? "設定済み" : "未設定"}
              </Badge>
              <Badge tone={isGeminiReady ? "success" : "warning"}>
                Gemini: {isGeminiReady ? "設定済み" : "未設定"}
              </Badge>
              <Badge tone={isYoutubeReady ? "success" : "warning"}>
                YouTube: {isYoutubeReady ? "設定済み" : "未設定"}
              </Badge>
              <Badge tone={isGa4ApiReady ? "success" : "warning"}>
                GA4 API: {isGa4ApiReady ? "設定済み" : "未設定"}
              </Badge>
              <Badge tone={isXReady ? "success" : "warning"}>
                X: {isXReady ? "設定済み" : "未設定"}
              </Badge>
              <Badge tone={isCronReady ? "success" : "warning"}>
                Cron: {isCronReady ? "設定済み" : "未設定"}
              </Badge>
              <Badge tone={isAutomationReady ? "success" : "warning"}>
                Apify/n8n: {isAutomationReady ? "設定済み" : "未設定"}
              </Badge>
              <Badge tone={isAppPasswordReady ? "success" : "warning"}>
                アプリ保護: {isAppPasswordReady ? "有効" : "未設定"}
              </Badge>
            </div>
            <p className="mt-4 text-sm leading-6 text-stone-600">
              未設定でもアプリは動作します。Supabase未設定時はダミーデータ、AI
              APIキー未設定時はモックレスポンスを表示します。公開URLで使う場合はAPP_PASSWORDを設定してください。
            </p>
          </section>

          <section className="rounded-lg border border-teal-200 bg-teal-50 p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-teal-950">
              フェーズ1 実データ接続チェック
            </h2>
            <p className="mt-3 text-sm leading-6 text-teal-900">
              Supabase保存、AI生成、公式API、毎朝自動実行、公開保護の準備状況です。未設定の項目があってもアプリはモックやダミーデータで動作します。
            </p>
            <div className="mt-4 grid gap-3">
              {phaseOneItems.map((item) => (
                <div
                  className="rounded-md border border-white/70 bg-white p-4"
                  key={item.label}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={item.isReady ? "success" : "warning"}>
                      {item.isReady ? "準備OK" : "要確認"}
                    </Badge>
                    <h3 className="text-sm font-semibold text-stone-950">
                      {item.label}
                    </h3>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-stone-600">
                    {item.note}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-teal-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-stone-950">
              データバックアップ
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              JSON/CSVの書き出し、JSONからの復元は専用画面で行います。編集前や月末にJSONを保存しておくと安心です。
            </p>
            <div className="mt-4">
              <Button href="/backup" variant="secondary">
                バックアップ画面を開く
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-rose-200 bg-rose-50 p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-rose-950">
              SNSスクレイピングは禁止
            </h2>
            <p className="mt-3 text-sm leading-6 text-rose-900">
              Instagram、TikTok、XなどのSNS投稿を自動取得・無断保存する機能は作りません。外部サイトの情報は、以下の方法で扱えるものだけを利用します。
            </p>
            <ul className="mt-4 grid gap-2 text-sm text-rose-900">
              {allowedSources.map((source) => (
                <li key={source}>・{source}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-stone-950">
              .env.local に置く値
            </h2>
            <div className="mt-4 grid gap-4">
              {envItems.map((item) => (
                <div className="rounded-md bg-stone-50 p-4" key={item.name}>
                  <code className="text-sm font-semibold text-teal-700">
                    {item.name}
                  </code>
                  <p className="mt-2 text-sm leading-6 text-stone-600">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
