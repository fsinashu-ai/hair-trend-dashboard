import { MarketingSectionNav } from "@/components/marketing/MarketingSectionNav";
import { PageHeader } from "@/components/sections/PageHeader";
import { SeoTaskList } from "@/components/seo/SeoTaskList";

export default async function SeoTasksPage({ searchParams }: { searchParams: Promise<{ importId?: string }> }) {
  const params = await searchParams;
  return <main className="py-6"><PageHeader description="Gemini分析から登録した改善作業を、期限と優先度つきで確認します。" eyebrow="SEO Tasks" title="SEOタスク" /><MarketingSectionNav activeHref="/seo/tasks" /><SeoTaskList importId={params.importId} /></main>;
}

