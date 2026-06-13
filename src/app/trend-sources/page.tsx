import { PageHeader } from "@/components/sections/PageHeader";
import { TrendSourceManager } from "@/components/trend-sources/TrendSourceManager";

export default function TrendSourcesPage() {
  return (
    <main className="py-6">
      <PageHeader
        eyebrow="Sources"
        title="取得元管理"
        description="信頼性の高い美容情報源を優先度別に管理し、公開RSSだけを安全に確認します。SNSやサイト本文のスクレイピングは行いません。"
      />
      <TrendSourceManager />
    </main>
  );
}
