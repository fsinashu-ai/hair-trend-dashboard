import { GoogleAdsApiManager } from "@/components/ads/GoogleAdsApiManager";
import { MarketingSectionNav } from "@/components/marketing/MarketingSectionNav";
import { PageHeader } from "@/components/sections/PageHeader";

export default function GoogleAdsPage() {
  return (
    <main className="py-6">
      <PageHeader
        description="Google広告APIから出稿中広告の結果を読み取り専用で取得し、広告CSV集計と同じ形式で保存します。出稿、停止、予算変更は行いません。"
        eyebrow="Google Ads API"
        title="Google広告API取得"
      />
      <MarketingSectionNav activeHref="/ads/google" />
      <GoogleAdsApiManager />
    </main>
  );
}
