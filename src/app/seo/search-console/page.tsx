import { MarketingSectionNav } from "@/components/marketing/MarketingSectionNav";
import { PageHeader } from "@/components/sections/PageHeader";
import { SearchConsoleDashboard } from "@/components/seo/search-console/SearchConsoleDashboard";

export default async function SearchConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ importId?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="py-6">
      <PageHeader
        description="取り込んだ検索データを集計し、改善候補、期間比較、Geminiの提案を確認します。"
        eyebrow="Search Console"
        title="Search Console分析"
      />
      <MarketingSectionNav activeHref="/seo/search-console" />
      <SearchConsoleDashboard initialImportId={params.importId} />
    </main>
  );
}

