"use client";

import type { FormEvent } from "react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { AiAnalysisPanel } from "@/components/marketing/AiAnalysisPanel";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { dummyAdReports, seoMockAnalysis } from "@/data/seoAds";
import type { AdReport } from "@/types/seoAds";

const storageKey = "hair-trend-ad-reports";
const storageEventName = "hair-trend-ad-reports-change";
const defaultReportSnapshot = JSON.stringify(dummyAdReports);

const emptyReport: Omit<AdReport, "id" | "aiAnalysis" | "nextActions"> = {
  adGroupName: "",
  campaignName: "",
  clicks: 0,
  conversions: 0,
  cost: 0,
  cpa: 0,
  ctr: 0,
  impressions: 0,
  inquiries: 0,
  landingPageUrl: "",
  offer: "",
  platform: "Google広告",
  reportMonth: new Date().toISOString().slice(0, 7),
  reservations: 0,
  status: "確認中",
  targetArea: "松江市と周辺地域",
  targetAudience: "",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    currency: "JPY",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function toNumber(value: string) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function calculateCtr(clicks: number, impressions: number) {
  return impressions > 0 ? (clicks / impressions) * 100 : 0;
}

function calculateCpa(cost: number, reservations: number, inquiries: number) {
  const conversionBase = reservations > 0 ? reservations : inquiries;
  return conversionBase > 0 ? cost / conversionBase : 0;
}

function normalizeReport(report: AdReport): AdReport {
  const ctr = report.ctr || calculateCtr(report.clicks, report.impressions);
  const inquiries = report.inquiries || 0;
  const reservations = report.reservations || 0;
  const conversions = report.conversions || inquiries + reservations;
  const cpa = report.cpa || calculateCpa(report.cost, reservations, inquiries);

  return {
    ...report,
    adGroupName: report.adGroupName || "",
    ctr,
    inquiries,
    reservations,
    conversions,
    cpa,
    targetArea: report.targetArea || "",
    targetAudience: report.targetAudience || "",
    landingPageUrl: report.landingPageUrl || "",
    offer: report.offer || "",
    status: report.status || "確認中",
  };
}

function parseReports(value: string) {
  try {
    const reports = JSON.parse(value) as AdReport[];
    return reports.map(normalizeReport);
  } catch {
    return dummyAdReports;
  }
}

function getReportSnapshot() {
  return window.localStorage.getItem(storageKey) ?? defaultReportSnapshot;
}

function subscribeToReports(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(storageEventName, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(storageEventName, onStoreChange);
  };
}

export function AdReportList() {
  const reportSnapshot = useSyncExternalStore(
    subscribeToReports,
    getReportSnapshot,
    () => defaultReportSnapshot,
  );
  const reports = useMemo(() => parseReports(reportSnapshot), [reportSnapshot]);
  const [draft, setDraft] = useState(emptyReport);
  const [message, setMessage] = useState(
    "広告APIには接続せず、手入力した広告結果だけをこの端末で管理します。",
  );

  const totals = useMemo(() => {
    const total = reports.reduce(
      (current, report) => ({
        clicks: current.clicks + report.clicks,
        cost: current.cost + report.cost,
        impressions: current.impressions + report.impressions,
        inquiries: current.inquiries + report.inquiries,
        reservations: current.reservations + report.reservations,
      }),
      { clicks: 0, cost: 0, impressions: 0, inquiries: 0, reservations: 0 },
    );

    return {
      ...total,
      cpa: calculateCpa(total.cost, total.reservations, total.inquiries),
      ctr: calculateCtr(total.clicks, total.impressions),
    };
  }, [reports]);

  const analysisContext = useMemo(
    () => ({
      reports,
      rule: "広告の自動出稿・予算変更は提案しない。改善提案と次の確認項目だけ出す。",
      totals,
    }),
    [reports, totals],
  );

  function saveReports(nextReports: AdReport[]) {
    window.localStorage.setItem(storageKey, JSON.stringify(nextReports));
    window.dispatchEvent(new Event(storageEventName));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.campaignName.trim()) {
      setMessage("キャンペーン名を入力してください。");
      return;
    }

    const ctr = calculateCtr(draft.clicks, draft.impressions);
    const cpa = calculateCpa(draft.cost, draft.reservations, draft.inquiries);
    const conversions = draft.inquiries + draft.reservations;
    const report: AdReport = {
      ...draft,
      aiAnalysis:
        "手入力データです。媒体別にCPA、CTR、予約につながった導線を確認してください。",
      conversions,
      cpa,
      ctr,
      id: `ad-report-${Date.now()}`,
      nextActions: [
        "検索語句・配信面・投稿内容を確認",
        "LPのLINE相談導線をスマホで確認",
      ],
      reportMonth: `${draft.reportMonth}-01`,
    };

    saveReports([report, ...reports]);
    setDraft(emptyReport);
    setMessage("広告レポートをこの端末に保存しました。");
  }

  function handleDelete(id: string) {
    saveReports(reports.filter((report) => report.id !== id));
    setMessage("広告レポートを削除しました。");
  }

  return (
    <section className="space-y-6 pb-10">
      <StatusMessage tone="warning">{message}</StatusMessage>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-stone-500">広告費</p>
          <p className="mt-2 text-xl font-semibold text-stone-950">
            {formatCurrency(totals.cost)}
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-stone-500">表示回数</p>
          <p className="mt-2 text-xl font-semibold text-stone-950">
            {totals.impressions.toLocaleString("ja-JP")}
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-stone-500">クリック / CTR</p>
          <p className="mt-2 text-xl font-semibold text-stone-950">
            {totals.clicks.toLocaleString("ja-JP")} / {formatPercent(totals.ctr)}
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-stone-500">問い合わせ / 予約</p>
          <p className="mt-2 text-xl font-semibold text-stone-950">
            {totals.inquiries} / {totals.reservations}
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-stone-500">CPA</p>
          <p className="mt-2 text-xl font-semibold text-stone-950">
            {formatCurrency(totals.cpa)}
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-stone-950">広告レポートを追加</h2>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            Google広告やMeta広告の管理画面で確認した数字を、月次で手入力します。
          </p>
        </div>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm font-semibold text-stone-700">
            対象月
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 font-normal"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  reportMonth: event.target.value,
                }))
              }
              type="month"
              value={draft.reportMonth}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-stone-700">
            広告媒体
            <select
              className="min-h-11 rounded-md border border-stone-300 bg-white px-3 font-normal"
              onChange={(event) =>
                setDraft((current) => ({ ...current, platform: event.target.value }))
              }
              value={draft.platform}
            >
              <option>Google広告</option>
              <option>Instagram広告</option>
              <option>Meta広告</option>
              <option>その他</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-stone-700">
            キャンペーン名
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 font-normal"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  campaignName: event.target.value,
                }))
              }
              placeholder="例：松江市 髪質改善 検索広告"
              value={draft.campaignName}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-stone-700">
            広告グループ
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 font-normal"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  adGroupName: event.target.value,
                }))
              }
              placeholder="例：髪質改善・縮毛矯正"
              value={draft.adGroupName}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-stone-700">
            広告費
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 font-normal"
              min="0"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  cost: toNumber(event.target.value),
                }))
              }
              type="number"
              value={draft.cost || ""}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-stone-700">
            表示回数
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 font-normal"
              min="0"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  impressions: toNumber(event.target.value),
                }))
              }
              type="number"
              value={draft.impressions || ""}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-stone-700">
            クリック数
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 font-normal"
              min="0"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  clicks: toNumber(event.target.value),
                }))
              }
              type="number"
              value={draft.clicks || ""}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-stone-700">
            問い合わせ数
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 font-normal"
              min="0"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  inquiries: toNumber(event.target.value),
                }))
              }
              type="number"
              value={draft.inquiries || ""}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-stone-700">
            予約数
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 font-normal"
              min="0"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  reservations: toNumber(event.target.value),
                }))
              }
              type="number"
              value={draft.reservations || ""}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-stone-700">
            ステータス
            <select
              className="min-h-11 rounded-md border border-stone-300 bg-white px-3 font-normal"
              onChange={(event) =>
                setDraft((current) => ({ ...current, status: event.target.value }))
              }
              value={draft.status}
            >
              <option>確認中</option>
              <option>改善中</option>
              <option>テスト中</option>
              <option>終了</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-stone-700">
            対象エリア
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 font-normal"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  targetArea: event.target.value,
                }))
              }
              value={draft.targetArea}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-stone-700">
            想定ターゲット
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 font-normal"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  targetAudience: event.target.value,
                }))
              }
              placeholder="例：40代以降の大人女性"
              value={draft.targetAudience}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-stone-700">
            LP URL
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 font-normal"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  landingPageUrl: event.target.value,
                }))
              }
              placeholder="https://"
              type="url"
              value={draft.landingPageUrl}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-stone-700 sm:col-span-2">
            訴求内容
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 font-normal"
              onChange={(event) =>
                setDraft((current) => ({ ...current, offer: event.target.value }))
              }
              placeholder="例：髪質改善・縮毛矯正のLINE相談"
              value={draft.offer}
            />
          </label>
          <div className="rounded-lg bg-stone-50 p-4 text-sm text-stone-700 sm:col-span-2">
            入力中の目安: CTR{" "}
            <span className="font-semibold">
              {formatPercent(calculateCtr(draft.clicks, draft.impressions))}
            </span>{" "}
            / CPA{" "}
            <span className="font-semibold">
              {formatCurrency(
                calculateCpa(draft.cost, draft.reservations, draft.inquiries),
              )}
            </span>
          </div>
          <div className="sm:col-span-2">
            <button
              className="min-h-11 rounded-md bg-stone-950 px-5 text-sm font-semibold text-white hover:bg-stone-800"
              type="submit"
            >
              レポートを保存
            </button>
          </div>
        </form>
      </section>

      {reports.length === 0 ? (
        <EmptyState
          description="上の入力欄から、Google広告やMeta広告の月次結果を登録してください。"
          title="広告レポートはまだありません"
        />
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <article
              className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm sm:p-6"
              key={report.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="info">{report.platform}</Badge>
                    <Badge tone="neutral">{report.status}</Badge>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-stone-950">
                    {report.campaignName}
                  </h2>
                  <p className="mt-1 text-sm text-stone-500">
                    {report.adGroupName || "広告グループ未入力"} /{" "}
                    {report.reportMonth.slice(0, 7)}
                  </p>
                </div>
                <button
                  className="min-h-10 rounded-md border border-rose-200 px-3 text-sm font-semibold text-rose-700"
                  onClick={() => handleDelete(report.id)}
                  type="button"
                >
                  削除
                </button>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-6">
                <div>
                  <dt className="text-xs text-stone-500">費用</dt>
                  <dd className="mt-1 font-semibold text-stone-950">
                    {formatCurrency(report.cost)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-500">表示</dt>
                  <dd className="mt-1 font-semibold text-stone-950">
                    {report.impressions.toLocaleString("ja-JP")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-500">クリック</dt>
                  <dd className="mt-1 font-semibold text-stone-950">
                    {report.clicks}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-500">CTR</dt>
                  <dd className="mt-1 font-semibold text-stone-950">
                    {formatPercent(report.ctr)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-500">問い合わせ / 予約</dt>
                  <dd className="mt-1 font-semibold text-stone-950">
                    {report.inquiries} / {report.reservations}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-500">CPA</dt>
                  <dd className="mt-1 font-semibold text-stone-950">
                    {formatCurrency(report.cpa)}
                  </dd>
                </div>
              </dl>
              <dl className="mt-5 grid gap-3 rounded-lg bg-stone-50 p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-stone-700">対象エリア</dt>
                  <dd className="mt-1 text-stone-600">{report.targetArea || "未入力"}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-stone-700">想定ターゲット</dt>
                  <dd className="mt-1 text-stone-600">
                    {report.targetAudience || "未入力"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-stone-700">LP URL</dt>
                  <dd className="mt-1 break-all text-stone-600">
                    {report.landingPageUrl || "未入力"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-stone-700">訴求内容</dt>
                  <dd className="mt-1 text-stone-600">{report.offer || "未入力"}</dd>
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
        </div>
      )}

      <AiAnalysisPanel
        context={analysisContext}
        fallbackText={seoMockAnalysis}
        scope="ads"
        title="広告レポートのAI改善提案"
      />
    </section>
  );
}
