"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { DataScopePanel } from "@/components/marketing/DataScopePanel";
import { Badge } from "@/components/ui/Badge";
import { StatusMessage } from "@/components/ui/StatusMessage";
import {
  compareAdCsvPeriods,
  createAdCsvBasicAnalysis,
  formatPercent,
  formatYen,
  groupAdCsvRows,
  summarizeAdCsvRows,
} from "@/lib/ads/adCsvAnalysis";
import { adCsvStorageEventName, readLocalAdCsvDataset } from "@/lib/ads/adCsvLocalStorage";
import type { AdCreative } from "@/types/adCreative";
import type { AdCsvDataset, AdCsvGroupSummary, AdCsvImprovementCandidate } from "@/types/adCsv";
import type { AdCampaignNote } from "@/types/seoAds";

const emptyDataset: AdCsvDataset = { imports: [], rowsByImport: {} };
const campaignStorageKey = "hair-trend-ad-campaign-notes";
const creativeStorageKey = "hair-trend-ad-creatives";

const importTypeLabels: Record<AdCsvDataset["imports"][number]["importType"], string> = {
  ad: "広告",
  ad_group: "広告グループ",
  campaign: "キャンペーン",
  daily: "日別",
  keyword: "キーワード",
  search_term: "検索語句",
  unknown: "媒体不明",
};

const platformLabels = {
  facebook: "Facebook広告",
  google: "Google広告",
  instagram: "Instagram広告",
  line: "LINE広告",
  meta: "Meta広告",
  other: "その他",
} as const;

function getStorageSnapshot(key: string) {
  if (typeof window === "undefined") return "[]";
  return window.localStorage.getItem(key) ?? "[]";
}

function subscribeToStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("hair-trend-ad-campaign-notes-change", onStoreChange);
  window.addEventListener("hair-trend-ad-creatives-change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("hair-trend-ad-campaign-notes-change", onStoreChange);
    window.removeEventListener("hair-trend-ad-creatives-change", onStoreChange);
  };
}

