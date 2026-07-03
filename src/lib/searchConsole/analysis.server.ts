import {
  generateAiText,
  isGeminiConfigured,
  parseGeminiJson,
} from "@/lib/ai/server";
import { getSalonPromptContext } from "@/lib/salonProfile";
import { searchConsoleMockAnalysis } from "@/data/searchConsole";
import type {
  SearchConsoleBasicAnalysis,
  SearchConsoleComparison,
  SearchConsoleMetrics,
  SearchConsoleSeoAnalysis,
} from "@/types/searchConsole";

type AnalysisContext = {
  periodLabel: string;
  metrics: SearchConsoleMetrics;
  comparison: SearchConsoleComparison;
  basic: SearchConsoleBasicAnalysis;
  seoKeywords: Array<{ keyword: string; intent: string; targetPage: string }>;
  blogSummaries: Array<{ title: string; targetKeyword: string; excerpt: string }>;
};

const responseSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    positivePoints: { type: "array", items: { type: "string" } },
    negativePoints: { type: "array", items: { type: "string" } },
    priorityKeywords: {
      type: "array",
      items: {
        type: "object",
        properties: {
          keyword: { type: "string" },
          reason: { type: "string" },
          recommendedAction: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["keyword", "reason", "recommendedAction", "priority"],
      },
    },
    priorityPages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          url: { type: "string" },
          reason: { type: "string" },
          recommendedAction: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["url", "reason", "recommendedAction", "priority"],
      },
    },
    titleSuggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          keyword: { type: "string" },
          currentTitle: { type: "string" },
          suggestedTitle: { type: "string" },
          reason: { type: "string" },
        },
        required: ["keyword", "currentTitle", "suggestedTitle", "reason"],
      },
    },
    metaDescriptionSuggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          pageUrl: { type: "string" },
          suggestedDescription: { type: "string" },
          reason: { type: "string" },
        },
        required: ["pageUrl", "suggestedDescription", "reason"],
      },
    },
    rewriteSuggestions: { type: "array", items: { type: "string" } },
    newArticleIdeas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          targetKeyword: { type: "string" },
          title: { type: "string" },
          searchIntent: { type: "string" },
          reason: { type: "string" },
        },
        required: ["targetKeyword", "title", "searchIntent", "reason"],
      },
    },
    internalLinkSuggestions: { type: "array", items: { type: "string" } },
    ctaSuggestions: { type: "array", items: { type: "string" } },
    monthlyTasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          taskType: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          reason: { type: "string" },
          keyword: { type: "string" },
          pageUrl: { type: "string" },
        },
        required: ["title", "taskType", "priority", "reason", "keyword", "pageUrl"],
      },
    },
    nextMonthGoals: { type: "array", items: { type: "string" } },
  },
  required: [
    "summary",
    "positivePoints",
    "negativePoints",
    "priorityKeywords",
    "priorityPages",
    "titleSuggestions",
    "metaDescriptionSuggestions",
    "rewriteSuggestions",
    "newArticleIdeas",
    "internalLinkSuggestions",
    "ctaSuggestions",
    "monthlyTasks",
    "nextMonthGoals",
  ],
};

function text(value: unknown, maxLength = 600) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function textList(value: unknown, maxItems = 12) {
  return Array.isArray(value)
    ? value.map((item) => text(item, 500)).filter(Boolean).slice(0, maxItems)
    : [];
}

function priority(value: unknown): "high" | "medium" | "low" {
  return value === "high" || value === "low" ? value : "medium";
}

function objectList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === "object"),
      )
    : [];
}

