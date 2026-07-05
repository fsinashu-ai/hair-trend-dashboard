import {
  generateAiText,
  isGeminiConfigured,
  parseGeminiJson,
} from "@/lib/ai/server";
import { getSalonPromptContext } from "@/lib/salonProfile";
import { conversionMockAnalysis } from "@/data/conversions";
import type {
  ConversionAnalysis,
  ConversionAnalysisTask,
  ConversionOpportunity,
  ConversionOverview,
} from "@/types/conversions";

const responseSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    goodSignals: { type: "array", items: { type: "string" } },
    bottlenecks: { type: "array", items: { type: "string" } },
    priorityFixes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          label: { type: "string" },
          target: { type: "string", enum: ["page", "source", "channel"] },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          reason: { type: "string" },
          recommendedAction: { type: "string" },
          pageUrl: { type: "string" },
          sourceMedium: { type: "string" },
        },
        required: ["key", "label", "target", "priority", "reason", "recommendedAction"],
      },
    },
    ctaSuggestions: { type: "array", items: { type: "string" } },
    trackingSuggestions: { type: "array", items: { type: "string" } },
    monthlyTasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          taskType: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          reason: { type: "string" },
          pageUrl: { type: "string" },
          sourceMedium: { type: "string" },
        },
        required: ["title", "taskType", "priority", "reason"],
      },
    },
    nextActions: { type: "array", items: { type: "string" } },
  },
  required: [
    "summary",
    "goodSignals",
    "bottlenecks",
    "priorityFixes",
    "ctaSuggestions",
    "trackingSuggestions",
    "monthlyTasks",
    "nextActions",
  ],
};

function text(value: unknown, maxLength = 700) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function textList(value: unknown, maxItems = 12) {
  return Array.isArray(value)
    ? value.map((item) => text(item, 500)).filter(Boolean).slice(0, maxItems)
    : [];
}

function objectList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === "object"),
      )
    : [];
}

function priority(value: unknown): "high" | "medium" | "low" {
  return value === "high" || value === "low" ? value : "medium";
}

function taskType(value: unknown): ConversionAnalysisTask["taskType"] {
  return value === "internal_link" ||
    value === "content_rewrite" ||
    value === "faq_update" ||
    value === "technical_check"
    ? value
    : "cta_update";
}

function normalizeOpportunity(item: Record<string, unknown>): ConversionOpportunity {
  return {
    conversionRate: Number(item.conversionRate ?? 0),
    key: text(item.key, 200) || text(item.label, 200) || "未分類",
    label: text(item.label, 200) || text(item.key, 200) || "未分類",
    pageUrl: text(item.pageUrl, 500) || undefined,
    priority: priority(item.priority),
    reason: text(item.reason),
    recommendedAction: text(item.recommendedAction),
    sessions: Number(item.sessions ?? 0),
    sourceMedium: text(item.sourceMedium, 200) || undefined,
    target:
      item.target === "source" || item.target === "channel" ? item.target : "page",
    totalActions: Number(item.totalActions ?? 0),
    users: Number(item.users ?? 0),
    views: Number(item.views ?? 0),
  };
}

function normalizeAnalysis(
  value: Record<string, unknown>,
  model: string,
  overview: ConversionOverview,
): ConversionAnalysis {
  return {
    analyzedAt: new Date().toISOString(),
    bottlenecks: textList(value.bottlenecks),
    ctaSuggestions: textList(value.ctaSuggestions),
    goodSignals: textList(value.goodSignals),
    model,
    monthlyTasks: objectList(value.monthlyTasks)
      .map((item) => ({
        pageUrl: text(item.pageUrl, 500),
        priority: priority(item.priority),
        reason: text(item.reason),
        sourceMedium: text(item.sourceMedium, 200),
        taskType: taskType(item.taskType),
        title: text(item.title, 160),
      }))
      .filter((item) => item.title),
    nextActions: textList(value.nextActions),
    priorityFixes: objectList(value.priorityFixes)
      .map(normalizeOpportunity)
      .filter((item) => item.reason || item.recommendedAction)
      .slice(0, 8),
    provider: "gemini",
    providerLabel: "Gemini API",
    summary:
      text(value.summary, 1200) ||
      `コンバージョン行動は合計${overview.metrics.totalActions}件です。LINE相談と予約導線を中心に確認してください。`,
    trackingSuggestions: textList(value.trackingSuggestions),
  };
}

function compactRow(item: ConversionOverview["byPage"][number]) {
  return {
    conversionRatePercent: Number((item.metrics.conversionRate * 100).toFixed(1)),
    key: item.key,
    lineClicks: item.metrics.lineClicks,
    reservationClicks: item.metrics.reservationClicks,
    sessions: item.sessions,
    sourceMedium: item.sourceMedium || item.channelGroup,
    totalActions: item.metrics.totalActions,
    users: item.users,
    views: item.views,
  };
}

export async function generateConversionAnalysis({
  overview,
  periodLabel,
}: {
  overview: ConversionOverview;
  periodLabel: string;
}) {
  if (!isGeminiConfigured()) {
    return { ...conversionMockAnalysis, analyzedAt: new Date().toISOString() };
  }

  const compactContext = {
    metrics: overview.metrics,
    opportunities: overview.opportunities.slice(0, 12),
    periodLabel,
    topChannels: overview.byChannel.slice(0, 10).map(compactRow),
    topConverters: overview.topConverters.slice(0, 12).map(compactRow),
    topPages: overview.byPage.slice(0, 12).map(compactRow),
    topSources: overview.bySource.slice(0, 12).map(compactRow),
  };

  const result = await generateAiText({
    feature: "conversion-measurement-analysis",
    maxOutputTokens: 3200,
    systemInstruction: [
      "あなたは美容室のGA4コンバージョンデータを分析する日本語の集客改善担当者です。",
      getSalonPromptContext(),
      "入力された集計値だけを使い、存在しない予約数、売上、口コミ、施術事例は作らないでください。",
      "自動出稿、広告予算変更、WordPress自動公開は提案しないでください。",
      "LINE相談、予約導線、電話、Instagram、Googleマップ、スマホ閲覧の改善に絞ってください。",
    ].join("\n\n"),
    prompt: [
      "以下はアプリ側で集計済みのGA4コンバージョン要約です。CSV全行ではありません。",
      "美容室ef.mayke`sが次に改善すべきことを、JSONオブジェクトだけで返してください。",
      `JSON構造: ${JSON.stringify(responseSchema)}`,
      JSON.stringify(compactContext),
    ].join("\n\n"),
  });

  return normalizeAnalysis(
    parseGeminiJson<Record<string, unknown>>(result.text),
    result.model,
    overview,
  );
}
