import { MarketingSectionNav } from "@/components/marketing/MarketingSectionNav";
import { PageHeader } from "@/components/sections/PageHeader";
import { SeoDashboard } from "@/components/seo/SeoDashboard";

export const dynamic = "force-dynamic";

export default function SeoPage() {
  return (
    <main className="py-6">
      <PageHeader
        description="キーワード、改善ページ、SEOタスクを整理する計画画面です。実際の検索実績はSearch Console分析、サイト内行動はGA4分析で確認します。"
        eyebrow="SEO Assistant"
        title="SEO計画・管理"
      />
      <MarketingSectionNav activeHref="/seo" />
      <SeoDashboard />
    </main>
  );
}
