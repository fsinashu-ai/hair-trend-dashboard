import { ConversionDashboard } from "@/components/seo/conversions/ConversionDashboard";
import { MarketingSectionNav } from "@/components/marketing/MarketingSectionNav";
import { PageHeader } from "@/components/sections/PageHeader";

export default async function ConversionsPage({
  searchParams,
}: {
  searchParams: Promise<{ importId?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="py-6">
      <PageHeader
        description="GA4 CSVのLINEクリック、予約クリック、キーイベントをもとに、どのページ・流入元が成果につながっているか確認します。"
        eyebrow="Conversions"
        title="コンバージョン分析"
      />
      <MarketingSectionNav activeHref="/seo/conversions" />
      <ConversionDashboard initialImportId={params.importId} />
    </main>
  );
}
