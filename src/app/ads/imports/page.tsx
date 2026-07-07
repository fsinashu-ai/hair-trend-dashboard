import { AdCsvDashboard } from "@/components/ads/AdCsvDashboard";
import { MarketingSectionNav } from "@/components/marketing/MarketingSectionNav";
import { PageHeader } from "@/components/sections/PageHeader";

export default function AdsImportsPage() {
  return (
    <main className="py-6">
      <PageHeader
        description="取り込んだ広告CSVの履歴、合計値、期間比較、キャンペーン別・広告別・検索語句別の改善候補を確認します。"
        eyebrow="Ads CSV"
        title="広告CSV集計"
      />
      <MarketingSectionNav activeHref="/ads/imports" />
      <AdCsvDashboard />
    </main>
  );
}