function normalizeAnalysis(
  value: Record<string, unknown>,
  model: string,
): SearchConsoleSeoAnalysis {
  const fallback = searchConsoleMockAnalysis;
  return {
    analyzedAt: new Date().toISOString(),
    ctaSuggestions: textList(value.ctaSuggestions),
    internalLinkSuggestions: textList(value.internalLinkSuggestions),
    metaDescriptionSuggestions: objectList(value.metaDescriptionSuggestions)
      .map((item) => ({
        pageUrl: text(item.pageUrl, 500) || "未取得",
        reason: text(item.reason),
        suggestedDescription: text(item.suggestedDescription, 180),
      }))
      .filter((item) => item.suggestedDescription),
    model,
    monthlyTasks: objectList(value.monthlyTasks)
      .map((item) => ({
        keyword: text(item.keyword, 120),
        pageUrl: text(item.pageUrl, 500),
        priority: priority(item.priority),
        reason: text(item.reason),
        taskType: text(item.taskType, 60) || "technical_check",
        title: text(item.title, 160),
      }))
      .filter((item) => item.title),
    negativePoints: textList(value.negativePoints),
    newArticleIdeas: objectList(value.newArticleIdeas)
      .map((item) => ({
        reason: text(item.reason),
        searchIntent: text(item.searchIntent),
        targetKeyword: text(item.targetKeyword, 120),
        title: text(item.title, 160),
      }))
      .filter((item) => item.targetKeyword && item.title),
    nextMonthGoals: textList(value.nextMonthGoals),
    positivePoints: textList(value.positivePoints),
    priorityKeywords: objectList(value.priorityKeywords)
      .map((item) => ({
        keyword: text(item.keyword, 120),
        priority: priority(item.priority),
        reason: text(item.reason),
        recommendedAction: text(item.recommendedAction),
      }))
      .filter((item) => item.keyword),
    priorityPages: objectList(value.priorityPages)
      .map((item) => ({
        priority: priority(item.priority),
        reason: text(item.reason),
        recommendedAction: text(item.recommendedAction),
        url: text(item.url, 500),
      }))
      .filter((item) => item.url),
    provider: "gemini",
    providerLabel: "Gemini API",
    rewriteSuggestions: textList(value.rewriteSuggestions),
    summary: text(value.summary, 1200) || fallback.summary,
    titleSuggestions: objectList(value.titleSuggestions)
      .map((item) => ({
        currentTitle: "未取得",
        keyword: text(item.keyword, 120),
        reason: text(item.reason),
        suggestedTitle: text(item.suggestedTitle, 160),
      }))
      .filter((item) => item.suggestedTitle),
  };
}

function compactCandidate(item: { key: string; clicks: number; impressions: number; ctr: number; position: number; reason: string }) {
  return {
    clicks: item.clicks,
    ctrPercent: Number((item.ctr * 100).toFixed(2)),
    impressions: item.impressions,
    key: item.key,
    position: Number(item.position.toFixed(1)),
    reason: item.reason,
  };
}

export async function generateSearchConsoleAnalysis(context: AnalysisContext) {
  if (!isGeminiConfigured()) {
    return { ...searchConsoleMockAnalysis, analyzedAt: new Date().toISOString() };
  }

  const compactContext = {
    blogSummaries: context.blogSummaries.slice(0, 12),
    comparison: context.comparison,
    ctrCandidates: context.basic.highImpressionsLowCtr.map(compactCandidate),
    improvementPages: context.basic.improvementPages.map(compactCandidate),
    metrics: context.metrics,
    period: context.periodLabel,
    positionCandidates: [
      ...context.basic.positionElevenToTwenty,
      ...context.basic.positionTwentyOneToThirty,
    ].slice(0, 20).map(compactCandidate),
    positionDown: context.basic.positionDown.map(compactCandidate),
    seoKeywords: context.seoKeywords.slice(0, 20),
    topKeywords: context.basic.topKeywords.slice(0, 20).map((item) => ({
      clicks: item.clicks,
      ctrPercent: Number((item.ctr * 100).toFixed(2)),
      impressions: item.impressions,
      keyword: item.query,
      position: Number(item.position.toFixed(1)),
    })),
    topPages: context.basic.topPages.slice(0, 20).map((item) => ({
      clicks: item.clicks,
      ctrPercent: Number((item.ctr * 100).toFixed(2)),
      impressions: item.impressions,
      pageUrl: item.pageUrl,
      position: Number(item.position.toFixed(1)),
    })),
  };

  const result = await generateAiText({
    feature: "search-console-seo-analysis",
    maxOutputTokens: 4200,
    systemInstruction: [
      "あなたは美容室のGoogle Search Consoleデータを分析する日本語SEO担当者です。",
      getSalonPromptContext(),
      "計算は入力済みの数値だけを使い、存在しないデータ、口コミ、施術事例を作らないでください。",
      "CSVにページタイトルは含まれていません。currentTitleは必ず『未取得』にしてください。",
      "自動公開や自動書き換えを提案せず、人が確認して実行できる小さな改善作業にしてください。",
    ].join("\n\n"),
    prompt: [
      "以下はアプリ側で計算・抽出済みのSearch Console要約です。全行データではありません。",
      "今月の総評、良い点、悪い点、優先キーワード・ページ、タイトルと説明文、リライト、新規記事、内部リンク、LINE導線、月次タスク、次月目標を、説明文やコードフェンスを付けずJSONオブジェクトだけで返してください。",
      `JSON構造: ${JSON.stringify(responseSchema)}`,
      JSON.stringify(compactContext),
    ].join("\n\n"),
  });

  return normalizeAnalysis(
    parseGeminiJson<Record<string, unknown>>(result.text),
    result.model,
  );
}
