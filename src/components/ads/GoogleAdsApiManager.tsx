"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adCsvImportTypes } from "@/config/adCsv";
import { addLocalAdCsvImport, readLocalAdCsvDataset } from "@/lib/ads/adCsvLocalStorage";
import { formatPercent, formatYen } from "@/lib/ads/adCsvAnalysis";
import { StatusMessage } from "@/components/ui/StatusMessage";
import type {
  AdCsvImport,
  AdCsvImportType,
  AdCsvPreview,
} from "@/types/adCsv";

type StatusTone = "info" | "success" | "warning" | "error";

type ConfigStatus = {
  apiVersion: string;
  configured: boolean;
  customerIdSet: boolean;
  loginCustomerIdSet: boolean;
  missing: string[];
};

const googleImportTypes = adCsvImportTypes.filter((item) =>
  ["campaign", "ad_group", "ad", "keyword", "search_term", "daily"].includes(item.value),
);

const today = new Date();
const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

export function GoogleAdsApiManager() {
  const [importType, setImportType] = useState<AdCsvImportType>("campaign");
  const [periodStart, setPeriodStart] = useState(`${defaultMonth}-01`);
  const [periodEnd, setPeriodEnd] = useState(today.toISOString().slice(0, 10));
  const [reportMonth, setReportMonth] = useState(defaultMonth);
  const [comparisonLabel, setComparisonLabel] = useState("前回期間");
  const [memo, setMemo] = useState("Google広告APIから取得");
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);
  const [preview, setPreview] = useState<AdCsvPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tone, setTone] = useState<StatusTone>("info");
  const [message, setMessage] = useState("Google広告APIの設定確認中です。");

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/ads/google/fetch");
      const data = (await response.json()) as {
        googleAds?: ConfigStatus;
        storageMode?: "supabase" | "local";
      };
      setConfigStatus(data.googleAds ?? null);
      if (data.googleAds?.configured) {
        setTone(data.storageMode === "supabase" ? "success" : "warning");
        setMessage(
          data.storageMode === "supabase"
            ? "Google広告APIの環境変数は設定されています。取得した結果はSupabaseへ保存します。"
            : "Google広告APIの環境変数は設定されています。Supabase未設定のため、この端末へ保存します。",
        );
      } else {
        setTone("warning");
        setMessage("Google広告APIの環境変数が不足しています。下の一覧を確認してください。");
      }
    } catch {
      setTone("warning");
      setMessage("Google広告APIの設定確認に失敗しました。環境変数を確認してください。");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStatus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadStatus]);

  function saveLocal(previewData: AdCsvPreview) {
    const local = readLocalAdCsvDataset();
    const duplicate = local.imports.find(
      (item) =>
        item.fileHash === previewData.contentHash &&
        item.fileName === previewData.fileName &&
        item.platform === "google" &&
        item.importType === previewData.detectedType &&
        item.periodStart === periodStart &&
        item.periodEnd === periodEnd &&
        item.validRowCount === previewData.validRowCount,
    );
    if (duplicate) {
      setTone("warning");
      setMessage("同じGoogle広告API取得データがこの端末に保存済みです。既存データは変更していません。");
      return;
    }

    const now = new Date().toISOString();
    const item: AdCsvImport = {
      comparisonLabel,
      createdAt: now,
      errorMessage: "",
      fileHash: previewData.contentHash,
      fileName: previewData.fileName,
      id: crypto.randomUUID(),
      importType: previewData.detectedType,
      invalidRowCount: previewData.invalidRowCount,
      memo,
      metrics: previewData.metrics,
      periodEnd,
      periodStart,
      platform: "google",
      reportMonth: `${reportMonth}-01`,
      rowCount: previewData.totalRowCount,
      status: "imported",
      updatedAt: now,
      validRowCount: previewData.validRowCount,
      warningCount: previewData.warningCount,
    };
    addLocalAdCsvImport(item, previewData.rows ?? []);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setTone("info");
    setMessage("Google広告APIからデータを取得しています。");
    setPreview(null);

    try {
      const response = await fetch("/api/ads/google/fetch", {
        body: JSON.stringify({
          comparisonLabel,
          importType,
          memo,
          periodEnd,
          periodStart,
          reportMonth,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as {
        error?: string;
        item?: AdCsvImport | null;
        message?: string;
        preview?: AdCsvPreview;
        storageMode?: "supabase" | "local";
      };
      if (!response.ok) throw new Error(data.error || "Google広告APIから取得できませんでした。");
      if (!data.preview) throw new Error("Google広告APIの取得結果を確認できませんでした。");
      setPreview(data.preview);

      if (data.storageMode === "local") {
        saveLocal(data.preview);
      }

      setTone(data.preview.validRowCount === 0 ? "warning" : "success");
      setMessage(
        data.message ??
          `${data.preview.validRowCount}件を${data.storageMode === "supabase" ? "Supabase" : "この端末"}へ保存しました。`,
      );
      window.dispatchEvent(new Event("hair-trend-ad-csv-change"));
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Google広告APIの取得に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-5 pb-10">
      <StatusMessage isLoading={isLoading} tone={tone}>{message}</StatusMessage>

      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-stone-950">Google広告API設定</h2>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <SettingItem label="APIバージョン" value={configStatus?.apiVersion ?? "未確認"} />
          <SettingItem label="顧客ID" value={configStatus?.customerIdSet ? "設定済み" : "未設定"} />
          <SettingItem label="MCCログイン顧客ID" value={configStatus?.loginCustomerIdSet ? "設定済み" : "任意 / 未設定"} />
          <SettingItem label="保存先" value="広告CSV集計テーブル" />
        </div>
        {configStatus && !configStatus.configured ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">不足している環境変数</p>
            <p className="mt-1 break-words">{configStatus.missing.join(", ")}</p>
          </div>
        ) : null}
      </section>

      <form className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            取得種別
            <select className="min-h-11 rounded-md border border-stone-300 bg-white px-3" onChange={(event) => setImportType(event.target.value as AdCsvImportType)} value={importType}>
              {googleImportTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            集計月
            <input className="min-h-11 rounded-md border border-stone-300 px-3" onChange={(event) => setReportMonth(event.target.value)} required type="month" value={reportMonth} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            開始日
            <input className="min-h-11 rounded-md border border-stone-300 px-3" onChange={(event) => setPeriodStart(event.target.value)} required type="date" value={periodStart} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            終了日
            <input className="min-h-11 rounded-md border border-stone-300 px-3" onChange={(event) => setPeriodEnd(event.target.value)} required type="date" value={periodEnd} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            比較対象期間
            <input className="min-h-11 rounded-md border border-stone-300 px-3" onChange={(event) => setComparisonLabel(event.target.value)} value={comparisonLabel} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-700 sm:col-span-2">
            メモ
            <textarea className="min-h-24 rounded-md border border-stone-300 px-3 py-2" onChange={(event) => setMemo(event.target.value)} value={memo} />
          </label>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button className="min-h-11 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60" disabled={isLoading} type="submit">
            {isLoading ? "取得中" : "Google広告APIから取得"}
          </button>
          <Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50" href="/ads/imports">
            集計を見る
          </Link>
        </div>
      </form>

      {preview ? (
        <section className="rounded-lg border border-teal-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="取得行" value={`${preview.validRowCount}件`} />
            <Metric label="広告費" value={formatYen(preview.metrics.totalCost)} />
            <Metric label="表示回数" value={preview.metrics.totalImpressions.toLocaleString("ja-JP")} />
            <Metric label="クリック" value={preview.metrics.totalClicks.toLocaleString("ja-JP")} />
            <Metric label="平均CTR" value={formatPercent(preview.metrics.averageCtr)} />
            <Metric label="CV" value={preview.metrics.totalConversions.toLocaleString("ja-JP")} />
            <Metric label="平均CPC" value={formatYen(preview.metrics.averageCpc)} />
            <Metric label="平均CPA" value={formatYen(preview.metrics.averageCpa)} />
          </div>
          <PreviewRows preview={preview} />
        </section>
      ) : null}
    </div>
  );
}

function SettingItem({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-stone-50 p-3"><p className="text-xs text-stone-500">{label}</p><p className="mt-1 font-semibold text-stone-950">{value}</p></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-stone-50 p-3"><p className="text-xs text-stone-500">{label}</p><p className="mt-1 font-semibold text-stone-950">{value}</p></div>;
}

function PreviewRows({ preview }: { preview: AdCsvPreview }) {
  if (preview.previewRows.length === 0) {
    return <p className="mt-5 rounded-md bg-stone-50 p-4 text-sm text-stone-500">該当期間の行はありませんでした。</p>;
  }

  return (
    <div className="mt-5 overflow-x-auto">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-xs text-stone-500">
            <th className="px-2 py-2">日付</th>
            <th className="px-2 py-2">キャンペーン</th>
            <th className="px-2 py-2">対象</th>
            <th className="px-2 py-2">費用</th>
            <th className="px-2 py-2">クリック</th>
            <th className="px-2 py-2">CV</th>
          </tr>
        </thead>
        <tbody>
          {preview.previewRows.map((row, index) => (
            <tr className="border-b border-stone-100" key={`${row.recordDate}-${row.campaignName}-${index}`}>
              <td className="px-2 py-3">{row.recordDate || "未取得"}</td>
              <td className="max-w-72 break-words px-2 py-3">{row.campaignName || "未取得"}</td>
              <td className="max-w-72 break-words px-2 py-3">{row.adName || row.keyword || row.searchTerm || row.adGroupName || "キャンペーン"}</td>
              <td className="px-2 py-3">{formatYen(row.cost)}</td>
              <td className="px-2 py-3">{row.clicks.toLocaleString("ja-JP")}</td>
              <td className="px-2 py-3">{row.conversions.toLocaleString("ja-JP")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
