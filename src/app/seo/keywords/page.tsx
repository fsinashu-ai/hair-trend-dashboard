import { MarketingSectionNav } from "@/components/marketing/MarketingSectionNav";
import { PageHeader } from "@/components/sections/PageHeader";
import { SeoKeywordList } from "@/components/seo/SeoKeywordList";

export default function SeoKeywordsPage() {
  return (
    <main className="py-6">
      <PageHeader
        description="狙う検索キーワード、検索意図、対象ページ、優先度を一覧で確認します。"
        eyebrow="SEO Keywords"
        title="SEOキーワード"
      />
      <MarketingSectionNav activeHref="/seo/keywords" />
      <SeoKeywordList />
    </main>
  );
}
