export type DashboardSourceMode =
  | "supabase"
  | "mixed"
  | "sample"
  | "empty";

export type DashboardMetricItem = {
  label: string;
  value: string;
  helper: string;
  href: string;
};

export type DashboardTaskItem = {
  href: string;
  label: string;
  priority: "high" | "medium" | "low";
  source: string;
};

export type FinalMarketingDashboardSummary = {
  ad: {
    clicks: number;
    conversions: number;
    cost: number;
    cpa: number;
    ctr: number;
    hasData: boolean;
    impressions: number;
    sourceLabel: string;
  };
  blog: {
    draftCount: number;
    hasData: boolean;
    latestTitle: string;
    publishedCount: number;
    readyCount: number;
    sourceLabel: string;
    totalCount: number;
  };
  generatedAt: string;
  geminiReview: string;
  line: {
    conversions: number;
    hasData: boolean;
    lineClicks: number;
    reservationClicks: number;
    sourceLabel: string;
  };
  pageIntegration: {
    highPriorityPages: number;
    pageCount: number;
    pagesWithAllSources: number;
    sourceLabel: string;
  };
  monthlyActions: DashboardTaskItem[];
  seo: {
    averagePosition: number;
    clicks: number;
    ctr: number;
    hasData: boolean;
    impressions: number;
    sourceLabel: string;
  };
  sourceMode: DashboardSourceMode;
  todayActions: DashboardTaskItem[];
  unfinishedTasks: DashboardTaskItem[];
};
