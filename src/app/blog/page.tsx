import Link from "next/link";
import { Suspense } from "react";
import { BlogManager } from "@/components/blog/BlogManager";
import { PageHeader } from "@/components/sections/PageHeader";

export default function BlogPage() {
  return (
    <main className="py-6">
      <PageHeader
        eyebrow="Blog"
        title="ブログ管理"
        description="ef.mayke`sのSEOブログ下書き、AI生成、編集、WordPress貼り付け用プレビューを管理します。"
      />

      <div className="mb-5 rounded-lg border border-teal-100 bg-teal-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-900">
              公開済みブログのリライト管理
            </p>
            <p className="mt-1 text-sm leading-6 text-teal-800">
              すでに公開している記事は、既存ブログ管理から登録・改善提案できます。
            </p>
          </div>
          <Link
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
            href="/blog/articles"
          >
            既存ブログ管理へ
          </Link>
        </div>
      </div>

      <Suspense
        fallback={
          <p className="text-sm text-stone-500">ブログ機能を読み込み中です。</p>
        }
      >
        <BlogManager />
      </Suspense>
    </main>
  );
}
