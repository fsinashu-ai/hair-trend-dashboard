import { Badge } from "@/components/ui/Badge";
import { dummyAdReports } from "@/data/seoAds";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    currency: "JPY",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

export function AdReportList() {
  return (
    <section className="space-y-4 pb-10">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        現在は手入力・ダミーデータです。Google広告APIとの接続や、自動出稿・予算変更は行いません。
      </div>
      {dummyAdReports.map((report) => (
        <article
          className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm sm:p-6"
          key={report.id}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Badge tone="info">{report.platform}</Badge>
              <h2 className="mt-3 text-lg font-semibold text-stone-950">
                {report.campaignName}
              </h2>
            </div>
            <p className="text-sm font-medium text-stone-500">
              {report.reportMonth.slice(0, 7)}
            </p>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-stone-500">費用</dt>
              <dd className="mt-1 font-semibold text-stone-950">
                {formatCurrency(report.cost)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">クリック</dt>
              <dd className="mt-1 font-semibold text-stone-950">{report.clicks}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">コンバージョン</dt>
              <dd className="mt-1 font-semibold text-stone-950">
                {report.conversions}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">CPA</dt>
              <dd className="mt-1 font-semibold text-stone-950">
                {formatCurrency(report.cpa)}
              </dd>
            </div>
          </dl>
          <p className="mt-5 border-t border-stone-100 pt-4 text-sm leading-7 text-stone-700">
            {report.aiAnalysis}
          </p>
          <ul className="mt-3 space-y-1 text-sm text-stone-600">
            {report.nextActions.map((action) => (
              <li key={action}>・{action}</li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
