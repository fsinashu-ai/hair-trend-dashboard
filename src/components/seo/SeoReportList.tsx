import { dummySeoReports } from "@/data/seoAds";

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    timeZone: "Asia/Tokyo",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00+09:00`));
}

export function SeoReportList() {
  return (
    <section className="space-y-4 pb-10">
      {dummySeoReports.map((report) => (
        <article
          className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm sm:p-6"
          key={report.id}
        >
          <h2 className="text-lg font-semibold text-stone-950">
            {formatMonth(report.reportMonth)}
          </h2>
          <p className="mt-2 text-sm leading-7 text-stone-600">{report.summary}</p>
          <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="border-l-2 border-teal-500 pl-3">
              <dt className="text-xs text-stone-500">クリック</dt>
              <dd className="mt-1 font-semibold text-stone-950">{report.clicks}</dd>
            </div>
            <div className="border-l-2 border-sky-500 pl-3">
              <dt className="text-xs text-stone-500">表示回数</dt>
              <dd className="mt-1 font-semibold text-stone-950">{report.impressions}</dd>
            </div>
            <div className="border-l-2 border-amber-500 pl-3">
              <dt className="text-xs text-stone-500">CTR</dt>
              <dd className="mt-1 font-semibold text-stone-950">{report.ctr}%</dd>
            </div>
            <div className="border-l-2 border-rose-500 pl-3">
              <dt className="text-xs text-stone-500">平均順位</dt>
              <dd className="mt-1 font-semibold text-stone-950">
                {report.averagePosition}
              </dd>
            </div>
          </dl>
          <div className="mt-5 border-t border-stone-100 pt-4">
            <h3 className="text-sm font-semibold text-stone-800">次の対応</h3>
            <ul className="mt-2 space-y-2 text-sm text-stone-600">
              {report.nextActions.map((action) => (
                <li key={action}>・{action}</li>
              ))}
            </ul>
          </div>
        </article>
      ))}
    </section>
  );
}