function parseList<T>(value: string): T[] {
  try {
    const parsed = JSON.parse(value) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function AdCsvDashboard() {
  const [dataset, setDataset] = useState<AdCsvDataset>(emptyDataset);
  const [isLoading, setIsLoading] = useState(true);
  const [storageMode, setStorageMode] = useState<"supabase" | "local" | "demo">("demo");
  const [message, setMessage] = useState("広告CSV履歴を読み込んでいます。");
  const [selectedImportId, setSelectedImportId] = useState("");

  const campaignSnapshot = useSyncExternalStore(
    subscribeToStorage,
    () => getStorageSnapshot(campaignStorageKey),
    () => "[]",
  );
  const creativeSnapshot = useSyncExternalStore(
    subscribeToStorage,
    () => getStorageSnapshot(creativeStorageKey),
    () => "[]",
  );
  const campaigns = useMemo(() => parseList<AdCampaignNote>(campaignSnapshot), [campaignSnapshot]);
  const creatives = useMemo(() => parseList<AdCreative>(creativeSnapshot), [creativeSnapshot]);

  async function load(importId = selectedImportId) {
    setIsLoading(true);
    try {
      const url = importId ? `/api/ads/import?importId=${encodeURIComponent(importId)}` : "/api/ads/import";
      const response = await fetch(url);
      const data = (await response.json()) as {
        error?: string;
        imports?: AdCsvDataset["imports"];
        rowsByImport?: AdCsvDataset["rowsByImport"];
        storageMode?: "supabase" | "local";
      };
      if (!response.ok) throw new Error(data.error || "広告CSV履歴を読み込めませんでした。");
      if (data.storageMode === "supabase") {
        setDataset({ imports: data.imports ?? [], rowsByImport: data.rowsByImport ?? {} });
        setStorageMode("supabase");
        setMessage("Supabaseに保存された広告CSVを表示しています。");
      } else {
        const local = readLocalAdCsvDataset();
        setDataset(local);
        setStorageMode("local");
        setMessage("Supabase未設定のため、この端末に保存された広告CSVを表示しています。");
      }
    } catch (error) {
      const local = readLocalAdCsvDataset();
      setDataset(local);
      setStorageMode("local");
      setMessage(error instanceof Error ? `${error.message} この端末の保存データを表示します。` : "この端末の保存データを表示します。");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(""), 0);
    const onChange = () => void load(selectedImportId);
    window.addEventListener(adCsvStorageEventName, onChange);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(adCsvStorageEventName, onChange);
    };
    // selectedImportId is intentionally excluded so the initial load does not loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedImport = useMemo(
    () => dataset.imports.find((item) => item.id === selectedImportId) ?? dataset.imports[0],
    [dataset.imports, selectedImportId],
  );
  const previousImport = useMemo(
    () =>
      selectedImport
        ? dataset.imports.find(
            (item) =>
              item.id !== selectedImport.id &&
              item.platform === selectedImport.platform &&
              item.importType === selectedImport.importType &&
              item.periodEnd < selectedImport.periodEnd,
          )
        : undefined,
    [dataset.imports, selectedImport],
  );
  const rows = useMemo(
    () => (selectedImport ? dataset.rowsByImport[selectedImport.id] ?? [] : []),
    [dataset.rowsByImport, selectedImport],
  );
  const previousRows = useMemo(
    () => (previousImport ? dataset.rowsByImport[previousImport.id] ?? [] : []),
    [dataset.rowsByImport, previousImport],
  );
  const metrics = useMemo(() => summarizeAdCsvRows(rows), [rows]);
  const comparison = useMemo(
    () => compareAdCsvPeriods(rows, previousRows, selectedImport?.comparisonLabel || "前回期間"),
    [previousRows, rows, selectedImport?.comparisonLabel],
  );
  const analysis = useMemo(() => createAdCsvBasicAnalysis(rows), [rows]);
  const campaignGroups = useMemo(() => groupAdCsvRows(rows, (row) => row.campaignName), [rows]);
  const adGroups = useMemo(() => groupAdCsvRows(rows, (row) => row.adName || row.adGroupName), [rows]);
  const keywordGroups = useMemo(() => groupAdCsvRows(rows, (row) => row.keyword), [rows]);
  const searchTermGroups = useMemo(() => groupAdCsvRows(rows, (row) => row.searchTerm), [rows]);
  const dayGroups = useMemo(() => groupAdCsvRows(rows, (row) => row.recordDate), [rows]);

  if (!selectedImport) {
    return (
      <div className="space-y-5 pb-10">
        <StatusMessage isLoading={isLoading} tone="warning">{message}</StatusMessage>
        <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm leading-6 text-stone-600">まだ広告CSVが取り込まれていません。まずはCSV取り込み画面から登録してください。</p>
          <Link className="mt-4 inline-flex min-h-11 items-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800" href="/ads/import">広告CSVを取り込む</Link>
        </div>
      </div>
    );
  }

  const isGoogleAdsApiImport = selectedImport.fileName.startsWith("google-ads-api-");
  const sourceKind =
    isGoogleAdsApiImport
      ? "api"
      : storageMode === "local"
        ? "local"
        : storageMode === "supabase"
          ? "csv"
          : "sample";
  const sourceLabel = isGoogleAdsApiImport
    ? "Google Ads API（読み取り専用）"
    : `${platformLabels[selectedImport.platform]} CSV / ${selectedImport.fileName}`;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <label className="grid min-w-0 flex-1 gap-2 text-sm font-medium text-stone-700">
          対象データ
          <select
            className="min-h-11 rounded-md border border-stone-300 bg-white px-3"
            onChange={(event) => {
              setSelectedImportId(event.target.value);
              void load(event.target.value);
            }}
            value={selectedImport.id}
          >
            {dataset.imports.map((item) => (
              <option key={item.id} value={item.id}>
                {item.periodStart}〜{item.periodEnd} / {item.fileName}
              </option>
            ))}
          </select>
        </label>
        <Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-teal-200 px-4 text-sm font-semibold text-teal-700 hover:bg-teal-50" href="/ads/import">
          CSVを取り込む
        </Link>
      </div>

      <DataScopePanel
        collected={[
          `${importTypeLabels[selectedImport.importType]}別の広告費・表示回数・クリック数・CTR・コンバージョン・CPC・CPA`,
          "前回取り込み期間との比較と、しきい値に基づく改善候補",
          "キャンペーン名の完全一致による広告メモ・広告案との関連候補",
        ]}
        description="この集計は、選択した広告データだけを対象にしています。複数の媒体や期間の数値を合算した画面ではありません。"
        limitations={[
          "Google広告APIは読み取り専用です。配信開始・停止・予算変更・除外キーワード登録は行いません。",
          "Meta・Instagram広告は現時点ではCSV取り込みが必要です。公式APIからの自動取得は行いません。",
          "LP URL・デバイス・地域などは、CSVに含まれるか、Google広告APIで取得できる項目だけが表示されます。",
        ]}
        period={`${selectedImport.periodStart}〜${selectedImport.periodEnd}`}
        sourceKind={sourceKind}
        sourceLabel={sourceLabel}
        updatedAt={selectedImport.updatedAt}
      />

      <StatusMessage isLoading={isLoading} tone={storageMode === "supabase" ? "info" : "warning"}>{message}</StatusMessage>

      <section className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <MetricCard label="広告費" value={formatYen(metrics.totalCost)} />
        <MetricCard label="表示回数" value={metrics.totalImpressions.toLocaleString("ja-JP")} />
        <MetricCard label="クリック" value={metrics.totalClicks.toLocaleString("ja-JP")} />
        <MetricCard label="平均CTR" value={formatPercent(metrics.averageCtr)} />
        <MetricCard label="CV" value={metrics.totalConversions.toLocaleString("ja-JP")} />
        <MetricCard label="平均CPC" value={formatYen(metrics.averageCpc)} />
        <MetricCard label="平均CPA" value={formatYen(metrics.averageCpa)} />
        <MetricCard label="正常行" value={`${selectedImport.validRowCount.toLocaleString("ja-JP")}件`} />
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-stone-950">{comparison.label}との比較</h2>
        {comparison.hasComparison ? (
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Change label="広告費" value={formatPercentChange(comparison.totalCost.percentChange)} />
            <Change label="クリック" value={formatPercentChange(comparison.totalClicks.percentChange)} />
            <Change label="CTR" value={`${signed(comparison.averageCtrPointChange)}ポイント`} />
            <Change label="CPA" value={comparison.averageCpa.percentChange === null ? "比較不可" : formatPercentChange(comparison.averageCpa.percentChange)} />
          </dl>
        ) : <p className="mt-3 text-sm text-stone-500">比較データなし</p>}
      </section>

      <CandidateSection analysis={analysis} />
      <GroupTable campaigns={campaigns} creatives={creatives} groups={campaignGroups} title="キャンペーン別集計" />
      <GroupTable campaigns={campaigns} creatives={creatives} groups={adGroups} title="広告別集計" />
      <GroupTable campaigns={campaigns} creatives={creatives} groups={keywordGroups} title="キーワード別集計" />
      <GroupTable campaigns={campaigns} creatives={creatives} groups={searchTermGroups} title="検索語句別集計" />
      <GroupTable campaigns={campaigns} creatives={creatives} groups={dayGroups} title="日別推移" />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return <article className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-stone-500 sm:text-sm">{label}</p><p className="mt-2 text-xl font-semibold text-stone-950 sm:text-2xl">{value}</p></article>;
}

function Change({ label, value }: { label: string; value: string }) {
  return <div className="border-l-2 border-teal-500 pl-3"><dt className="text-xs text-stone-500">{label}</dt><dd className="mt-1 font-semibold text-stone-950">{value}</dd></div>;
}

function signed(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function formatPercentChange(value: number | null) {
  return value === null ? "比較不可" : `${signed(value)}%`;
}

function CandidateSection({ analysis }: { analysis: ReturnType<typeof createAdCsvBasicAnalysis> }) {
  const candidates = [
    ...analysis.lowCtrItems,
    ...analysis.highCpaItems,
    ...analysis.clicksNoConversionItems,
    ...analysis.negativeSearchTerms,
    ...analysis.lpImprovementItems,
    ...analysis.costSpikeDays,
  ].slice(0, 16);

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-950">改善候補</h2>
          <p className="mt-1 text-sm text-stone-500">Geminiを使わず、しきい値だけで見つけた確認候補です。</p>
        </div>
        <Badge tone="info">{candidates.length}件</Badge>
      </div>
      {candidates.length > 0 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {candidates.map((item) => <CandidateCard item={item} key={`${item.category}-${item.key}`} />)}
        </div>
      ) : (
        <p className="mt-4 rounded-md bg-stone-50 p-4 text-sm text-stone-500">現在のしきい値では大きな改善候補は見つかりませんでした。</p>
      )}
    </section>
  );
}

