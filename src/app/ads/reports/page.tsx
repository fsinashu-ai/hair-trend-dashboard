import { AdReportList } from "@/components/ads/AdReportList";
import { MarketingSectionNav } from "@/components/marketing/MarketingSectionNav";
import { PageHeader } from "@/components/sections/PageHeader";

export default function AdsReportsPage() {
  return (
    <main className="py-6">
      <PageHeader
        description="広告費、クリック、コンバージョン、CPAを手入力データで振り返ります。"
        eyebrow="Ads Reports"
        title="広告レポート"
      />
      <MarketingSectionNav activeHref="/ads/reports" />
      <AdReportList />
    </main>
  );
}
