import { Ga4ImportManager } from "@/components/seo/ga4/Ga4ImportManager";
import { MarketingSectionNav } from "@/components/marketing/MarketingSectionNav";
import { PageHeader } from "@/components/sections/PageHeader";

export default function Ga4ImportPage() {
  return (
    <main className="py-6">
      <PageHeader
        description="Google Analytics 4から書き出したUTF-8 CSVを確認し、内容を見てから取り込みます。"
        eyebrow="GA4 CSV"
        title="GA4 CSV取り込み"
      />
      <MarketingSectionNav activeHref="/seo/ga4/import" />
      <Ga4ImportManager />
    </main>
  );
}
