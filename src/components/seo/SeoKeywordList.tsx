import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { dummySeoKeywords } from "@/data/seoAds";
import type { SeoPriority } from "@/types/seoAds";

const prioritySettings: Record<
  SeoPriority,
  { label: string; tone: "danger" | "warning" | "neutral" }
> = {
  high: { label: "高", tone: "danger" },
  medium: { label: "中", tone: "warning" },
  low: { label: "低", tone: "neutral" },
};

export function SeoKeywordList() {
  return (
    <section className="space-y-3 pb-10">
      {dummySeoKeywords.map((item) => (
        <article
          className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
          key={item.id}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-stone-950">{item.keyword}</h2>
              <p className="mt-1 text-sm leading-6 text-stone-600">{item.intent}</p>
            </div>
            <div className="flex gap-2">
              <Badge tone={prioritySettings[item.priority].tone}>
                優先度 {prioritySettings[item.priority].label}
              </Badge>
              <Badge tone="info">{item.status}</Badge>
            </div>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-stone-700">対象ページ</dt>
              <dd className="mt-1 break-all text-stone-600">{item.targetPage}</dd>
            </div>
            <div>
              <dt className="font-semibold text-stone-700">メモ</dt>
              <dd className="mt-1 leading-6 text-stone-600">{item.memo}</dd>
            </div>
          </dl>
          <div className="mt-4 flex justify-end">
            <Link
              className="inline-flex min-h-10 w-full items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 sm:w-auto"
              href={`/blog?${new URLSearchParams({
                keyword: item.keyword,
                memo: item.memo,
                priority: item.priority,
                searchIntent: item.intent,
                seoKeywordId: item.id,
                targetPage: item.targetPage,
                view: "generator",
              }).toString()}`}
            >
              ブログ作成
            </Link>
          </div>
        </article>
      ))}
    </section>
  );
}
