export type PageIntegrationSourceStatus = {
  label: string;
  period: string;
  updatedAt: string;
  detail: string;
};

export type IntegratedSearchConsoleMetrics = {
  clicks: number;
  ctr: number;
  impressions: number;
  position: number;
};

export type IntegratedGa4Metrics = {
  conversions: number;
  lineClicks: number;
  reservationClicks: number;
  sessions: number;
  users: number;
  views: number;
};

export type IntegratedAdMetrics = {
  clicks: number;
  conversions: number;
  cost: number;
  cpa: number;
  ctr: number;
  impressions: number;
};

export type IntegratedPage = {
  ads: IntegratedAdMetrics | null;
  ga4: IntegratedGa4Metrics | null;
  pagePath: string;
  pageTitle: string;
  priority: "high" | "medium" | "low";
  reason: string;
  searchConsole: IntegratedSearchConsoleMetrics | null;
};

export type PageIntegrationSummary = {
  pagesWithAds: number;
  pagesWithGa4: number;
  pagesWithSearchConsole: number;
  rows: IntegratedPage[];
  sources: {
    ads: PageIntegrationSourceStatus | null;
    ga4: PageIntegrationSourceStatus | null;
    searchConsole: PageIntegrationSourceStatus | null;
  };
  totalAdCost: number;
  totalAdConversions: number;
  totalGa4Sessions: number;
  totalSearchClicks: number;
};
