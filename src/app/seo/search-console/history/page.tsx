import { MarketingSectionNav } from "@/components/marketing/MarketingSectionNav";
import { PageHeader } from "@/components/sections/PageHeader";
import { SearchConsoleHistory } from "@/components/seo/search-console/SearchConsoleHistory";

export default function SearchConsoleHistoryPage() {
  return (
    <main className="py-6">
      <PageHeader
        description="取り込み期間、集計値、分析状態を確認します。元データはこの画面から削除しません。"
        eyebrow="Import History"
        title="Search Console履歴"
      />
      <MarketingSectionNav activeHref="/seo/search-console/history" />
      <SearchConsoleHistory />
    </main>
  );
}