function CandidateCard({ item }: { item: AdCsvImprovementCandidate }) {
  return (
    <article className="rounded-md border border-stone-200 p-3">
      <p className="break-words text-sm font-semibold text-stone-950">{item.key || "未取得"}</p>
      <p className="mt-2 text-xs leading-5 text-stone-600">{item.reason}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-500">
        <span>費用 {formatYen(item.metrics.totalCost)}</span>
        <span>CTR {formatPercent(item.metrics.averageCtr)}</span>
        <span>CPA {formatYen(item.metrics.averageCpa)}</span>
      </div>
    </article>
  );
}

function GroupTable({
  campaigns,
  creatives,
  groups,
  title,
}: {
  campaigns: AdCampaignNote[];
  creatives: AdCreative[];
  groups: AdCsvGroupSummary[];
  title: string;
}) {
  if (groups.length === 0) return null;
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-semibold text-stone-950">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-xs text-stone-500">
              <th className="px-3 py-2">対象</th>
              <th className="px-3 py-2">費用</th>
              <th className="px-3 py-2">表示</th>
              <th className="px-3 py-2">クリック</th>
              <th className="px-3 py-2">CTR</th>
              <th className="px-3 py-2">CV</th>
              <th className="px-3 py-2">CPA</th>
              <th className="px-3 py-2">連携候補</th>
            </tr>
          </thead>
          <tbody>
            {groups.slice(0, 20).map((group) => {
              const campaignMatches = campaigns.filter((campaign) => campaign.campaignName === group.campaignName || campaign.campaignName === group.key);
              const creativeMatches = creatives.filter((creative) => creative.campaignName === group.campaignName || creative.campaignName === group.key);
              return (
                <tr className="border-b border-stone-100 last:border-0" key={`${title}-${group.key}`}>
                  <td className="max-w-80 break-words px-3 py-3 font-semibold text-stone-900">{group.key}</td>
                  <td className="px-3 py-3">{formatYen(group.totalCost)}</td>
                  <td className="px-3 py-3">{group.totalImpressions.toLocaleString("ja-JP")}</td>
                  <td className="px-3 py-3">{group.totalClicks.toLocaleString("ja-JP")}</td>
                  <td className="px-3 py-3">{formatPercent(group.averageCtr)}</td>
                  <td className="px-3 py-3">{group.totalConversions.toLocaleString("ja-JP")}</td>
                  <td className="px-3 py-3">{formatYen(group.averageCpa)}</td>
                  <td className="min-w-40 px-3 py-3 text-xs text-stone-500">
                    {campaignMatches.length > 0 || creativeMatches.length > 0
                      ? `広告メモ${campaignMatches.length}件 / 広告案${creativeMatches.length}件`
                      : "完全一致なし"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
