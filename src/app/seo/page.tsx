import { MarketingSectionNav } from "@/components/marketing/MarketingSectionNav";
import { PageHeader } from "@/components/sections/PageHeader";
import { SeoDashboard } from "@/components/seo/SeoDashboard";

export default function SeoPage() {
  return (
    <main className="py-6">
      <PageHeader
        description="検索データを手入力し、優先キーワード、改善ページ、今月の作業を整理します。Google APIにはまだ接続しません。"
        eyebrow="SEO Assistant"
        title="SEO管理"
      />
      <MarketingSectionNav activeHref="/seo" />
      <SeoDashboard />
    </main>
  );
}
