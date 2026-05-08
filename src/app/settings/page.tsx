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
    name: "AI_PROVIDER",
    description: "使うAIを選びます。openai、gemini、mockを指定できます。",
  },
  {
    name: "OPENAI_API_KEY",
    description: "OpenAI APIキー。サーバー側だけで使い、画面には出しません。",
  },
  {
    name: "GEMINI_API_KEY",
    description: "Gemini APIキー。サーバー側だけで使い、画面には出しません。",
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
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const aiProvider = process.env.AI_PROVIDER ?? "auto";
  const isOpenAiReady = Boolean(process.env.OPENAI_API_KEY);
  const isGeminiReady = Boolean(process.env.GEMINI_API_KEY);
  const isAppPasswordReady = Boolean(process.env.APP_PASSWORD);

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
              <Badge tone={isOpenAiReady ? "success" : "warning"}>
                OpenAI: {isOpenAiReady ? "設定済み" : "未設定"}
              </Badge>
              <Badge tone={isGeminiReady ? "success" : "warning"}>
                Gemini: {isGeminiReady ? "設定済み" : "未設定"}
              </Badge>
              <Badge tone="neutral">AI: {aiProvider}</Badge>
              <Badge tone={isAppPasswordReady ? "success" : "warning"}>
                アプリ保護: {isAppPasswordReady ? "有効" : "未設定"}
              </Badge>
            </div>
            <p className="mt-4 text-sm leading-6 text-stone-600">
              未設定でもアプリは動作します。Supabase未設定時はダミーデータ、AI
              APIキー未設定時はモックレスポンスを表示します。公開URLで使う場合はAPP_PASSWORDを設定してください。
            </p>
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
