"use client";

import type { FormEvent } from "react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { AiAnalysisPanel } from "@/components/marketing/AiAnalysisPanel";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { dummyAdCampaignNotes, seoMockAnalysis } from "@/data/seoAds";
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

export function AdsDashboard() {
  const campaignSnapshot = useSyncExternalStore(
    subscribeToCampaigns,
    getCampaignSnapshot,
    () => defaultCampaignSnapshot,
  );
  const campaigns = useMemo(
    () => parseCampaigns(campaignSnapshot),
    [campaignSnapshot],
  );
  const [draft, setDraft] = useState(emptyCampaign);
  const [message, setMessage] = useState(
    "広告APIには接続せず、検討用のメモだけをこの端末で管理します。",
  );

  const analysisContext = useMemo(
    () => ({ campaigns, rule: "広告の自動出稿・予算変更は提案しない" }),
    [campaigns],
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
        scope="ads"
        title="広告メモのAI改善提案"
      />
    </div>
  );
}
