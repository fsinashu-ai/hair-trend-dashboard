import { Ga4Dashboard } from "@/components/seo/ga4/Ga4Dashboard";
import { MarketingSectionNav } from "@/components/marketing/MarketingSectionNav";
import { PageHeader } from "@/components/sections/PageHeader";

export default async function Ga4Page({
  searchParams,
}: {
  searchParams: Promise<{ importId?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="py-6">
      <PageHeader
        description="GA4のCSVを集計し、ページ別の行動、LINE・予約導線、Geminiの改善提案を確認します。"
        eyebrow="GA4"
        title="GA4分析"
      />
      <MarketingSectionNav activeHref="/seo/ga4" />
      <Ga4Dashboard initialImportId={params.importId} />
    </main>
  );
}
