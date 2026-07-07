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
  adGroupName: string;
  creativeMemo: string;
  dailyBudget: number;
  monthlyBudget: number;
  campaignName: string;
  platform: string;
  purpose: string;
  status: string;
  targetAudience: string;
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
  adGroupName: string;
  cost: number;
  impressions: number;
  clicks: number;
  ctr: number;
  inquiries: number;
  reservations: number;
  conversions: number;
  cpa: number;
  targetArea: string;
  targetAudience: string;
  landingPageUrl: string;
  offer: string;
  status: string;
  aiAnalysis: string;
  nextActions: string[];
};
