"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AiAnalysisPanel } from "@/components/marketing/AiAnalysisPanel";
import { DataScopePanel } from "@/components/marketing/DataScopePanel";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { dummyAdCampaignNotes, seoMockAnalysis } from "@/data/seoAds";
import { formatPercent, formatYen } from "@/lib/ads/adCsvAnalysis";
import {
  adCsvStorageEventName,
  readLocalAdCsvDataset,
} from "@/lib/ads/adCsvLocalStorage";
import type { AdCsvImport } from "@/types/adCsv";
import type { AdCampaignNote } from "@/types/seoAds";

const storageKey = "hair-trend-ad-campaign-notes";
const storageEventName = "hair-trend-ad-campaign-notes-change";
const defaultCampaignSnapshot = JSON.stringify(dummyAdCampaignNotes);

const emptyCampaign: Omit<AdCampaignNote, "id"> = {
  adGroupName: "",
  budgetMemo: "",
  campaignName: "",
  creativeMemo: "",
  dailyBudget: 0,
  landingPageUrl: "",
  memo: "",
  monthlyBudget: 0,
  offer: "",
  platform: "Google広告",
  purpose: "",
  status: "検討中",
  targetAudience: "",
  targetArea: "松江市と周辺地域",
};

function parseCampaigns(value: string) {
  try {
    const campaigns = JSON.parse(value) as AdCampaignNote[];
    return campaigns.length ? campaigns : [];
  } catch {
    return dummyAdCampaignNotes;
  }
}

function getCampaignSnapshot() {
  return window.localStorage.getItem(storageKey) ?? defaultCampaignSnapshot;
}

