"use client";

import { FormEvent, useState } from "react";
import { ga4Config } from "@/config/ga4";
import { addLocalGa4Import, readLocalGa4Dataset } from "@/lib/ga4/localStorage";
import { StatusMessage } from "@/components/ui/StatusMessage";
import type { Ga4CsvPreview, Ga4Import } from "@/types/ga4";

type StatusTone = "info" | "success" | "warning" | "error";
type PreviewMode = "csv" | "api";

type Ga4FetchResponse = {
  duplicate?: Ga4Import;
  error?: string;
  item?: Ga4Import | null;
  preview?: Ga4CsvPreview;
  storageMode?: "supabase" | "local";
};

const today = new Date();
const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

export function Ga4ImportManager() {
  const [file, setFile] = useState<File | null>(null);
  const [propertyName, setPropertyName] = useState("ef-mayke-s.com");
  const [periodStart, setPeriodStart] = useState(`${defaultMonth}-01`);
  const [periodEnd, setPeriodEnd] = useState(today.toISOString().slice(0, 10));
  const [reportMonth, setReportMonth] = useState(defaultMonth);
  const [comparisonLabel, setComparisonLabel] = useState("前月");
  const [memo, setMemo] = useState("");
  const [preview, setPreview] = useState<Ga4CsvPreview | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("csv");
  const [isLoading, setIsLoading] = useState(false);
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [tone, setTone] = useState<StatusTone>("info");
  const [message, setMessage] = useState("GA4 CSVを選択し、対象期間を入力してください。");

  function createFormData(action: "preview" | "import") {
    const formData = new FormData();
    if (file) formData.set("file", file);
    formData.set("action", action);
    formData.set("propertyName", propertyName);
    formData.set("periodStart", periodStart);
    formData.set("periodEnd", periodEnd);
    formData.set("reportMonth", reportMonth);
    formData.set("comparisonLabel", comparisonLabel);
    formData.set("memo", memo);
    return formData;
  }

  async function send(action: "preview" | "import") {
    if (!file) {
      setTone("warning");
      setMessage("CSVファイルを選択してください。");
      return;
    }

    setIsLoading(true);
    setTone("info");
    setMessage(action === "preview" ? "GA4 CSVを確認しています。" : "GA4 CSVを取り込んでいます。");

    try {
      const response = await fetch("/api/seo/ga4/import", {
        body: createFormData(action),
        method: "POST",
      });
      const data = (await response.json()) as {
        duplicate?: Ga4Import;
        error?: string;
        item?: Ga4Import | null;
        preview?: Ga4CsvPreview;
        storageMode?: "supabase" | "local";
      };

      if (!response.ok) {
        if (data.preview) setPreview(data.preview);
        throw new Error(data.error || "CSVを処理できませんでした。");
      }
      if (!data.preview) throw new Error("CSVの確認結果を取得できませんでした。");
      setPreview(data.preview);
      setPreviewMode("csv");

      if (action === "preview") {
        setTone(data.preview.errorCount > 0 ? "warning" : "success");
        setMessage(
          `正常${data.preview.validRowCount}件、除外${data.preview.excludedRowCount}件を確認しました。内容を確認して「取り込む」を押してください。`,
        );
        return;
      }

      if (data.storageMode === "local") {
        const local = readLocalGa4Dataset();
        const duplicate = local.imports.find(
          (item) =>
            item.contentHash === data.preview?.contentHash &&
            item.periodStart === periodStart &&
            item.periodEnd === periodEnd &&
            item.rowCount === data.preview?.validRowCount,
        );
        if (duplicate) {
          setTone("warning");
          setMessage("同じ内容・期間のGA4 CSVが、この端末に登録済みです。既存データは変更していません。");
          return;
        }
        const now = new Date().toISOString();
        const item: Ga4Import = {
          comparisonLabel,
          contentHash: data.preview.contentHash,
          createdAt: now,
          errorMessage: "",
          excludedRowCount: data.preview.excludedRowCount,
          fileName: data.preview.fileName,
          id: crypto.randomUUID(),
          memo,
          metrics: data.preview.metrics,
          periodEnd,
          periodStart,
          propertyName,
          reportMonth: `${reportMonth}-01`,
          rowCount: data.preview.validRowCount,
          status: "imported",
          updatedAt: now,
          warningCount: data.preview.warningCount,
        };
        addLocalGa4Import(item, data.preview.rows ?? []);
      }

      setTone("success");
      setMessage(
        `${data.preview.validRowCount}件を${data.storageMode === "supabase" ? "Supabase" : "この端末"}へ取り込みました。`,
      );
      window.dispatchEvent(new Event("ga4-updated"));
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "CSVを処理できませんでした。");
    } finally {
      setIsLoading(false);
    }
  }

  function savePreviewToLocal(previewToSave: Ga4CsvPreview) {
    const local = readLocalGa4Dataset();
    const duplicate = local.imports.find(
      (item) =>
        item.contentHash === previewToSave.contentHash &&
        item.periodStart === periodStart &&
        item.periodEnd === periodEnd &&
        item.rowCount === previewToSave.validRowCount,
    );

    if (duplicate) {
      return false;
    }

    const now = new Date().toISOString();
    const item: Ga4Import = {
      comparisonLabel,
      contentHash: previewToSave.contentHash,
      createdAt: now,
      errorMessage: "",
      excludedRowCount: previewToSave.excludedRowCount,
      fileName: previewToSave.fileName,
      id: crypto.randomUUID(),
      memo: memo || "GA4 Data APIから取得しました。",
      metrics: previewToSave.metrics,
      periodEnd,
      periodStart,
      propertyName,
      reportMonth: `${reportMonth}-01`,
      rowCount: previewToSave.validRowCount,
      status: "imported",
      updatedAt: now,
      warningCount: previewToSave.warningCount,
    };
    addLocalGa4Import(item, previewToSave.rows ?? []);
    return true;
  }

  async function fetchFromGa4Api() {
    setIsApiLoading(true);
    setTone("info");
    setMessage("GA4 Data APIからデータを取得しています。");

    try {
      const response = await fetch("/api/seo/ga4/fetch", {
        body: JSON.stringify({
          comparisonLabel,
          endDate: periodEnd,
          memo,
          propertyName,
          reportMonth,
          startDate: periodStart,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as Ga4FetchResponse;

      if (!response.ok) {
        if (data.preview) {
          setPreview(data.preview);
          setPreviewMode("api");
        }
        throw new Error(data.error || "GA4 Data APIから取得できませんでした。");
      }
      if (!data.preview) throw new Error("GA4 Data APIの取得結果を確認できませんでした。");

      setPreview(data.preview);
      setPreviewMode("api");

      if (data.storageMode === "local") {
        const saved = savePreviewToLocal(data.preview);
        setTone(saved ? "success" : "warning");
        setMessage(
          saved
            ? `${data.preview.validRowCount}件をこの端末へ取り込みました。`
            : "同じ内容・期間のGA4 APIデータが、この端末に登録済みです。既存データは変更していません。",
        );
      } else {
        setTone("success");
        setMessage(
          `${data.preview.validRowCount}件をGA4 Data APIから取得し、Supabaseへ保存しました。`,
        );
      }

      window.dispatchEvent(new Event("ga4-updated"));
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "GA4 Data APIから取得できませんでした。");
    } finally {
      setIsApiLoading(false);
    }
  }

  function handlePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send("preview");
  }

  return (
    <div className="space-y-5 pb-10">
      <section className="rounded-lg border border-teal-200 bg-teal-50 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-teal-700">公式GA4 Data API</p>
            <h2 className="mt-1 text-lg font-semibold text-teal-950">GA4 API自動取得</h2>
            <p className="mt-2 text-sm leading-6 text-teal-900">
              サービスアカウントを設定すると、CSVを書き出さずにランディングページと流入元の数値を取得できます。
            </p>
          </div>
          <button
            className="min-h-11 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
            disabled={isApiLoading}
            onClick={() => void fetchFromGa4Api()}
            type="button"
          >
            {isApiLoading ? "取得中" : "GA4 APIで取得する"}
          </button>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="grid gap-2 text-sm font-medium text-teal-950 lg:col-span-2">
            プロパティ名
            <input
              className="min-h-11 rounded-md border border-teal-200 bg-white px-3"
              onChange={(event) => setPropertyName(event.target.value)}
              value={propertyName}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-teal-950">
            集計月
            <input
              className="min-h-11 rounded-md border border-teal-200 bg-white px-3"
              onChange={(event) => setReportMonth(event.target.value)}
              type="month"
              value={reportMonth}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-teal-950">
            開始日
            <input
              className="min-h-11 rounded-md border border-teal-200 bg-white px-3"
              onChange={(event) => setPeriodStart(event.target.value)}
              type="date"
              value={periodStart}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-teal-950">
            終了日
            <input
              className="min-h-11 rounded-md border border-teal-200 bg-white px-3"
              onChange={(event) => setPeriodEnd(event.target.value)}
              type="date"
              value={periodEnd}
            />
          </label>
        </div>
        <p className="mt-3 text-xs leading-5 text-teal-800">
          必要な環境変数: GA4_PROPERTY_ID、GOOGLE_SERVICE_ACCOUNT_EMAIL、GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY。Vercel Cronでは毎月2日朝7時ごろに前月分を自動取得します。
        </p>
      </section>

      <form className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5" onSubmit={handlePreview}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-stone-700 sm:col-span-2">
            GA4 CSV
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
              UTF-8のCSV、最大{ga4Config.maxFileBytes / 1024 / 1024}MB。ページ、流入元、イベントなどのGA4標準CSVに対応します。
            </span>
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            プロパティ名
            <input className="min-h-11 rounded-md border border-stone-300 px-3" onChange={(event) => setPropertyName(event.target.value)} value={propertyName} />
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
            <input className="min-h-11 rounded-md border border-stone-300 px-3" onChange={(event) => setComparisonLabel(event.target.value)} placeholder="例: 前月、前年同月" value={comparisonLabel} />
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

      <StatusMessage isLoading={isLoading || isApiLoading} tone={tone}>{message}</StatusMessage>

      {preview ? (
        <section className="rounded-lg border border-teal-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="正常行" value={`${preview.validRowCount}件`} />
            <Metric label="除外行" value={`${preview.excludedRowCount}件`} />
            <Metric label="ユーザー" value={`${preview.metrics.users.toLocaleString("ja-JP")}人`} />
            <Metric label="LINEクリック" value={`${preview.metrics.lineClicks.toLocaleString("ja-JP")}件`} />
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
                {preview.issues.slice(0, 10).map((issue) => (
                  <li key={`${issue.rowNumber}-${issue.message}`}>行{issue.rowNumber}: {issue.message}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {previewMode === "csv" ? (
            <button className="mt-5 min-h-11 w-full rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 sm:w-auto" disabled={isLoading || preview.validRowCount === 0} onClick={() => void send("import")} type="button">
              {isLoading ? "取り込み中" : "この内容を取り込む"}
            </button>
          ) : (
            <p className="mt-5 rounded-md bg-teal-50 p-3 text-sm leading-6 text-teal-800">
              GA4 API取得データは取得時に保存済みです。GA4分析画面で集計を確認できます。
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="border-l-2 border-teal-500 pl-3"><p className="text-xs text-stone-500">{label}</p><p className="mt-1 font-semibold text-stone-950">{value}</p></div>;
}

function PreviewTable({ preview }: { preview: Ga4CsvPreview }) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead><tr className="border-b border-stone-200 text-xs text-stone-500"><th className="px-2 py-2">ページ／流入元／イベント</th><th className="px-2 py-2">ユーザー</th><th className="px-2 py-2">セッション</th><th className="px-2 py-2">表示</th><th className="px-2 py-2">CV</th></tr></thead>
        <tbody>
          {preview.previewRows.map((row, index) => (
            <tr className="border-b border-stone-100" key={`${row.landingPage || row.pageTitle || row.sourceMedium || row.eventName}-${index}`}>
              <td className="max-w-80 break-words px-2 py-3">{previewRowLabel(row)}</td>
              <td className="px-2 py-3">{row.users}</td>
              <td className="px-2 py-3">{row.sessions}</td>
              <td className="px-2 py-3">{row.views}</td>
              <td className="px-2 py-3">{previewActionLabel(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function previewRowLabel(row: Ga4CsvPreview["previewRows"][number]) {
  const base =
    row.landingPage ||
    row.pageTitle ||
    row.sourceMedium ||
    row.channelGroup ||
    row.recordDate ||
    row.deviceCategory ||
    "未取得";

  return row.eventName ? `${base} / ${row.eventName}` : base;
}

function previewActionLabel(row: Ga4CsvPreview["previewRows"][number]) {
  const total = row.lineClicks + row.reservationClicks + row.conversions;

  if (row.lineClicks || row.reservationClicks) {
    return `${total}件（LINE ${row.lineClicks} / 予約 ${row.reservationClicks}）`;
  }

  return total;
}
