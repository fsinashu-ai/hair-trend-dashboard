import { AdCsvImportManager } from "@/components/ads/AdCsvImportManager";
import { MarketingSectionNav } from "@/components/marketing/MarketingSectionNav";
import { PageHeader } from "@/components/sections/PageHeader";

export default function AdsImportPage() {
  return (
    <main className="py-6">
      <PageHeader
        description="Google広告やMeta広告などのCSVを手動で取り込み、保存前に合計値と先頭10件を確認します。広告API連携や自動出稿は行いません。"
        eyebrow="Ads CSV"
        title="広告CSV取り込み"
      />
      <MarketingSectionNav activeHref="/ads/import" />
      <AdCsvImportManager />
    </main>
  );
}
