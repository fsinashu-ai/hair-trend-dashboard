import { MarketingSectionNav } from "@/components/marketing/MarketingSectionNav";
import { PageHeader } from "@/components/sections/PageHeader";
import { SeoReportList } from "@/components/seo/SeoReportList";

export default function SeoReportsPage() {
  return (
    <main className="py-6">
      <PageHeader
        description="Search Consoleなどから手入力した月次数値と、次に行う改善作業を記録する画面です。"
        eyebrow="SEO Reports"
        title="SEOレポート"
      />
      <MarketingSectionNav activeHref="/seo/reports" />
      <SeoReportList />
    </main>
  );
}
