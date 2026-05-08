import type { GeneratedPost } from "@/types/generatedPost";
import type { Keyword, KeywordPriority } from "@/types/keyword";
import type { Trend, TrendCategory, TrendHeat } from "@/types/trend";
import type { RecentTrendBackup } from "./localStorage";

export type BackupSource = "local" | "supabase";

export type BackupData = {
  generatedPosts: GeneratedPost[];
  keywords: Keyword[];
  recentTrends: RecentTrendBackup[];
  trends: Trend[];
};

export type AppBackup = {
  appName: "hair-trend-dashboard";
  data: BackupData;
  exportedAt: string;
  source: BackupSource;
  version: 1;
};

const trendCategories: TrendCategory[] = [
  "レディース",
  "メンズ",
  "カラー",
  "パーマ",
  "髪質改善",
  "白髪ぼかし",
  "SNS投稿",
  "SNS運用",
  "カウンセリング",
  "店販",
  "自社サイト",
  "Instagram",
  "ヘアカタログ",
  "ヘアカラー",
  "美容ディーラー",
  "Pinterest",
  "海外トレンド",
  "YouTube",
];

const trendHeats: TrendHeat[] = ["高", "中", "低"];
const keywordPriorities: KeywordPriority[] = ["高", "中", "低"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toStringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function toNumberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function toTrendCategory(value: unknown): TrendCategory {
  if (
    value === "ショート" ||
    value === "ボブ" ||
    value === "レイヤー" ||
    value === "韓国ヘア"
  ) {
    return "レディース";
  }

  if (value === "SNS集客") {
    return "SNS運用";
  }

  if (typeof value === "string" && trendCategories.includes(value as TrendCategory)) {
    return value as TrendCategory;
  }

  return "レディース";
}

function toTrendHeat(value: unknown): TrendHeat {
  if (typeof value === "string" && trendHeats.includes(value as TrendHeat)) {
    return value as TrendHeat;
  }

  return "中";
}

function toKeywordPriority(value: unknown): KeywordPriority {
  if (
    typeof value === "string" &&
    keywordPriorities.includes(value as KeywordPriority)
  ) {
    return value as KeywordPriority;
  }

  return "中";
}

function normalizeDate(value: unknown) {
  return toStringValue(value, new Date().toISOString().slice(0, 10));
}

function normalizeTrend(value: unknown, index: number): Trend | null {
  if (!isRecord(value)) {
    return null;
  }

  const category = toTrendCategory(value.category);
  const memo = toStringValue(value.memo, toStringValue(value.summary, ""));

  return {
    category,
    heat: toTrendHeat(value.heat),
    id: toStringValue(value.id, `import-trend-${index + 1}`),
    keywords: toStringArray(value.keywords).length
      ? toStringArray(value.keywords)
      : [category],
    memo,
    publishedAt: normalizeDate(value.publishedAt),
    registeredAt: normalizeDate(value.registeredAt),
    sourceName: toStringValue(value.sourceName, "バックアップ"),
    summary: toStringValue(value.summary, memo),
    tags: toStringArray(value.tags).length ? toStringArray(value.tags) : [`#${category}`],
    title: toStringValue(value.title, `インポートしたトレンド ${index + 1}`),
    url: toStringValue(value.url, "https://example.com"),
  };
}

function normalizeKeyword(value: unknown, index: number): Keyword | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    category: toStringValue(value.category, "レディース"),
    id: toStringValue(value.id, `import-keyword-${index + 1}`),
    memo: toStringValue(value.memo, ""),
    name: toStringValue(value.name, `インポートキーワード ${index + 1}`),
    priority: toKeywordPriority(value.priority),
    useCount: Math.max(0, Math.floor(toNumberValue(value.useCount, 0))),
  };
}

function normalizeGeneratedPost(value: unknown, index: number): GeneratedPost | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    content: toStringValue(value.content, ""),
    createdAt: normalizeDate(value.createdAt),
    id: toStringValue(value.id, `import-post-${index + 1}`),
    postType: toStringValue(value.postType, "投稿案"),
    theme: toStringValue(value.theme, "美容トレンド"),
    tone: toStringValue(value.tone, "やさしく提案"),
    usedKeywords: toStringArray(value.usedKeywords),
  };
}

function normalizeRecentTrend(value: unknown, index: number): RecentTrendBackup | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    category: toStringValue(value.category, "未分類"),
    heat: toTrendHeat(value.heat),
    id: toStringValue(value.id, `import-recent-${index + 1}`),
    title: toStringValue(value.title, `最近見たトレンド ${index + 1}`),
    viewedAt: normalizeDate(value.viewedAt),
  };
}

function normalizeArray<T>(
  value: unknown,
  normalizeItem: (item: unknown, index: number) => T | null,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => normalizeItem(item, index))
    .filter((item): item is T => item !== null);
}

export function createAppBackup(data: BackupData, source: BackupSource): AppBackup {
  return {
    appName: "hair-trend-dashboard",
    data,
    exportedAt: new Date().toISOString(),
    source,
    version: 1,
  };
}

export function parseAppBackup(value: unknown): AppBackup | null {
  if (!isRecord(value) || value.appName !== "hair-trend-dashboard") {
    return null;
  }

  const data = isRecord(value.data) ? value.data : {};
  const source = value.source === "supabase" ? "supabase" : "local";

  return {
    appName: "hair-trend-dashboard",
    data: {
      generatedPosts: normalizeArray(data.generatedPosts, normalizeGeneratedPost),
      keywords: normalizeArray(data.keywords, normalizeKeyword),
      recentTrends: normalizeArray(data.recentTrends, normalizeRecentTrend),
      trends: normalizeArray(data.trends, normalizeTrend),
    },
    exportedAt: toStringValue(value.exportedAt, new Date().toISOString()),
    source,
    version: 1,
  };
}

function escapeCsvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join(" / ") : String(value ?? "");

  return `"${text.replace(/"/g, '""').replace(/\r?\n/g, "\n")}"`;
}

export function backupToCsv(backup: AppBackup) {
  const rows: string[][] = [
    [
      "種類",
      "ID",
      "タイトル/名前",
      "カテゴリ/テーマ",
      "説明",
      "メモ",
      "キーワード",
      "タグ",
      "URL",
      "日付",
      "優先度/人気",
      "利用回数",
    ],
  ];

  backup.data.trends.forEach((trend) => {
    rows.push([
      "トレンド",
      trend.id,
      trend.title,
      trend.category,
      trend.summary,
      trend.memo,
      trend.keywords.join(" / "),
      trend.tags.join(" / "),
      trend.url,
      trend.registeredAt,
      trend.heat,
      "",
    ]);
  });

  backup.data.keywords.forEach((keyword) => {
    rows.push([
      "キーワード",
      keyword.id,
      keyword.name,
      keyword.category,
      "",
      keyword.memo,
      "",
      "",
      "",
      "",
      keyword.priority,
      String(keyword.useCount),
    ]);
  });

  backup.data.generatedPosts.forEach((post) => {
    rows.push([
      "AI生成結果",
      post.id,
      post.postType,
      post.theme,
      post.content,
      "",
      post.usedKeywords.join(" / "),
      "",
      "",
      post.createdAt,
      post.tone,
      "",
    ]);
  });

  backup.data.recentTrends.forEach((trend) => {
    rows.push([
      "最近見たトレンド",
      trend.id,
      trend.title,
      trend.category,
      "",
      "",
      "",
      "",
      "",
      trend.viewedAt,
      trend.heat,
      "",
    ]);
  });

  return `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n")}`;
}