function subscribeToCampaigns(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(storageEventName, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(storageEventName, onStoreChange);
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    currency: "JPY",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function toNumber(value: string) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function pickLatestImport(imports: AdCsvImport[]) {
  return [...imports].sort((first, second) => {
    const periodDiff = second.periodEnd.localeCompare(first.periodEnd);
    if (periodDiff !== 0) return periodDiff;
    return second.updatedAt.localeCompare(first.updatedAt);
  })[0] ?? null;
}

type AdsDashboardProps = {
  initialLatestImport?: AdCsvImport | null;
};

export function AdsDashboard({ initialLatestImport = null }: AdsDashboardProps) {
  const campaignSnapshot = useSyncExternalStore(
    subscribeToCampaigns,
    getCampaignSnapshot,
    () => defaultCampaignSnapshot,
  );
  const campaigns = useMemo(
    () => parseCampaigns(campaignSnapshot),
    [campaignSnapshot],
  );
  const [localLatestImport, setLocalLatestImport] = useState<AdCsvImport | null>(null);
  const [draft, setDraft] = useState(emptyCampaign);
  const [message, setMessage] = useState(
    "広告APIには接続せず、検討用のメモだけをこの端末で管理します。",
  );

  useEffect(() => {
    const syncLatestImport = () => {
      setLocalLatestImport(pickLatestImport(readLocalAdCsvDataset().imports));
    };

    syncLatestImport();
    window.addEventListener(adCsvStorageEventName, syncLatestImport);
    window.addEventListener("storage", syncLatestImport);
    return () => {
      window.removeEventListener(adCsvStorageEventName, syncLatestImport);
      window.removeEventListener("storage", syncLatestImport);
    };
  }, []);

  const latestImport = useMemo(() => {
    const candidates = [initialLatestImport, localLatestImport].filter(
      (item): item is AdCsvImport => Boolean(item),
    );
    return pickLatestImport(candidates);
  }, [initialLatestImport, localLatestImport]);
  const latestImportIsLocal = Boolean(
    latestImport &&
      localLatestImport?.id === latestImport.id &&
      initialLatestImport?.id !== latestImport.id,
  );
  const latestImportIsGoogleApi = Boolean(
    latestImport?.fileName.startsWith("google-ads-api-"),
  );

  const analysisContext = useMemo(
    () => ({
      campaigns,
      performance: latestImport
        ? {
            metrics: latestImport.metrics,
            period: `${latestImport.periodStart}〜${latestImport.periodEnd}`,
            source: latestImportIsGoogleApi
              ? "Google Ads API（読み取り専用）"
              : latestImportIsLocal
                ? "この端末の広告CSV"
                : "広告CSV",
          }
        : null,
      rule: "広告の自動出稿・予算変更は提案しない",
    }),
    [campaigns, latestImport, latestImportIsGoogleApi, latestImportIsLocal],
  );

  function saveCampaigns(nextCampaigns: AdCampaignNote[]) {
    window.localStorage.setItem(storageKey, JSON.stringify(nextCampaigns));
    window.dispatchEvent(new Event(storageEventName));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.campaignName.trim() || !draft.purpose.trim()) {
      setMessage("キャンペーン名と目的を入力してください。");
      return;
    }

    const newCampaign: AdCampaignNote = {
      ...draft,
      id: `ad-note-${Date.now()}`,
    };
    saveCampaigns([newCampaign, ...campaigns]);
    setDraft(emptyCampaign);
    setMessage("広告メモをこの端末に保存しました。");
  }

  function handleDelete(id: string) {
    saveCampaigns(campaigns.filter((campaign) => campaign.id !== id));
    setMessage("広告メモを削除しました。");
  }

  return (
    <div className="space-y-6 pb-10">
      <StatusMessage tone="warning">{message}</StatusMessage>

      <DataScopePanel
        collected={[
          "この画面は、広告の目的・対象エリア・予算メモ・LP・訴求案を手入力で管理します。",
          "広告費、クリック、CTR、コンバージョン、CPAなどの成果値はここでは分析しません。",
          "Google広告の実績は、公式API取得または広告CSV集計で確認します。",
        ]}
        description="広告メモと広告実績を分けて管理します。ここで登録する内容は運用方針のメモであり、広告媒体の配信結果ではありません。"
        limitations={[
          "Meta・Instagram広告は、現時点では公式API連携をしていません。CSVを取り込んだ結果だけを集計できます。",
          "Google広告APIは読み取り専用です。出稿、停止、予算変更はアプリから行いません。",
        ]}
        sourceKind="manual"
        sourceLabel="広告運用メモ（この端末のブラウザ保存）"
      />

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          className="rounded-lg border border-teal-200 bg-teal-50 p-4 shadow-sm transition hover:bg-teal-100"
          href="/ads/google"
        >
          <p className="text-sm font-semibold text-teal-800">Google広告の実績を見る</p>
          <p className="mt-2 text-sm leading-6 text-teal-950">
            公式APIから、指定した期間のキャンペーン・広告・キーワード・検索語句を読み取り専用で取得します。
          </p>
        </Link>
        <Link
          className="rounded-lg border border-sky-200 bg-sky-50 p-4 shadow-sm transition hover:bg-sky-100"
          href="/ads/imports"
        >
          <p className="text-sm font-semibold text-sky-800">CSVの実績を集計する</p>
          <p className="mt-2 text-sm leading-6 text-sky-950">
            Google・Meta・InstagramなどのCSVを取り込み、広告費・CTR・CPA・改善候補を確認します。
          </p>
        </Link>
      </section>

      {latestImport ? (
        <>
          <DataScopePanel
            collected={[
              "広告費・表示回数・クリック数・CTR・コンバージョン・CPC・CPA",
              "選択された1件の広告API取得または広告CSV取り込みの集計値",
              "広告CSV集計画面でのキャンペーン別・広告別の改善候補",
            ]}
            description="最新の広告実績を表示しています。広告メモの計画値と、媒体から取得した配信結果を分けて確認できます。"
            href="/ads/imports"
            limitations={[
              "このカードは最新の1件の取り込みデータだけを表示します。複数期間の合算ではありません。",
              "Google広告APIは読み取り専用です。Meta・InstagramはCSV取り込みが必要です。",
            ]}
            linkLabel="広告実績の詳細を見る"
            period={`${latestImport.periodStart}〜${latestImport.periodEnd}`}
            sourceKind={latestImportIsLocal ? "local" : latestImportIsGoogleApi ? "api" : "csv"}
            sourceLabel={
              latestImportIsLocal
                ? `この端末の広告CSV / ${latestImport.fileName}`
                : latestImportIsGoogleApi
                  ? "Google Ads API（読み取り専用）"
                  : `広告CSV / ${latestImport.fileName}`
            }
            updatedAt={latestImport.updatedAt}
            title="最新広告実績"
          />
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <PerformanceMetric label="広告費" value={formatYen(latestImport.metrics.totalCost)} />
            <PerformanceMetric label="表示回数" value={latestImport.metrics.totalImpressions.toLocaleString("ja-JP")} />
            <PerformanceMetric label="クリック" value={latestImport.metrics.totalClicks.toLocaleString("ja-JP")} />
            <PerformanceMetric label="CTR" value={formatPercent(latestImport.metrics.averageCtr)} />
            <PerformanceMetric label="CV" value={latestImport.metrics.totalConversions.toLocaleString("ja-JP")} />
            <PerformanceMetric label="CPA" value={formatYen(latestImport.metrics.averageCpa)} />
          </section>
        </>
      ) : (
        <StatusMessage tone="warning">
          広告実績はまだ取り込まれていません。Google広告APIまたは広告CSVから取得すると、ここに最新値が表示されます。
        </StatusMessage>
      )}

      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-stone-950">広告メモを追加</h2>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            分析と下書き用です。広告出稿や予算変更は実行しません。
          </p>
        </div>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
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
            目的
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 font-normal"
              onChange={(event) =>
                setDraft((current) => ({ ...current, purpose: event.target.value }))
              }
              placeholder="例：LINE相談の獲得"
              value={draft.purpose}
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
              <option>検討中</option>
              <option>配信中</option>
              <option>停止中</option>
              <option>終了</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-stone-700">
            対象エリア
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 font-normal"
              onChange={(event) =>
                setDraft((current) => ({ ...current, targetArea: event.target.value }))
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
              placeholder="例：40代以降のくせ毛・広がりに悩む女性"
              value={draft.targetAudience}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-stone-700">
            月予算
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 font-normal"
              min="0"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  monthlyBudget: toNumber(event.target.value),
                }))
              }
              placeholder="30000"
              type="number"
              value={draft.monthlyBudget || ""}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-stone-700">
            日予算
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 font-normal"
              min="0"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  dailyBudget: toNumber(event.target.value),
                }))
              }
              placeholder="1000"
              type="number"
              value={draft.dailyBudget || ""}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-stone-700">
            予算メモ
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 font-normal"
              onChange={(event) =>
                setDraft((current) => ({ ...current, budgetMemo: event.target.value }))
              }
              placeholder="例：月3万円以内でテスト"
              value={draft.budgetMemo}
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
            提案内容・オファー
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 font-normal"
              onChange={(event) =>
                setDraft((current) => ({ ...current, offer: event.target.value }))
              }
              placeholder="例：髪質や施術履歴をLINEで事前相談"
              value={draft.offer}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-stone-700 sm:col-span-2">
            訴求・クリエイティブメモ
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 font-normal"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  creativeMemo: event.target.value,
                }))
              }
              placeholder="例：Before/Afterは許可済み素材のみ。断定表現を避ける"
              value={draft.creativeMemo}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-stone-700 sm:col-span-2">
            メモ
            <textarea
              className="min-h-24 rounded-md border border-stone-300 p-3 font-normal"
              onChange={(event) =>
                setDraft((current) => ({ ...current, memo: event.target.value }))
              }
              placeholder="確認したいことや改善案を記録します"
              value={draft.memo}
            />
          </label>
          <div className="sm:col-span-2">
            <button
              className="min-h-11 rounded-md bg-stone-950 px-5 text-sm font-semibold text-white hover:bg-stone-800"
              type="submit"
            >
              メモを保存
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-stone-950">広告管理メモ</h2>
        {campaigns.length === 0 ? (
          <EmptyState
            description="上の入力欄から、検討中のキャンペーンを登録してください。"
            title="広告メモはまだありません"
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {campaigns.map((campaign) => (
              <article
                className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
                key={campaign.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="info">{campaign.platform}</Badge>
                      <Badge tone="neutral">{campaign.status || "検討中"}</Badge>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-stone-950">
                      {campaign.campaignName}
                    </h3>
                    {campaign.adGroupName ? (
                      <p className="mt-1 text-sm text-stone-500">
                        {campaign.adGroupName}
                      </p>
                    ) : null}
                  </div>
                  <button
                    className="min-h-10 rounded-md border border-rose-200 px-3 text-sm font-semibold text-rose-700"
                    onClick={() => handleDelete(campaign.id)}
                    type="button"
                  >
                    削除
                  </button>
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold text-stone-700">目的</dt>
                    <dd className="mt-1 text-stone-600">{campaign.purpose}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-stone-700">対象エリア</dt>
                    <dd className="mt-1 text-stone-600">{campaign.targetArea}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-stone-700">想定ターゲット</dt>
                    <dd className="mt-1 text-stone-600">
                      {campaign.targetAudience || "未入力"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-stone-700">予算</dt>
                    <dd className="mt-1 text-stone-600">
                      月 {formatCurrency(campaign.monthlyBudget || 0)} / 日{" "}
                      {formatCurrency(campaign.dailyBudget || 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-stone-700">予算メモ</dt>
                    <dd className="mt-1 text-stone-600">
                      {campaign.budgetMemo || "未入力"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-stone-700">LP URL</dt>
                    <dd className="mt-1 break-all text-stone-600">
                      {campaign.landingPageUrl || "未入力"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 space-y-2 border-t border-stone-100 pt-4 text-sm leading-6 text-stone-600">
                  <p>
                    <span className="font-semibold text-stone-700">提案内容: </span>
                    {campaign.offer || "未入力"}
                  </p>
                  <p>
                    <span className="font-semibold text-stone-700">訴求メモ: </span>
                    {campaign.creativeMemo || "未入力"}
                  </p>
                  <p>{campaign.memo || "メモはまだありません。"}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <AiAnalysisPanel
        context={analysisContext}
        fallbackText={seoMockAnalysis}
        isUsingRealData={Boolean(latestImport)}
        scope="ads"
        title="広告メモのAI改善提案"
      />
    </div>
  );
}

function PerformanceMetric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-stone-950 sm:text-xl">{value}</p>
    </article>
  );
}
