"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusMessage } from "@/components/ui/StatusMessage";
import type { AdCampaignNote } from "@/types/seoAds";
import type {
  AdCreative,
  AdCreativeGenerateResponse,
  AdCreativeInput,
  AdCreativeStatus,
} from "@/types/adCreative";

type StatusTone = "neutral" | "info" | "success" | "warning" | "error";

const creativesStorageKey = "hair-trend-ad-creatives";
const campaignStorageKey = "hair-trend-ad-campaign-notes";

const platforms = [
  "Google検索広告",
  "Googleディスプレイ広告",
  "Instagram広告",
  "Facebook広告",
  "Meta広告",
  "LINE誘導用広告",
  "その他",
];

const objectives = [
  "LINE相談を増やす",
  "新規予約を増やす",
  "髪質改善メニューを知ってもらう",
  "縮毛矯正の相談を増やす",
  "大人女性向けの認知を増やす",
  "ブログ記事への流入を増やす",
  "LPへのアクセスを増やす",
];

const statuses: AdCreativeStatus[] = [
  "draft",
  "reviewing",
  "approved",
  "used",
  "archived",
];

const statusLabels: Record<AdCreativeStatus, string> = {
  approved: "承認済み",
  archived: "保管",
  draft: "下書き",
  reviewing: "確認中",
  used: "使用済み",
};

const emptyForm: AdCreativeInput = {
  budgetMemo: "",
  campaignId: "",
  campaignName: "松江市 髪質改善 広告",
  currentIssue: "LINE相談までの導線をもう少し分かりやすくしたい",
  desiredCta: "LINEで相談・予約する",
  inputKeywords: ["松江 髪質改善", "松江 縮毛矯正", "40代 髪質改善"],
  landingPageUrl: "https://ef-mayke-s.com/",
  mainAppeal: "髪質改善・縮毛矯正のLINE相談",
  memo: "",
  objective: "LINE相談を増やす",
  platform: "Google検索広告",
  targetArea: "松江市と周辺地域",
  targetAudience: "40代以降の、うねり・広がりに悩む大人女性",
  tone: "丁寧で上品",
};

