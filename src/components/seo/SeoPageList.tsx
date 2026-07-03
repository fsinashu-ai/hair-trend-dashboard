import { Badge } from "@/components/ui/Badge";
import { dummySeoPages } from "@/data/seoAds";

export function SeoPageList() {
  return (
    <section className="space-y-4 pb-10">
      {dummySeoPages.map((page) => (
        <article
          className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm sm:p-6"
          key={page.id}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-stone-950">{page.pageTitle}</h2>
              <a
                className="mt-1 block break-all text-sm text-teal-700 underline decoration-teal-200 underline-offset-4"
                href={page.pageUrl}
                rel="noreferrer"
                target="_blank"
              >
                {page.pageUrl}
              </a>
            </div>
            <Badge tone="info">{page.targetKeyword}</Badge>
          </div>
          <dl className="mt-5 grid gap-4 lg:grid-cols-3">
            <div>
              <dt className="text-sm font-semibold text-rose-700">現在の課題</dt>
              <dd className="mt-2 text-sm leading-6 text-stone-700">{page.currentIssue}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-teal-700">改善案</dt>
              <dd className="mt-2 text-sm leading-6 text-stone-700">
                {page.suggestedAction}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-stone-700">CTAメモ</dt>
              <dd className="mt-2 text-sm leading-6 text-stone-700">{page.ctaMemo}</dd>
            </div>
          </dl>
        </article>
      ))}
    </section>
  );
}
