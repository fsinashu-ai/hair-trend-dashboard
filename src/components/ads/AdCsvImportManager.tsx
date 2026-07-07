"use client";

import { FormEvent, useState } from "react";
import { adCsvConfig, adCsvImportTypes, adCsvPlatforms } from "@/config/adCsv";
import { addLocalAdCsvImport, readLocalAdCsvDataset } from "@/lib/ads/adCsvLocalStorage";
import { formatPercent, formatYen } from "@/lib/ads/adCsvAnalysis";
import { StatusMessage } from "@/components/ui/StatusMessage";
import type {
  AdCsvImport,
  AdCsvImportType,
  AdCsvPlatform,
  AdCsvPreview,
} from "@/types/adCsv";

type StatusTone = "info" | "success" | "warning" | "error";

const today = new Date();
const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

export function AdCsvImportManager() {
  const [file, setFile] = useState<File | null>(null);
  const [platform, setPlatform] = useState<AdCsvPlatform>("google");
  const [importType, setImportType] = useState<AdCsvImportType>("campaign");
  const [periodStart, setPeriodStart] = useState(`${defaultMonth}-01`);
  const [periodEnd, setPeriodEnd] = useState(today.toISOString().slice(0, 10));
  const [reportMonth, setReportMonth] = useState(defaultMonth);
  const [comparisonLabel, setComparisonLabel] = useState("前回期間");
  const [memo, setMemo] = useState("");
  const [preview, setPreview] = useState<AdCsvPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tone, setTone] = useState<StatusTone>("info");
  const [message, setMessage] = useState("広告CSVを選び、媒体・期間を入力してから確認してください。");

  function createFormData(action: "preview" | "import") {
    const formData = new FormData();
    if (file) formData.set("file", file);
    formData.set("action", action);
    formData.set("platform", platform);
    formData.set("importType", importType);
    formData.set("periodStart", periodStart);
    formData.set("periodEnd", periodEnd);
    formData.set("reportMonth", reportMonth);
    formData.set("comparisonLabel", comparisonLabel);
    formData.set("memo", memo);
    return formData;
  }

  function saveLocal(previewData: AdCsvPreview) {
    const local = readLocalAdCsvDataset();
    const duplicate = local.imports.find(
      (item) =>
        item.fileHash === previewData.contentHash &&
        item.fileName === previewData.fileName &&
        item.platform === platform &&
        item.importType === previewData.detectedType &&
        item.periodStart === periodStart &&
        item.periodEnd === periodEnd &&
        item.validRowCount === previewData.validRowCount,
    );
    if (duplicate) {
      setTone("warning");
      setMessage("同じ広告CSVがこの端末に保存済みです。既存データは変更していません。");
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
      platform,
      reportMonth: `${reportMonth}-01`,
      rowCount: previewData.totalRowCount,
      status: "imported",
      updatedAt: now,
      validRowCount: previewData.validRowCount,
      warningCount: previewData.warningCount,
    };
    addLocalAdCsvImport(item, previewData.rows ?? []);
  }

  async function send(action: "preview" | "import") {
    if (!file) {
      setTone("warning");
      setMessage("広告CSVファイルを選択してください。");
      return;
    }

    setIsLoading(true);
    setTone("info");
    setMessage(action === "preview" ? "広告CSVを確認しています。" : "広告CSVを取り込んでいます。");

    try {
      const response = await fetch("/api/ads/import", {
        body: createFormData(action),
        method: "POST",
      });
      const data = (await response.json()) as {
        duplicate?: AdCsvImport;
        error?: string;
        item?: AdCsvImport | null;
        preview?: AdCsvPreview;
        storageMode?: "supabase" | "local";
      };

      if (!response.ok) {
        if (data.preview) setPreview(data.preview);
        throw new Error(data.error || "広告CSVを処理できませんでした。");
      }
      if (!data.preview) throw new Error("広告CSVの確認結果を取得できませんでした。");
      setPreview(data.preview);

      if (action === "preview") {
        setTone(data.preview.errorCount > 0 ? "warning" : "success");
        setMessage(
          `正常行${data.preview.validRowCount}件、除外${data.preview.invalidRowCount}件を確認しました。内容を確認して「取り込む」を押してください。`,
        );
        return;
      }

      if (data.storageMode === "local") {
        saveLocal(data.preview);
      }

      setTone("success");
      setMessage(
        `${data.preview.validRowCount}件を${data.storageMode === "supabase" ? "Supabase" : "この端末"}へ取り込みました。`,
      );
      window.dispatchEvent(new Event("hair-trend-ad-csv-change"));
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "広告CSVの処理に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }

  function handlePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send("preview");
  }

  return (
    <div className="space-y-5 pb-10">
      <form className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5" onSubmit={handlePreview}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-stone-700 sm:col-span-2">
            広告CSV
            <input
              accept=".csv,text/csv"
              className="min-h-11 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPreview(null);
              }}
              required
              type="file"
            />
            <span className="text-xs font-normal text-stone-500">
              CSVのみ、最大{adCsvConfig.maxFileBytes / 1024 / 1024}MB。UTF-8、BOM付きUTF-8、Shift_JISに対応します。
            </span>
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            広告媒体
            <select className="min-h-11 rounded-md border border-stone-300 bg-white px-3" onChange={(event) => setPlatform(event.target.value as AdCsvPlatform)} value={platform}>
              {adCsvPlatforms.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            データ種別
            <select className="min-h-11 rounded-md border border-stone-300 bg-white px-3" onChange={(event) => setImportType(event.target.value as AdCsvImportType)} value={importType}>
              {adCsvImportTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
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
            <input className="min-h-11 rounded-md border border-stone-300 px-3" onChange={(event) => setComparisonLabel(event.target.value)} placeholder="例：前月、前年同月" value={comparisonLabel} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-700 sm:col-span-2">
            メモ
            <textarea className="min-h-24 rounded-md border border-stone-300 px-3 py-2" onChange={(event) => setMemo(event.target.value)} value={memo} />
          </label>
        </div>
        <button className="mt-5 min-h-11 w-full rounded-md bg-stone-950 px-4 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-60 sm:w-auto" disabled={isLoading || !file} type="submit">
          {isLoading ? "確認中" : "CSVを確認する"}
        </button>
      </form>

      <StatusMessage isLoading={isLoading} tone={tone}>{message}</StatusMessage>

      {preview ? (
        <section className="rounded-lg border border-teal-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="認識した種別" value={adCsvImportTypes.find((item) => item.value === preview.detectedType)?.label ?? preview.detectedType} />
            <Metric label="正常行" value={`${preview.validRowCount}件`} />
            <Metric label="除外行" value={`${preview.invalidRowCount}件`} />
            <Metric label="警告" value={`${preview.warningCount}件`} />
            <Metric label="合計広告費" value={formatYen(preview.metrics.totalCost)} />
            <Metric label="表示回数" value={preview.metrics.totalImpressions.toLocaleString("ja-JP")} />
            <Metric label="クリック数" value={preview.metrics.totalClicks.toLocaleString("ja-JP")} />
            <Metric label="平均CTR" value={formatPercent(preview.metrics.averageCtr)} />
            <Metric label="CV" value={preview.metrics.totalConversions.toLocaleString("ja-JP")} />
            <Metric label="平均CPC" value={formatYen(preview.metrics.averageCpc)} />
            <Metric label="平均CPA" value={formatYen(preview.metrics.averageCpa)} />
          </div>

          <div className="mt-5">
            <h2 className="text-sm font-semibold text-stone-950">認識した列</h2>
            <p className="mt-2 break-words text-sm leading-6 text-stone-600">{preview.recognizedColumns.join(" / ")}</p>
          </div>

          <PreviewTable preview={preview} />

          {preview.issues.length > 0 ? (
            <div className="mt-5 border-t border-stone-100 pt-4">
              <h2 className="text-sm font-semibold text-stone-950">警告・除外内容</h2>
              <ul className="mt-2 space-y-1 text-sm text-stone-600">
                {preview.issues.slice(0, 12).map((issue) => (
                  <li key={`${issue.rowNumber}-${issue.message}`}>行{issue.rowNumber}: {issue.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <button className="mt-5 min-h-11 w-full rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 sm:w-auto" disabled={isLoading || preview.validRowCount === 0} onClick={() => void send("import")} type="button">
            {isLoading ? "取り込み中" : "この内容を取り込む"}
          </button>
        </section>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-stone-50 p-3"><p className="text-xs text-stone-500">{label}</p><p className="mt-1 font-semibold text-stone-950">{value}</p></div>;
}

function PreviewTable({ preview }: { preview: AdCsvPreview }) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-xs text-stone-500">
            <th className="px-2 py-2">キャンペーン</th>
            <th className="px-2 py-2">広告/キーワード</th>
            <th className="px-2 py-2">表示</th>
            <th className="px-2 py-2">クリック</th>
            <th className="px-2 py-2">CTR</th>
            <th className="px-2 py-2">費用</th>
            <th className="px-2 py-2">CV</th>
          </tr>
        </thead>
        <tbody>
          {preview.previewRows.map((row, index) => (
            <tr className="border-b border-stone-100" key={`${row.campaignName}-${row.adName}-${row.keyword}-${row.searchTerm}-${index}`}>
              <td className="max-w-72 break-words px-2 py-3">{row.campaignName || row.recordDate || "未取得"}</td>
              <td className="max-w-72 break-words px-2 py-3">{row.adName || row.keyword || row.searchTerm || row.adGroupName || "未取得"}</td>
              <td className="px-2 py-3">{row.impressions.toLocaleString("ja-JP")}</td>
              <td className="px-2 py-3">{row.clicks.toLocaleString("ja-JP")}</td>
              <td className="px-2 py-3">{formatPercent(row.ctr)}</td>
              <td className="px-2 py-3">{formatYen(row.cost)}</td>
              <td className="px-2 py-3">{row.conversions.toLocaleString("ja-JP")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