function safeJsonList<T>(value: string | null, fallback: T[]) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as T[];
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function textToList(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function listToText(value: string[]) {
  return value.join("\n");
}

function createLocalClone(creative: AdCreative): AdCreative {
  const now = new Date().toISOString();
  return {
    ...creative,
    campaignName: `${creative.campaignName} コピー`,
    createdAt: now,
    id: `local-ad-creative-${Date.now()}`,
    status: "draft",
    updatedAt: now,
  };
}

function flattenCopy(items: string[]) {
  return items.filter(Boolean).join("\n");
}

function CharacterCount({ limit, text }: { limit: number; text: string }) {
  const isLong = text.length > limit;
  return (
    <span className={isLong ? "text-rose-700" : "text-stone-500"}>
      {text.length}/{limit}字目安{isLong ? " 長め" : ""}
    </span>
  );
}

function CopyButton({
  label = "コピー",
  onCopy,
}: {
  label?: string;
  onCopy: () => void;
}) {
  return (
    <button
      className="min-h-9 rounded-md border border-stone-300 px-3 text-xs font-semibold text-stone-700 hover:bg-stone-50"
      onClick={onCopy}
      type="button"
    >
      {label}
    </button>
  );
}

function TextInput({
  label,
  onChange,
  placeholder,
  required = false,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-stone-700">
      {label}
      <input
        className="min-h-11 rounded-md border border-stone-300 px-3 font-normal"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        value={value}
      />
    </label>
  );
}

function TextArea({
  label,
  onChange,
  placeholder,
  rows = 4,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-stone-700">
      {label}
      <textarea
        className="rounded-md border border-stone-300 p-3 font-normal leading-6"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        value={value}
      />
    </label>
  );
}

function CopyListSection({
  characterLimit,
  items,
  onCopy,
  title,
}: {
  characterLimit?: number;
  items: string[];
  onCopy: (text: string) => void;
  title: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-stone-950">{title}</h3>
        <CopyButton onCopy={() => onCopy(flattenCopy(items))} />
      </div>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-700">
        {items.map((item, index) => (
          <li className="rounded-md bg-stone-50 p-3" key={`${title}-${index}-${item}`}>
            <div className="flex flex-wrap justify-between gap-2">
              <span className="whitespace-pre-wrap">{item}</span>
              {characterLimit ? (
                <CharacterCount limit={characterLimit} text={item} />
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CreativeDetail({
  creative,
  onCopy,
}: {
  creative: AdCreative;
  onCopy: (text: string) => void;
}) {
  const content = creative.generatedContent;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold">{creative.aiProvider === "gemini" ? "Gemini広告案" : "モック広告案"}</p>
            <h2 className="mt-1 text-lg font-semibold">{creative.campaignName}</h2>
          </div>
          <Badge tone={creative.aiProvider === "gemini" ? "success" : "warning"}>
            {creative.aiModel}
          </Badge>
        </div>
        <p className="mt-3 whitespace-pre-wrap">{content.summary}</p>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <CopyListSection
          characterLimit={30}
          items={content.googleSearchAds.headlines}
          onCopy={onCopy}
          title="Google検索広告 見出し案"
        />
        <CopyListSection
          characterLimit={90}
          items={content.googleSearchAds.descriptions}
          onCopy={onCopy}
          title="Google検索広告 説明文案"
        />
        <CopyListSection
          items={content.googleSearchAds.keywords}
          onCopy={onCopy}
          title="キーワード案"
        />
        <CopyListSection
          items={content.googleSearchAds.negativeKeywords}
          onCopy={onCopy}
          title="除外キーワード候補"
        />
        <CopyListSection
          items={[
            ...content.instagramAds.shortCopies,
            ...content.instagramAds.bodyCopies,
            ...content.instagramAds.storyCopies,
          ]}
          onCopy={onCopy}
          title="Instagram広告文案"
        />
        <CopyListSection
          items={[...content.instagramAds.reelIdeas, ...content.instagramAds.imageIdeas]}
          onCopy={onCopy}
          title="リール・画像構成案"
        />
        <CopyListSection
          items={[
            ...content.facebookAds.headlines,
            ...content.facebookAds.bodyCopies,
            ...content.facebookAds.descriptions,
          ]}
          onCopy={onCopy}
          title="Facebook広告文案"
        />
        <CopyListSection
          items={content.ctaSuggestions}
          onCopy={onCopy}
          title="CTA案"
        />
        <CopyListSection
          items={content.lpImprovementSuggestions}
          onCopy={onCopy}
          title="LP改善案"
        />
        <CopyListSection
          items={content.abTestIdeas}
          onCopy={onCopy}
          title="A/Bテスト案"
        />
        <CopyListSection
          items={content.cautionExpressions}
          onCopy={onCopy}
          title="注意すべき表現"
        />
        <CopyListSection
          items={content.recommendedMetrics}
          onCopy={onCopy}
          title="次に確認する指標"
        />
      </div>
    </div>
  );
}

export function AdCreativeManager() {
  const [form, setForm] = useState<AdCreativeInput>(emptyForm);
  const [campaigns, setCampaigns] = useState<AdCampaignNote[]>([]);
  const [creatives, setCreatives] = useState<AdCreative[]>([]);
  const [generated, setGenerated] = useState<AdCreative | null>(null);
  const [selectedCreativeId, setSelectedCreativeId] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("条件を入力して、広告文・CTA・LP改善案を生成してください。");
  const [tone, setTone] = useState<StatusTone>("info");
  const [storageMode, setStorageMode] = useState<"supabase" | "local">("local");
  const [memoDrafts, setMemoDrafts] = useState<Record<string, string>>({});

  const selectedCreative = useMemo(
    () => creatives.find((creative) => creative.id === selectedCreativeId) ?? generated,
    [creatives, generated, selectedCreativeId],
  );

  useEffect(() => {
    const localTimer = window.setTimeout(() => {
      setCampaigns(
        safeJsonList<AdCampaignNote>(
          window.localStorage.getItem(campaignStorageKey),
          [],
        ),
      );
      setCreatives(
        safeJsonList<AdCreative>(
          window.localStorage.getItem(creativesStorageKey),
          [],
        ),
      );
    }, 0);

    fetch("/api/ads/creatives", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as {
          creatives?: AdCreative[];
          mode?: "supabase" | "local";
        };
        if (response.ok && data.mode === "supabase") {
          setCreatives(data.creatives ?? []);
          setStorageMode("supabase");
          setMessage("Supabaseに保存済みの広告案を読み込みました。");
          setTone("success");
        }
      })
      .catch(() => {
        setStorageMode("local");
      });

    return () => window.clearTimeout(localTimer);
  }, []);

  function persistLocal(nextCreatives: AdCreative[]) {
    setCreatives(nextCreatives);
    window.localStorage.setItem(creativesStorageKey, JSON.stringify(nextCreatives));
  }

  function loadCampaign(id: string) {
    const campaign = campaigns.find((item) => item.id === id);
    if (!campaign) return;
    setForm((current) => ({
      ...current,
      budgetMemo: campaign.budgetMemo,
      campaignId: campaign.id,
      campaignName: campaign.campaignName,
      currentIssue: campaign.memo,
      inputKeywords: [campaign.offer, campaign.purpose].filter(Boolean),
      landingPageUrl: campaign.landingPageUrl,
      mainAppeal: campaign.offer || current.mainAppeal,
      objective: campaign.purpose || current.objective,
      platform:
        campaign.platform === "Google広告"
          ? "Google検索広告"
          : campaign.platform === "Instagram広告"
            ? "Instagram広告"
            : campaign.platform,
      targetArea: campaign.targetArea,
      targetAudience: campaign.targetAudience,
    }));
    setMessage("広告メモから条件を読み込みました。必要に応じて調整してください。");
    setTone("info");
  }

  function loadCreativeToForm(creative: AdCreative) {
    setSelectedCreativeId(creative.id);
    setForm({
      budgetMemo: creative.budgetMemo,
      campaignId: creative.campaignId,
      campaignName: creative.campaignName,
      currentIssue: creative.currentIssue,
      desiredCta: creative.desiredCta,
      inputKeywords: creative.inputKeywords,
      landingPageUrl: creative.landingPageUrl,
      mainAppeal: creative.mainAppeal,
      memo: creative.memo,
      objective: creative.objective,
      platform: creative.platform,
      targetArea: creative.targetArea,
      targetAudience: creative.targetAudience,
      tone: creative.tone,
    });
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("コピーしました。");
      setTone("success");
    } catch {
      setMessage("コピーできませんでした。テキストを選択してコピーしてください。");
      setTone("warning");
    }
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsGenerating(true);
    setTone("info");
    setMessage("Geminiで広告案を生成しています。");

    try {
      const response = await fetch("/api/ads/creatives/generate", {
        body: JSON.stringify(form),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as AdCreativeGenerateResponse & {
        error?: string;
      };

      if (!response.ok || !data.creative) {
        throw new Error(data.error || "広告案を生成できませんでした。");
      }

      setGenerated(data.creative);
      setSelectedCreativeId("");
      setTone(data.generationMode === "gemini" ? "success" : "warning");
      setMessage(data.notice || `${data.providerLabel}で広告案を生成しました。`);
    } catch (error) {
      setTone("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "広告案生成に失敗しました。時間をおいてもう一度お試しください。",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function saveCreative(creative: AdCreative) {
    setIsSaving(true);
    try {
      const response = await fetch("/api/ads/creatives", {
        body: JSON.stringify({ creative }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as { creative?: AdCreative; error?: string };

      if (!response.ok || !data.creative) {
        throw new Error(data.error || "Supabaseへ保存できませんでした。");
      }

      setCreatives((current) => [data.creative as AdCreative, ...current]);
      setSelectedCreativeId(data.creative.id);
      setStorageMode("supabase");
      setTone("success");
      setMessage("広告案をSupabaseへ保存しました。");
    } catch {
      const localCreative = {
        ...creative,
        id: creative.id.startsWith("local-")
          ? creative.id
          : `local-${creative.id}-${Date.now()}`,
      };
      persistLocal([localCreative, ...creatives]);
      setSelectedCreativeId(localCreative.id);
      setStorageMode("local");
      setTone("warning");
      setMessage("Supabase保存に失敗したため、この端末内に保存しました。SQLと環境変数を確認してください。");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateCreativeStatus(id: string, status: AdCreativeStatus) {
    const target = creatives.find((creative) => creative.id === id);
    if (!target) return;
    const updated = { ...target, status, updatedAt: new Date().toISOString() };

    if (storageMode === "supabase" && !id.startsWith("local-")) {
      try {
        const response = await fetch("/api/ads/creatives", {
          body: JSON.stringify({ id, status }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        const data = (await response.json()) as { creative?: AdCreative };
        if (response.ok && data.creative) {
          setCreatives((current) =>
            current.map((creative) =>
              creative.id === id ? (data.creative as AdCreative) : creative,
            ),
          );
          setTone("success");
          setMessage("ステータスを更新しました。");
          return;
        }
      } catch {
        // Local fallback below.
      }
    }

    persistLocal(creatives.map((creative) => (creative.id === id ? updated : creative)));
    setTone("warning");
    setMessage("この端末内でステータスを更新しました。");
  }

  async function updateCreativeMemo(id: string) {
    const target = creatives.find((creative) => creative.id === id);
    if (!target) return;
    const memo = memoDrafts[id] ?? target.memo;
    const updated = { ...target, memo, updatedAt: new Date().toISOString() };

    if (storageMode === "supabase" && !id.startsWith("local-")) {
      try {
        const response = await fetch("/api/ads/creatives", {
          body: JSON.stringify({ id, memo }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        const data = (await response.json()) as { creative?: AdCreative };
        if (response.ok && data.creative) {
          setCreatives((current) =>
            current.map((creative) =>
              creative.id === id ? (data.creative as AdCreative) : creative,
            ),
          );
          setTone("success");
          setMessage("メモを保存しました。");
          return;
        }
      } catch {
        // Local fallback below.
      }
    }

    persistLocal(creatives.map((creative) => (creative.id === id ? updated : creative)));
    setTone("warning");
    setMessage("この端末内でメモを保存しました。");
  }

  async function deleteCreative(id: string) {
    if (!window.confirm("この広告案を削除しますか？")) return;
    if (storageMode === "supabase" && !id.startsWith("local-")) {
      try {
        const response = await fetch("/api/ads/creatives", {
          body: JSON.stringify({ id }),
          headers: { "Content-Type": "application/json" },
          method: "DELETE",
        });
        if (!response.ok) throw new Error("delete failed");
      } catch {
        setTone("error");
        setMessage("Supabaseの広告案を削除できませんでした。時間をおいて再度お試しください。");
        return;
      }
    }
    const nextCreatives = creatives.filter((creative) => creative.id !== id);
    persistLocal(nextCreatives);
    if (selectedCreativeId === id) setSelectedCreativeId("");
    setTone("warning");
    setMessage("広告案を削除しました。");
  }

  function duplicateCreative(creative: AdCreative) {
    const duplicated = createLocalClone(creative);
    persistLocal([duplicated, ...creatives]);
    setSelectedCreativeId(duplicated.id);
    setTone("success");
    setMessage("広告案を複製しました。");
  }

  return (
    <div className="space-y-6 pb-10">
      <StatusMessage isLoading={isGenerating || isSaving} tone={tone}>
        {message}
      </StatusMessage>

      <section className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <form
          className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5"
          onSubmit={handleGenerate}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-stone-950">Gemini広告案生成</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                広告文、CTA、LP改善案、除外キーワード、A/Bテスト案を作成します。
              </p>
            </div>
            <Badge tone="success">出稿操作なし</Badge>
          </div>

          {campaigns.length > 0 ? (
            <label className="mt-5 grid gap-2 text-sm font-semibold text-stone-700">
              広告メモから読み込み
              <select
                className="min-h-11 rounded-md border border-stone-300 bg-white px-3 font-normal"
                onChange={(event) => loadCampaign(event.target.value)}
                value=""
              >
                <option value="">選択してください</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.campaignName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-semibold text-stone-700">
              広告媒体
              <select
                className="min-h-11 rounded-md border border-stone-300 bg-white px-3 font-normal"
                onChange={(event) =>
                  setForm((current) => ({ ...current, platform: event.target.value }))
                }
                value={form.platform}
              >
                {platforms.map((platform) => (
                  <option key={platform}>{platform}</option>
                ))}
              </select>
            </label>
            <TextInput
              label="キャンペーン名"
              onChange={(value) => setForm((current) => ({ ...current, campaignName: value }))}
              required
              value={form.campaignName}
            />
            <label className="grid gap-2 text-sm font-semibold text-stone-700">
              広告目的
              <select
                className="min-h-11 rounded-md border border-stone-300 bg-white px-3 font-normal"
                onChange={(event) =>
                  setForm((current) => ({ ...current, objective: event.target.value }))
                }
                value={form.objective}
              >
                {objectives.map((objective) => (
                  <option key={objective}>{objective}</option>
                ))}
              </select>
            </label>
            <TextInput
              label="対象エリア"
              onChange={(value) => setForm((current) => ({ ...current, targetArea: value }))}
              value={form.targetArea}
            />
            <TextArea
              label="想定ターゲット"
              onChange={(value) => setForm((current) => ({ ...current, targetAudience: value }))}
              rows={3}
              value={form.targetAudience}
            />
            <TextInput
              label="訴求テーマ"
              onChange={(value) => setForm((current) => ({ ...current, mainAppeal: value }))}
              value={form.mainAppeal}
            />
            <TextArea
              label="対策キーワード（1行に1つ）"
              onChange={(value) =>
                setForm((current) => ({ ...current, inputKeywords: textToList(value) }))
              }
              rows={4}
              value={listToText(form.inputKeywords)}
            />
            <TextInput
              label="LP URL"
              onChange={(value) => setForm((current) => ({ ...current, landingPageUrl: value }))}
              value={form.landingPageUrl}
            />
            <TextInput
              label="予算メモ"
              onChange={(value) => setForm((current) => ({ ...current, budgetMemo: value }))}
              placeholder="例: 月3万円以内でテスト"
              value={form.budgetMemo}
            />
            <TextArea
              label="現在の課題"
              onChange={(value) => setForm((current) => ({ ...current, currentIssue: value }))}
              rows={3}
              value={form.currentIssue}
            />
            <TextInput
              label="希望するCTA"
              onChange={(value) => setForm((current) => ({ ...current, desiredCta: value }))}
              value={form.desiredCta}
            />
            <TextInput
              label="広告トーン"
              onChange={(value) => setForm((current) => ({ ...current, tone: value }))}
              value={form.tone}
            />
            <TextArea
              label="メモ"
              onChange={(value) => setForm((current) => ({ ...current, memo: value }))}
              rows={3}
              value={form.memo}
            />
            <button
              className="min-h-11 rounded-md bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isGenerating}
              type="submit"
            >
              {isGenerating ? "生成中..." : "広告案を生成"}
            </button>
          </div>
        </form>

        <section className="space-y-4">
          {selectedCreative ? (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  className="min-h-10 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={isSaving}
                  onClick={() => saveCreative(selectedCreative)}
                  type="button"
                >
                  保存
                </button>
                <button
                  className="min-h-10 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700"
                  onClick={() => duplicateCreative(selectedCreative)}
                  type="button"
                >
                  複製
                </button>
                <button
                  className="min-h-10 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700"
                  onClick={() => loadCreativeToForm(selectedCreative)}
                  type="button"
                >
                  編集する
                </button>
              </div>
              <CreativeDetail creative={selectedCreative} onCopy={copyToClipboard} />
            </>
          ) : (
            <EmptyState
              description="左のフォームから広告案を生成すると、ここにコピーしやすい形で表示されます。"
              title="広告案はまだありません"
            />
          )}
        </section>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-stone-950">保存した広告案</h2>
            <p className="mt-1 text-sm text-stone-600">
              保存先: {storageMode === "supabase" ? "Supabase" : "この端末"}
            </p>
          </div>
          <Badge tone="info">{creatives.length}件</Badge>
        </div>
        {creatives.length === 0 ? (
          <EmptyState
            description="生成した広告案を保存すると、ここから詳細確認、複製、ステータス変更ができます。"
            title="保存した広告案はまだありません"
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {creatives.map((creative) => (
              <article
                className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                key={creative.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="info">{creative.platform}</Badge>
                      <Badge tone={creative.status === "approved" ? "success" : "neutral"}>
                        {statusLabels[creative.status]}
                      </Badge>
                      <Badge tone={creative.aiProvider === "gemini" ? "success" : "warning"}>
                        {creative.aiProvider === "gemini" ? "Gemini" : "Mock"}
                      </Badge>
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-stone-950">
                      {creative.campaignName}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-stone-600">
                      {creative.generatedContent.summary}
                    </p>
                  </div>
                </div>
                <dl className="mt-4 grid gap-3 rounded-lg bg-stone-50 p-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold text-stone-700">目的</dt>
                    <dd className="mt-1 text-stone-600">{creative.objective}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-stone-700">対象</dt>
                    <dd className="mt-1 text-stone-600">{creative.targetAudience}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-stone-700">作成日</dt>
                    <dd className="mt-1 text-stone-600">
                      {new Date(creative.createdAt).toLocaleString("ja-JP")}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-stone-700">更新日</dt>
                    <dd className="mt-1 text-stone-600">
                      {new Date(creative.updatedAt).toLocaleString("ja-JP")}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="min-h-10 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white"
                    onClick={() => setSelectedCreativeId(creative.id)}
                    type="button"
                  >
                    詳細を見る
                  </button>
                  <button
                    className="min-h-10 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700"
                    onClick={() => duplicateCreative(creative)}
                    type="button"
                  >
                    複製
                  </button>
                  <button
                    className="min-h-10 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700"
                    onClick={() => loadCreativeToForm(creative)}
                    type="button"
                  >
                    編集
                  </button>
                  <button
                    className="min-h-10 rounded-md border border-teal-200 px-3 text-sm font-semibold text-teal-700"
                    onClick={() => {
                      loadCreativeToForm(creative);
                      setMessage("条件をフォームへ戻しました。調整して再生成してください。");
                      setTone("info");
                    }}
                    type="button"
                  >
                    再生成
                  </button>
                  <button
                    className="min-h-10 rounded-md border border-rose-200 px-3 text-sm font-semibold text-rose-700"
                    onClick={() => deleteCreative(creative.id)}
                    type="button"
                  >
                    削除
                  </button>
                </div>
                <label className="mt-4 grid gap-2 text-sm font-semibold text-stone-700">
                  ステータス
                  <select
                    className="min-h-10 rounded-md border border-stone-300 bg-white px-3 font-normal"
                    onChange={(event) =>
                      updateCreativeStatus(
                        creative.id,
                        event.target.value as AdCreativeStatus,
                      )
                    }
                    value={creative.status}
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {statusLabels[status]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-4 grid gap-2 text-sm font-semibold text-stone-700">
                  メモ
                  <textarea
                    className="min-h-20 rounded-md border border-stone-300 p-3 font-normal"
                    onChange={(event) =>
                      setMemoDrafts((current) => ({
                        ...current,
                        [creative.id]: event.target.value,
                      }))
                    }
                    value={memoDrafts[creative.id] ?? creative.memo}
                  />
                </label>
                <button
                  className="mt-3 min-h-10 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700"
                  onClick={() => updateCreativeMemo(creative.id)}
                  type="button"
                >
                  メモを保存
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
