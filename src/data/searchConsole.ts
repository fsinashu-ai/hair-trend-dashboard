import { createSearchConsoleBasicAnalysis, summarizeSearchConsoleRows } from "@/lib/searchConsole/metrics";
import type {
  SearchConsoleDataset,
  SearchConsoleImport,
  SearchConsoleRow,
  SearchConsoleSeoAnalysis,
} from "@/types/searchConsole";

const currentRows: SearchConsoleRow[] = [
  { rowType: "query", query: "松江 髪質改善", pageUrl: "", device: "", country: "", recordDate: "", clicks: 34, impressions: 2400, ctr: 0.0142, position: 8.2 },
  { rowType: "query", query: "松江 縮毛矯正", pageUrl: "", device: "", country: "", recordDate: "", clicks: 19, impressions: 1580, ctr: 0.012, position: 12.6 },
  { rowType: "query", query: "40代 髪質改善", pageUrl: "", device: "", country: "", recordDate: "", clicks: 7, impressions: 920, ctr: 0.0076, position: 17.4 },
  { rowType: "query", query: "髪のうねり 松江", pageUrl: "", device: "", country: "", recordDate: "", clicks: 0, impressions: 310, ctr: 0, position: 22.1 },
  { rowType: "query", query: "大人女性 美容室 松江", pageUrl: "", device: "", country: "", recordDate: "", clicks: 4, impressions: 260, ctr: 0.0154, position: 9.8 },
];

const previousRows: SearchConsoleRow[] = [
  { rowType: "query", query: "松江 髪質改善", pageUrl: "", device: "", country: "", recordDate: "", clicks: 28, impressions: 1900, ctr: 0.0147, position: 9.1 },
  { rowType: "query", query: "松江 縮毛矯正", pageUrl: "", device: "", country: "", recordDate: "", clicks: 22, impressions: 1320, ctr: 0.0167, position: 11.4 },
  { rowType: "query", query: "40代 髪質改善", pageUrl: "", device: "", country: "", recordDate: "", clicks: 4, impressions: 610, ctr: 0.0066, position: 19.2 },
];

function createImport(
  id: string,
  fileName: string,
  periodStart: string,
  periodEnd: string,
  reportMonth: string,
  rows: SearchConsoleRow[],
  createdAt: string,
): SearchConsoleImport {
  return {
    comparisonLabel: "前月",
    contentHash: id,
    createdAt,
    errorMessage: "",
    excludedRowCount: 0,
    fileName,
    id,
    importType: "query",
    memo: "画面確認用のサンプルデータ",
    metrics: summarizeSearchConsoleRows(rows),
    periodEnd,
    periodStart,
    reportMonth,
    rowCount: rows.length,
    status: "analyzed",
    updatedAt: createdAt,
    warningCount: 0,
  };
}

export const searchConsoleMockAnalysis: SearchConsoleSeoAnalysis = {
  analyzedAt: "2026-06-21T00:00:00.000Z",
  ctaSuggestions: ["記事末尾だけでなく、悩みの説明後にもLINE相談への短い案内を置く"],
  internalLinkSuggestions: ["髪質改善記事から縮毛矯正の解説記事へ内部リンクを追加する"],
  metaDescriptionSuggestions: [
    {
      pageUrl: "未取得",
      reason: "表示回数に対してCTRが低いため",
      suggestedDescription: "松江市で髪のうねりや広がりに悩む大人女性へ。髪質改善と縮毛矯正の違いを丁寧に解説します。",
    },
  ],
  model: "mock",
  monthlyTasks: [
    { title: "髪質改善ページのタイトル修正", taskType: "title_update", priority: "high", reason: "表示回数が多い一方でCTRが低いため", keyword: "松江 髪質改善" },
    { title: "縮毛矯正ページへFAQを追加", taskType: "faq_update", priority: "high", reason: "11位から20位のリライト候補のため", keyword: "松江 縮毛矯正" },
  ],
  negativePoints: ["主要キーワードのCTRが2%未満です", "縮毛矯正関連の順位が下がっています"],
  newArticleIdeas: [
    { targetKeyword: "40代 髪質改善", title: "40代から増える髪の広がり。松江で髪質改善を考える前に知りたいこと", searchIntent: "年齢による髪質変化の相談先と施術の考え方を知りたい", reason: "表示回数が増え、11位から20位にいるため" },
  ],
  nextMonthGoals: ["主要3キーワードのCTRを0.5ポイント改善する", "11位から20位の記事を2件リライトする"],
  positivePoints: ["松江 髪質改善の表示回数と順位が改善しています", "40代向けテーマの検索需要が増えています"],
  priorityKeywords: [
    { keyword: "松江 髪質改善", priority: "high", reason: "表示回数が最も多くCTRが低いため", recommendedAction: "タイトルとメタディスクリプションを見直す" },
    { keyword: "松江 縮毛矯正", priority: "high", reason: "掲載順位が11位から20位にあるため", recommendedAction: "FAQと施術判断の説明を追加する" },
  ],
  priorityPages: [],
  provider: "mock",
  providerLabel: "モック分析",
  rewriteSuggestions: ["縮毛矯正記事に、向いている方・注意点・施術履歴の確認項目を追加する"],
  summary: "今月は「松江 髪質改善」と「松江 縮毛矯正」の表示回数が増えています。一方でCTRが低いため、ページタイトルとメタディスクリプションの見直しを優先してください。",
  titleSuggestions: [
    { keyword: "松江 髪質改善", currentTitle: "未取得", suggestedTitle: "松江で髪質改善を考えている方へ｜ef.mayke`s", reason: "地域と悩みを自然に伝えるため" },
  ],
};

const currentImport = createImport("search-console-demo-current", "Queries-2026-06.csv", "2026-06-01", "2026-06-20", "2026-06-01", currentRows, "2026-06-21T00:00:00.000Z");
const previousImport = createImport("search-console-demo-previous", "Queries-2026-05.csv", "2026-05-01", "2026-05-31", "2026-05-01", previousRows, "2026-06-01T00:00:00.000Z");

export const dummySearchConsoleDataset: SearchConsoleDataset = {
  analysesByImport: { [currentImport.id]: searchConsoleMockAnalysis },
  imports: [currentImport, previousImport],
  rowsByImport: {
    [currentImport.id]: currentRows,
    [previousImport.id]: previousRows,
  },
};

export const dummySearchConsoleBasicAnalysis = createSearchConsoleBasicAnalysis(
  currentRows,
  previousRows,
);

