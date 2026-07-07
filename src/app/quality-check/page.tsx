import { AiQualityChecker } from "@/components/quality/AiQualityChecker";
import { MarketingSectionNav } from "@/components/marketing/MarketingSectionNav";
import { PageHeader } from "@/components/sections/PageHeader";

export default function QualityCheckPage() {
  return (
    <main className="py-6">
      <PageHeader
        description="AIが作ったブログ、広告文、レポートに、断定表現、医療っぽい表現、実在確認が必要な価格・口コミ・メニュー、店舗情報とのズレがないか確認します。"
        eyebrow="AI Quality"
        title="AI品質チェック"
      />
      <MarketingSectionNav activeHref="/quality-check" />
      <AiQualityChecker />
    </main>
  );
}
