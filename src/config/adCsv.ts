import type { AdCsvImportType, AdCsvPlatform } from "@/types/adCsv";

export const adCsvConfig = {
  localStorageRowLimit: 2000,
  maxFileBytes: 5 * 1024 * 1024,
  maxImportRows: 20_000,
  previewRowLimit: 10,
  thresholds: {
    costSpikeMultiplier: 1.8,
    highCpaMultiplier: 1.5,
    highCpcMultiplier: 2,
    lowClickRate: 0.01,
    lowCtr: 0.01,
    lowCtrMinimumImpressions: 100,
    targetCpa: 8000,
    wastedClickMinimumClicks: 20,
  },
  negativeTermSeeds: [
    "無料",
    "セルフ",
    "市販",
    "やり方",
    "求人",
    "採用",
    "学校",
    "資格",
    "通販",
    "安い",
    "激安",
    "クーポン",
  ],
} as const;

export const adCsvPlatforms: Array<{ label: string; value: AdCsvPlatform }> = [
  { label: "Google広告", value: "google" },
  { label: "Meta広告", value: "meta" },
  { label: "Instagram広告", value: "instagram" },
  { label: "Facebook広告", value: "facebook" },
  { label: "LINE広告", value: "line" },
  { label: "その他", value: "other" },
];

export const adCsvImportTypes: Array<{ label: string; value: AdCsvImportType }> = [
  { label: "キャンペーン", value: "campaign" },
  { label: "広告グループ", value: "ad_group" },
  { label: "広告", value: "ad" },
  { label: "キーワード", value: "keyword" },
  { label: "検索語句", value: "search_term" },
  { label: "日別", value: "daily" },
  { label: "媒体不明", value: "unknown" },
];

export const adCsvColumnAliases = {
  adGroupName: ["ad group", "ad group name", "広告グループ", "広告グループ名", "広告セット名", "ad set name"],
  adName: ["ad", "ad name", "広告", "広告名"],
  area: ["地域", "location", "area", "region"],
  campaignName: ["campaign", "campaign name", "キャンペーン", "キャンペーン名"],
  clicks: ["clicks", "クリック", "クリック数"],
  conversions: ["conversions", "conversion", "cv", "cv数", "コンバージョン", "予約", "問い合わせ", "results", "結果", "leads", "リード", "purchases"],
  cost: ["cost", "費用", "コスト", "amount spent", "消化金額"],
  cpa: ["cost / conv.", "cost per conversion", "conversion cost", "コンバージョン単価", "結果の単価", "cost per result", "cpa"],
  cpc: ["avg. cpc", "average cpc", "平均クリック単価", "cpc"],
  cpm: ["cpm"],
  ctr: ["ctr", "クリック率"],
  device: ["デバイス", "device"],
  finalUrl: ["final url", "最終ページurl", "lp url", "landing page url", "url"],
  impressions: ["impressions", "表示回数", "インプレッション"],
  keyword: ["keyword", "キーワード"],
  landingPageViews: ["landing page views", "ランディングページビュー"],
  linkClicks: ["link clicks", "リンククリック"],
  reach: ["reach", "リーチ"],
  recordDate: ["date", "day", "日付", "日"],
  searchTerm: ["search term", "検索語句", "検索語句"],
  status: ["status", "ステータス"],
} as const;
