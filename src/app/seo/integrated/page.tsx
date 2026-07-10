import { PageIntegrationDashboard } from "@/components/seo/PageIntegrationDashboard";
import { MarketingSectionNav } from "@/components/marketing/MarketingSectionNav";
import { PageHeader } from "@/components/sections/PageHeader";
import { createPageIntegrationSummary } from "@/lib/dashboard/pageIntegration.server";

export const dynamic = "force-dynamic";

export default async function IntegratedSeoPage() {
  const summary = await createPageIntegrationSummary();

  return (
    <main className="py-6">
      <PageHeader
        description="同じページURLに対する検索流入、サイト内行動、広告結果をまとめて確認します。"
        eyebrow="Page Integration"
        title="ページ統合分析"
      />
      <MarketingSectionNav activeHref="/seo/integrated" />
      <PageIntegrationDashboard summary={summary} />
    </main>
  );
}
