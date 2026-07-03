import { ExistingBlogManager } from "@/components/blog/ExistingBlogManager";
import { PageHeader } from "@/components/sections/PageHeader";

export default function ExistingBlogArticlesPage() {
  return (
    <main className="py-6">
      <PageHeader
        eyebrow="Blog Rewrite"
        title="既存ブログ管理・リライト"
        description="公開済みブログを登録し、Search Consoleの指標とGeminiの提案を見ながら、リライト候補を整理します。WordPressの自動更新は行いません。"
      />
      <ExistingBlogManager />
    </main>
  );
}
