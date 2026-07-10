export type DashboardSourceMode = "supabase" | "mixed" | "sample";

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
    impressions: number;
    sourceLabel: string;
  };
  blog: {
    draftCount: number;
    latestTitle: string;
    publishedCount: number;
    readyCount: number;
    totalCount: number;
  };
  generatedAt: string;
  geminiReview: string;
  line: {
    conversions: number;
    lineClicks: number;
    reservationClicks: number;
    sourceLabel: string;
  };
  monthlyActions: DashboardTaskItem[];
  seo: {
    averagePosition: number;
    clicks: number;
    ctr: number;
    impressions: number;
    sourceLabel: string;
  };
  sourceMode: DashboardSourceMode;
  todayActions: DashboardTaskItem[];
  unfinishedTasks: DashboardTaskItem[];
};
