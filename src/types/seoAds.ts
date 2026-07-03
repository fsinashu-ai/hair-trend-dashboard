export type SeoPriority = "high" | "medium" | "low";

export type SeoKeyword = {
  id: string;
  keyword: string;
  intent: string;
  priority: SeoPriority;
  targetPage: string;
  status: string;
  memo: string;
};

export type SeoPage = {
  id: string;
  pageTitle: string;
  pageUrl: string;
  targetKeyword: string;
  currentIssue: string;
  suggestedAction: string;
  ctaMemo: string;
};

export type SeoTask = {
  id: string;
  title: string;
  taskType: string;
  priority: SeoPriority;
  status: string;
  relatedKeyword: string;
  relatedPageUrl: string;
  dueDate: string;
  memo: string;
  reason?: string;
  sourceSearchConsoleImportId?: string;
};

export type SeoReport = {
  id: string;
  reportMonth: string;
  summary: string;
  clicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number;
  aiAnalysis: string;
  nextActions: string[];
};

export type AdCampaignNote = {
  id: string;
  campaignName: string;
  platform: string;
  purpose: string;
  targetArea: string;
  budgetMemo: string;
  offer: string;
  landingPageUrl: string;
  memo: string;
};

export type AdReport = {
  id: string;
  reportMonth: string;
  platform: string;
  campaignName: string;
  cost: number;
  clicks: number;
  conversions: number;
  cpa: number;
  aiAnalysis: string;
  nextActions: string[];
};
