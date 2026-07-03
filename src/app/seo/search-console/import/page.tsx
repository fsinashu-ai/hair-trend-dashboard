import { MarketingSectionNav } from "@/components/marketing/MarketingSectionNav";
import { PageHeader } from "@/components/sections/PageHeader";
import { SearchConsoleImportManager } from "@/components/seo/search-console/SearchConsoleImportManager";

export default function SearchConsoleImportPage() {
  return (
    <main className="py-6">
      <PageHeader
        description="Google Search Consoleから書き出したUTF-8 CSVを確認し、内容を見てから取り込みます。"
        eyebrow="CSV Import"
        title="Search Console CSV取り込み"
      />
      <MarketingSectionNav activeHref="/seo/search-console/import" />
      <SearchConsoleImportManager />
    </main>
  );
}

