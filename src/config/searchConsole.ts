import type { SearchConsoleImportType } from "@/types/searchConsole";

export const searchConsoleConfig = {
  aiCandidateLimit: 20,
  localStorageRowLimit: 2000,
  maxFileBytes: 5 * 1024 * 1024,
  maxImportRows: 20_000,
  previewRowLimit: 10,
  thresholds: {
    lowCtr: 0.02,
    lowCtrMinimumImpressions: 100,
    positionFourToTen: { max: 10, min: 4 },
    positionElevenToTwenty: { max: 20, min: 11 },
    positionTwentyOneToThirty: { max: 30, min: 21 },
    zeroClickMinimumImpressions: 100,
  },
} as const;

export const searchConsoleImportTypes: Array<{
  label: string;
  value: SearchConsoleImportType;
}> = [
  { label: "検索クエリ", value: "query" },
  { label: "ページ", value: "page" },
  { label: "デバイス", value: "device" },
  { label: "国", value: "country" },
  { label: "日付", value: "date" },
];

export const searchConsoleTaskTypes = [
  "title_update",
  "meta_description_update",
  "content_rewrite",
  "new_article",
  "internal_link",
  "cta_update",
  "faq_update",
  "technical_check",
] as const;

