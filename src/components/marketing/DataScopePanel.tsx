import Link from "next/link";
import { Badge } from "@/components/ui/Badge";

type DataSourceKind = "api" | "csv" | "manual" | "local" | "none" | "sample";

type DataScopePanelProps = {
  collected: string[];
  description: string;
  href?: string;
  limitations?: string[];
  linkLabel?: string;
  period?: string;
  sourceKind: DataSourceKind;
  sourceLabel: string;
  title?: string;
  updatedAt?: string;
};

const sourceKindLabels: Record<DataSourceKind, string> = {
  api: "公式API",
  csv: "手動CSV",
  local: "この端末",
  manual: "手入力",
  none: "未取得",
  sample: "参考データ",
};

const sourceKindTones: Record<
  DataSourceKind,
  "info" | "success" | "warning" | "neutral"
> = {
  api: "success",
  csv: "info",
  local: "warning",
  manual: "neutral",
  none: "neutral",
  sample: "warning",
};

function formatUpdatedAt(value?: string) {
  if (!value) return "未取得";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未取得";

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function DataScopePanel({
  collected,
  description,
  href,
  limitations = [],
  linkLabel,
  period,
  sourceKind,
  sourceLabel,
  title = "この画面で使っているデータ",
  updatedAt,
}: DataScopePanelProps) {
  return (
    <section className="rounded-lg border border-sky-200 bg-sky-50/70 p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-sky-700">データの見える化</p>
          <h2 className="mt-1 text-lg font-semibold text-stone-950">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-stone-700">{description}</p>
        </div>
        <Badge tone={sourceKindTones[sourceKind]}>{sourceKindLabels[sourceKind]}</Badge>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-md border border-sky-100 bg-white/90 p-3">
          <dt className="text-xs font-medium text-stone-500">取得元</dt>
          <dd className="mt-1 break-words font-semibold text-stone-950">{sourceLabel}</dd>
        </div>
        <div className="rounded-md border border-sky-100 bg-white/90 p-3">
          <dt className="text-xs font-medium text-stone-500">対象期間</dt>
          <dd className="mt-1 font-semibold text-stone-950">{period || "期間の指定なし"}</dd>
        </div>
        <div className="rounded-md border border-sky-100 bg-white/90 p-3">
          <dt className="text-xs font-medium text-stone-500">最終保存・更新</dt>
          <dd className="mt-1 font-semibold text-stone-950">{formatUpdatedAt(updatedAt)}</dd>
        </div>
      </dl>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-stone-950">分析に含むもの</h3>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-stone-700">
            {collected.map((item) => (
              <li key={item}>・{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-stone-950">確認が必要なこと</h3>
          {limitations.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm leading-6 text-stone-700">
              {limitations.map((item) => (
                <li key={item}>・{item}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm leading-6 text-stone-600">このデータだけでは判断できない項目はありません。</p>
          )}
        </div>
      </div>

      {href && linkLabel ? (
        <Link
          className="mt-4 inline-flex min-h-10 items-center rounded-md border border-sky-300 bg-white px-3 text-sm font-semibold text-sky-800 hover:bg-sky-100"
          href={href}
        >
          {linkLabel}
        </Link>
      ) : null}
    </section>
  );
}
