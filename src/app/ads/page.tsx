import { AdsDashboard } from "@/components/ads/AdsDashboard";
import { MarketingSectionNav } from "@/components/marketing/MarketingSectionNav";
import { PageHeader } from "@/components/sections/PageHeader";
import { fetchAdCsvImports } from "@/lib/supabase/adCsv.server";

export const dynamic = "force-dynamic";

export default async function AdsPage() {
  let latestImport = null;
  try {
    latestImport = (await fetchAdCsvImports(1))?.[0] ?? null;
  } catch (error) {
    console.warn("[ads-dashboard] latest import unavailable", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
  }

  return (
    <main className="py-6">
      <PageHeader
        description="広告の目的、対象エリア、予算メモ、LP、訴求内容を整理する計画画面です。配信実績はGoogle広告APIまたは広告CSV集計で確認します。"
        eyebrow="Ads Assistant"
        title="広告計画・メモ"
      />
      <MarketingSectionNav activeHref="/ads" />
      <AdsDashboard initialLatestImport={latestImport} />
    </main>
  );
}
