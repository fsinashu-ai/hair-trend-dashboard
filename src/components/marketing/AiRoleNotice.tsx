import { Badge } from "@/components/ui/Badge";

type AiRoleNoticeProps = {
  scope: "seo" | "ads" | "integrated";
};

const roleContent = {
  ads: {
    calculated: "費用・CTR・CPC・CPA・期間比較・改善候補",
    gemini: "広告文・LP改善案・除外候補・次のタスク案",
    human: "表現・予算・配信設定・出稿や停止の判断",
    sent: "集計値、改善候補、広告メモ、店舗設定",
  },
  integrated: {
    calculated: "ページ照合・検索CTR・GA4行動・広告CPA・優先度",
    gemini: "ページ別の総評・改善順・CTA案・記事案・タスク案",
    human: "ページ内容、事実、CTA、広告設定、公開可否の判断",
    sent: "ページ別集計、優先候補、店舗設定",
  },
  seo: {
    calculated: "クリック・表示・CTR・順位・期間比較・改善候補",
    gemini: "総評・記事案・タイトル案・SEOタスク案",
    human: "内容の修正、事実確認、公開、計測設定の判断",
    sent: "集計値、改善候補、記事概要、店舗設定",
  },
} as const;

export function AiRoleNotice({ scope }: AiRoleNoticeProps) {
  const content = roleContent[scope];

  return (
    <section className="border-t border-stone-100 pt-4" aria-label="AI分析の役割">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info">役割分担</Badge>
        <p className="text-xs text-stone-500">
          Geminiへ送るのは元データ全件ではなく、必要な集計情報だけです。
        </p>
      </div>
      <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
        <div className="rounded-md bg-stone-50 p-3">
          <p className="font-semibold text-stone-800">アプリ側で計算</p>
          <p className="mt-1 leading-6 text-stone-600">{content.calculated}</p>
        </div>
        <div className="rounded-md bg-teal-50 p-3">
          <p className="font-semibold text-teal-800">Geminiが提案</p>
          <p className="mt-1 leading-6 text-teal-900">{content.gemini}</p>
          <p className="mt-2 text-xs leading-5 text-teal-800">送信対象: {content.sent}</p>
        </div>
        <div className="rounded-md bg-amber-50 p-3">
          <p className="font-semibold text-amber-800">人が最終確認</p>
          <p className="mt-1 leading-6 text-amber-900">{content.human}</p>
        </div>
      </div>
    </section>
  );
}
