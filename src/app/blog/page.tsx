import { Suspense } from "react";
import { BlogManager } from "@/components/blog/BlogManager";
import { PageHeader } from "@/components/sections/PageHeader";

export default function BlogPage() {
  return (
    <main className="py-6">
      <PageHeader
        eyebrow="Blog"
        title="ブログ管理"
        description="ef.mayke`sの集客用SEOブログを、下書き保存、AI生成、編集、WordPress貼り付け用プレビューまでまとめて管理します。"
      />

      <Suspense fallback={<p className="text-sm text-stone-500">読み込み中です。</p>}>
        <BlogManager />
      </Suspense>
    </main>
  );
}
