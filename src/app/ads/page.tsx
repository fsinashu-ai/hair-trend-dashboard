import { AdsDashboard } from "@/components/ads/AdsDashboard";
import { MarketingSectionNav } from "@/components/marketing/MarketingSectionNav";
import { PageHeader } from "@/components/sections/PageHeader";

export default function AdsPage() {
  return (
    <main className="py-6">
      <PageHeader
        description="広告案、対象エリア、予算メモ、LPを整理します。広告の自動出稿や予算変更は行いません。"
        eyebrow="Ads Assistant"
        title="広告管理メモ"
      />
      <MarketingSectionNav activeHref="/ads" />
      <AdsDashboard />
    </main>
  );
}
