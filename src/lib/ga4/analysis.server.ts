import {
  generateAiText,
  isGeminiConfigured,
  parseGeminiJson,
} from "@/lib/ai/server";
import { getSalonPromptContext } from "@/lib/salonProfile";
import { ga4MockAnalysis } from "@/data/ga4";
import type { EmailMetricsAnalysisContext } from "@/types/emailMetrics";
import type {
  Ga4Analysis,
  Ga4BasicAnalysis,
  Ga4Comparison,
  Ga4Metrics,
} from "@/types/ga4";

type AnalysisContext = {
  periodLabel: string;
  metrics: Ga4Metrics;
  comparison: Ga4Comparison;
  basic: Ga4BasicAnalysis;
  supplementalEmailMetrics: EmailMetricsAnalysisContext;
};

const responseSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    positivePoints: { type: "array", items: { type: "string" } },
    negativePoints: { type: "array", items: { type: "string" } },
    priorityPages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          pageUrl: { type: "string" },
          reason: { type: "string" },
          recommendedAction: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["pageUrl", "reason", "recommendedAction", "priority"],
      },
    },
    conversionIdeas: { type: "array", items: { type: "string" } },
    lineCtaSuggestions: { type: "array", items: { type: "string" } },
    contentIdeas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          targetKeyword: { type: "string" },
          title: { type: "string" },
          reason: { type: "string" },
        },
        required: ["targetKeyword", "title", "reason"],
      },
    },
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
    "positivePoints",
    "negativePoints",
    "priorityPages",
    "conversionIdeas",
    "lineCtaSuggestions",
    "contentIdeas",
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

function normalizeAnalysis(
  value: Record<string, unknown>,
  model: string,
): Ga4Analysis {
  return {
    analyzedAt: new Date().toISOString(),
    contentIdeas: objectList(value.contentIdeas)
      .map((item) => ({
        reason: text(item.reason),
        targetKeyword: text(item.targetKeyword, 120),
        title: text(item.title, 160),
      }))
      .filter((item) => item.targetKeyword && item.title),
    conversionIdeas: textList(value.conversionIdeas),
    lineCtaSuggestions: textList(value.lineCtaSuggestions),
    model,
    monthlyTasks: objectList(value.monthlyTasks)
      .map((item) => ({
        pageUrl: text(item.pageUrl, 500),
        priority: priority(item.priority),
        reason: text(item.reason),
        sourceMedium: text(item.sourceMedium, 160),
        taskType: text(item.taskType, 80) || "ga4_improvement",
        title: text(item.title, 160),
      }))
      .filter((item) => item.title),
    negativePoints: textList(value.negativePoints),
    nextActions: textList(value.nextActions),
    positivePoints: textList(value.positivePoints),
    priorityPages: objectList(value.priorityPages)
      .map((item) => ({
        pageUrl: text(item.pageUrl, 500) || "未取得",
        priority: priority(item.priority),
        reason: text(item.reason),
        recommendedAction: text(item.recommendedAction),
      }))
      .filter((item) => item.reason),
    provider: "gemini",
    providerLabel: "Gemini API",
    summary: text(value.summary, 1200) || ga4MockAnalysis.summary,
  };
}

function compactCandidate(item: {
  key: string;
  users: number;
  sessions: number;
  views: number;
  engagementRate: number;
  averageEngagementSeconds: number;
  lineClicks: number;
  reservationClicks: number;
  conversions: number;
  reason: string;
}) {
  return {
    averageEngagementSeconds: Number(item.averageEngagementSeconds.toFixed(1)),
    conversionClicks: item.lineClicks + item.reservationClicks + item.conversions,
    engagementRatePercent: Number((item.engagementRate * 100).toFixed(1)),
    key: item.key,
    reason: item.reason,
    sessions: item.sessions,
    users: item.users,
    views: item.views,
  };
}

export async function generateGa4Analysis(context: AnalysisContext) {
  if (!isGeminiConfigured()) {
    return { ...ga4MockAnalysis, analyzedAt: new Date().toISOString() };
  }

  const compactContext = {
    comparison: context.comparison,
    conversionPages: context.basic.conversionPages.map(compactCandidate),
    highUsersNoConversion: context.basic.highUsersNoConversion.map(compactCandidate),
    highViewsLowEngagement:
      context.basic.highViewsLowEngagement.map(compactCandidate),
    lineOpportunityPages: context.basic.lineOpportunityPages.map(compactCandidate),
    metrics: context.metrics,
    period: context.periodLabel,
    supplementalEmailMetrics: context.supplementalEmailMetrics,
    topLandingPages: context.basic.topLandingPages
      .slice(0, 20)
      .map(compactCandidate),
    topSources: context.basic.topSources.slice(0, 20).map(compactCandidate),
  };

  const result = await generateAiText({
    feature: "ga4-seo-conversion-analysis",
    maxOutputTokens: 3600,
    systemInstruction: [
      "あなたは美容室のGA4データを分析する日本語の集客改善担当者です。",
      getSalonPromptContext(),
      "計算は入力済みの集計値だけを使い、存在しない予約数、口コミ、施術事例を作らないでください。",
      "Google API連携、広告自動出稿、WordPress自動更新は提案しないでください。",
      "SEO記事、LINE相談導線、ページ改善、スマホ閲覧の改善に絞って、人が確認して実行できる提案にしてください。",
      "メール月次レポートはGA4とは別集計です。GA4へ加算せず、欠測や差異を説明する補完コンテキストとしてだけ使ってください。",
    ].join("\n\n"),
    prompt: [
      "以下はアプリ側で集計済みのGA4要約と、メール月次レポートの補完要約です。CSVやメールの全件ではありません。",
      "総評、良い点、悪い点、優先ページ、コンバージョン改善、LINE CTA、ブログ案、月次タスク、次の行動をJSONオブジェクトだけで返してください。",
      `JSON構造: ${JSON.stringify(responseSchema)}`,
      JSON.stringify(compactContext),
    ].join("\n\n"),
  });

  return normalizeAnalysis(
    parseGeminiJson<Record<string, unknown>>(result.text),
    result.model,
  );
}
