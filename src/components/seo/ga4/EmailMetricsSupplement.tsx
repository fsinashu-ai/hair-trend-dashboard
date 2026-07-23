import { Badge } from "@/components/ui/Badge";
import type { EmailMetricMonthSummary } from "@/types/emailMetrics";

type EmailMetricsSupplementProps = {
  months: EmailMetricMonthSummary[];
  periodStart: string;
  periodEnd: string;
};

function sumKnown(values: Array<number | null>) {
  const reported = values.filter((value): value is number => value !== null);
  return reported.length > 0
    ? reported.reduce((total, value) => total + value, 0)
    : null;
}

function formatNumber(value: number | null) {
  return value === null ? "未記載" : value.toLocaleString("ja-JP");
}

function formatYen(value: number | null) {
  return value === null
    ? "未記載"
    : `${Math.round(value).toLocaleString("ja-JP")}円`;
}

export function EmailMetricsSupplement({
  months,
  periodStart,
  periodEnd,
}: EmailMetricsSupplementProps) {
  const startMonth = periodStart.slice(0, 7);
  const endMonth = periodEnd.slice(0, 7);
  const matching = months.filter(
    (item) => item.month >= startMonth && item.month <= endMonth,
  );

  if (matching.length === 0) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-stone-950">
            メール月次レポートによる補完
          </h2>
          <Badge tone="warning">同期間の記録なし</Badge>
        </div>
        <p className="mt-2 text-sm leading-6 text-stone-700">
          補完資料は2022-12〜2026-06を収録しています。選択中のGA4期間と一致する月次記録はありません。
        </p>
      </section>
    );
  }

  const metricTypes = [
    ...new Set(
      matching
        .map((item) => item.siteMetricType)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const latest = matching.at(-1);
  const notes = matching.flatMap((item) => item.dataQualityNotes).slice(-3);
  const actualResponses = matching
    .map((item) => item.actualResponse)
    .filter((value): value is string => Boolean(value));

  return (
    <section className="rounded-lg border border-amber-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-stone-950">
              メール月次レポートによる補完
            </h2>
            <Badge tone="warning">別集計</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            GA4で取り切れなかったクリックや反応を照合する資料です。GA4の数値には加算していません。
          </p>
        </div>
        <p className="text-xs text-stone-500">
          対象 {matching[0].month}〜{latest?.month}
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <SupplementMetric
          label="SCクリック"
          value={formatNumber(
            sumKnown(matching.map((item) => item.searchConsoleClicks)),
          )}
        />
        <SupplementMetric
          label="LINEリンク"
          value={formatNumber(
            sumKnown(matching.map((item) => item.lineLinkClicks)),
          )}
        />
        <SupplementMetric
          label="LINE友だち増"
          value={formatNumber(
            sumKnown(matching.map((item) => item.lineFriendAdds)),
          )}
        />
        <SupplementMetric
          label="広告クリック"
          value={formatNumber(sumKnown(matching.map((item) => item.adClicks)))}
        />
        <SupplementMetric
          label="広告費"
          value={formatYen(sumKnown(matching.map((item) => item.adCostYen)))}
        />
        <SupplementMetric
          label="サイト指標"
          value={
            metricTypes.length === 1
              ? `${formatNumber(sumKnown(matching.map((item) => item.siteMetricValue)))} ${metricTypes[0]}`
              : "定義が月ごとに異なる"
          }
        />
      </dl>

      {(notes.length > 0 || actualResponses.length > 0) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <SupplementNote
            label="データ上の注意"
            text={notes.join(" / ") || "特記事項なし"}
          />
          <SupplementNote
            label="メール記載の実反応"
            text={actualResponses.slice(-2).join(" / ") || "記載なし"}
          />
        </div>
      )}
      <p className="mt-4 text-xs leading-5 text-stone-500">
        空欄は未記載であり0ではありません。広告CV、LINEリンク、友だち追加、予約は別の指標です。
      </p>
    </section>
  );
}

function SupplementMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-stone-50 p-3">
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="mt-1 break-words text-base font-semibold text-stone-950">
        {value}
      </dd>
    </div>
  );
}

function SupplementNote({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-md border border-stone-200 p-3">
      <p className="text-xs font-semibold text-stone-700">{label}</p>
      <p className="mt-1 text-xs leading-5 text-stone-600">{text}</p>
    </div>
  );
}
