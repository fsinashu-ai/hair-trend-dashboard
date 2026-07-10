import Link from "next/link";
import { AiAnalysisPanel } from "@/components/marketing/AiAnalysisPanel";
import { Badge } from "@/components/ui/Badge";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { formatPercent, formatYen } from "@/lib/ads/adCsvAnalysis";
import type {
  IntegratedPage,
  PageIntegrationSourceStatus,
  PageIntegrationSummary,
} from "@/types/pageIntegration";

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未取得";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function priorityTone(priority: IntegratedPage["priority"]) {
  return priority === "high" ? "danger" : priority === "medium" ? "warning" : "neutral";
}

function SourceCard({ label, source }: { label: string; source: PageIntegrationSourceStatus | null }) {
  return (
    <article className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-stone-950">{label}</h2>
        <Badge tone={source ? "success" : "warning"}>{source ? "取込済み" : "データなし"}</Badge>
      </div>
      <p className="mt-3 break-words text-sm leading-6 text-stone-700">
        {source?.label ?? "まだデータがありません"}
      </p>
      <dl className="mt-3 grid gap-2 text-xs text-stone-500">
        <div className="flex justify-between gap-3">
          <dt>対象期間</dt>
          <dd className="text-right">{source?.period ?? "未取得"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>保存行数</dt>
          <dd className="text-right">{source?.detail ?? "未取得"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>更新日時</dt>
          <dd className="text-right">{source ? formatDateTime(source.updatedAt) : "未取得"}</dd>
        </div>
      </dl>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-md bg-stone-50 p-4">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-stone-950">{value}</p>
    </article>
  );
}

function SearchConsoleCell({ row }: { row: IntegratedPage }) {
  if (!row.searchConsole) return <span className="text-stone-400">未取得</span>;
  return (
    <div className="space-y-1 text-xs leading-5">
      <p>クリック {row.searchConsole.clicks.toLocaleString("ja-JP")}</p>
      <p>表示 {row.searchConsole.impressions.toLocaleString("ja-JP")}</p>
      <p>CTR {formatPercent(row.searchConsole.ctr)} / {row.searchConsole.position.toFixed(1)}位</p>
    </div>
  );
}

function Ga4Cell({ row }: { row: IntegratedPage }) {
  if (!row.ga4) return <span className="text-stone-400">未取得</span>;
  return (
    <div className="space-y-1 text-xs leading-5">
      <p>セッション {row.ga4.sessions.toLocaleString("ja-JP")}</p>
      <p>ユーザー {row.ga4.users.toLocaleString("ja-JP")}</p>
      <p>LINE {row.ga4.lineClicks} / 予約 {row.ga4.reservationClicks}</p>
    </div>
  );
}

function AdsCell({ row }: { row: IntegratedPage }) {
  if (!row.ads) return <span className="text-stone-400">未取得</span>;
  return (
    <div className="space-y-1 text-xs leading-5">
      <p>費用 {formatYen(row.ads.cost)}</p>
      <p>クリック {row.ads.clicks.toLocaleString("ja-JP")} / CV {row.ads.conversions}</p>
      <p>CTR {formatPercent(row.ads.ctr)} / CPA {formatYen(row.ads.cpa)}</p>
    </div>
  );
}

export function PageIntegrationDashboard({ summary }: { summary: PageIntegrationSummary }) {
  const aiContext = {
    summary: {
      pagesWithAds: summary.pagesWithAds,
      pagesWithGa4: summary.pagesWithGa4,
      pagesWithSearchConsole: summary.pagesWithSearchConsole,
      totalAdConversions: summary.totalAdConversions,
      totalAdCost: summary.totalAdCost,
      totalGa4Sessions: summary.totalGa4Sessions,
      totalSearchClicks: summary.totalSearchClicks,
    },
    pages: summary.rows.slice(0, 20),
  };

  return (
    <div className="space-y-6 pb-10">
      <section className="rounded-lg border border-sky-200 bg-sky-50/70 p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-sky-700">同じページを横断して確認</p>
            <h2 className="mt-1 text-lg font-semibold text-stone-950">Search Console・GA4・広告の統合分析</h2>
            <p className="mt-2 text-sm leading-6 text-stone-700">
              URLをページパスへ整えて、検索流入、サイト内行動、広告結果を同じページ単位でまとめます。
            </p>
          </div>
          <Badge tone={summary.rows.length ? "success" : "warning"}>
            {summary.rows.length ? `${summary.rows.length}ページ` : "データ待ち"}
          </Badge>
        </div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Link className="min-h-10 rounded-md border border-sky-300 bg-white px-3 py-2 font-semibold text-sky-800 hover:bg-sky-100" href="/seo/search-console/import">
            Search Consoleを取り込む
          </Link>
          <Link className="min-h-10 rounded-md border border-sky-300 bg-white px-3 py-2 font-semibold text-sky-800 hover:bg-sky-100" href="/seo/ga4/import">
            GA4を取り込む
          </Link>
          <Link className="min-h-10 rounded-md border border-teal-300 bg-white px-3 py-2 font-semibold text-teal-800 hover:bg-teal-100" href="/ads/google">
            Google広告を取得
          </Link>
          <Link className="min-h-10 rounded-md border border-teal-300 bg-white px-3 py-2 font-semibold text-teal-800 hover:bg-teal-100" href="/ads/import">
            広告CSVを取り込む
          </Link>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <SourceCard label="Search Console" source={summary.sources.searchConsole} />
        <SourceCard label="GA4" source={summary.sources.ga4} />
        <SourceCard label="広告" source={summary.sources.ads} />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="分析ページ" value={summary.rows.length.toLocaleString("ja-JP")} />
        <Metric label="検索クリック" value={summary.totalSearchClicks.toLocaleString("ja-JP")} />
        <Metric label="GA4セッション" value={summary.totalGa4Sessions.toLocaleString("ja-JP")} />
        <Metric label="広告費" value={formatYen(summary.totalAdCost)} />
      </section>

      {summary.rows.length === 0 ? (
        <StatusMessage tone="warning">
          ページ統合分析に使える行データがありません。各データを1件以上取り込むと、ページ単位の比較が表示されます。
        </StatusMessage>
      ) : (
        <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-stone-950">ページ別の統合結果</h2>
              <p className="mt-1 text-sm leading-6 text-stone-500">高優先の候補から表示しています。データがない列は未取得です。</p>
            </div>
            <Badge tone="info">最大100ページ</Badge>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs text-stone-500">
                  <th className="px-3 py-3">ページ</th>
                  <th className="px-3 py-3">Search Console</th>
                  <th className="px-3 py-3">GA4</th>
                  <th className="px-3 py-3">広告</th>
                  <th className="px-3 py-3">優先度・理由</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((row) => (
                  <tr className="border-b border-stone-100 last:border-0" key={row.pagePath}>
                    <td className="max-w-64 px-3 py-4 align-top">
                      <p className="break-words font-semibold text-stone-900">{row.pageTitle || "タイトル未取得"}</p>
                      <p className="mt-1 break-all text-xs leading-5 text-stone-500">{row.pagePath}</p>
                    </td>
                    <td className="px-3 py-4 align-top"><SearchConsoleCell row={row} /></td>
                    <td className="px-3 py-4 align-top"><Ga4Cell row={row} /></td>
                    <td className="px-3 py-4 align-top"><AdsCell row={row} /></td>
                    <td className="max-w-64 px-3 py-4 align-top">
                      <Badge tone={priorityTone(row.priority)}>{row.priority === "high" ? "高" : row.priority === "medium" ? "中" : "低"}</Badge>
                      <p className="mt-2 text-xs leading-5 text-stone-600">{row.reason}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <AiAnalysisPanel
        context={aiContext}
        fallbackText="ページごとの検索流入、サイト内行動、広告結果を確認し、優先度の高いページから改善案を整理します。"
        isUsingRealData={summary.rows.length > 0}
        scope="integrated"
        title="ページ統合のAI改善提案"
      />
    </div>
  );
}
