import { PageHeader } from "@/components/sections/PageHeader";
import { TrendSourceManager } from "@/components/trend-sources/TrendSourceManager";

export default function TrendSourcesPage() {
  return (
    <main className="py-6">
      <PageHeader
        eyebrow="Sources"
        title="取得元管理"
        description="RSS、公式サイト、自社サイト、メーカー、美容ディーラー、美容メディアの取得元を管理します。SNSスクレイピングは行いません。"
      />
      <TrendSourceManager />
    </main>
  );
}
