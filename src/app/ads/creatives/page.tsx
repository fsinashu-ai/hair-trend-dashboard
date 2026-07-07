import { AdCreativeManager } from "@/components/ads/AdCreativeManager";
import { MarketingSectionNav } from "@/components/marketing/MarketingSectionNav";
import { PageHeader } from "@/components/sections/PageHeader";

export default function AdCreativesPage() {
  return (
    <main className="py-6">
      <PageHeader
        description="Geminiで広告文、CTA、LP改善案、除外キーワード、A/Bテスト案を作成します。広告の自動出稿や予算変更は行いません。"
        eyebrow="Ad Creatives"
        title="広告案生成"
      />
      <MarketingSectionNav activeHref="/ads/creatives" />
      <AdCreativeManager />
    </main>
  );
}
