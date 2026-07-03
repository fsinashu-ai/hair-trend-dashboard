import { MarketingSectionNav } from "@/components/marketing/MarketingSectionNav";
import { PageHeader } from "@/components/sections/PageHeader";
import { SeoPageList } from "@/components/seo/SeoPageList";

export default function SeoPagesPage() {
  return (
    <main className="py-6">
      <PageHeader
        description="既存ページの課題、改善案、LINE相談へのCTAメモをページ単位で整理します。"
        eyebrow="SEO Pages"
        title="ページ改善管理"
      />
      <MarketingSectionNav activeHref="/seo/pages" />
      <SeoPageList />
    </main>
  );
}
