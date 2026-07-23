export type EmailMetricMonthSummary = {
  month: string;
  siteMetricValue: number | null;
  siteMetricType: string | null;
  direct: number | null;
  organicSearch: number | null;
  paidSearch: number | null;
  searchConsoleImpressions: number | null;
  searchConsoleClicks: number | null;
  lineLinkClicks: number | null;
  lineFriendAdds: number | null;
  netFriendAdds: number | null;
  adImpressions: number | null;
  adClicks: number | null;
  adReportedConversions: number | null;
  adAdjustedConversions: number | null;
  adCostYen: number | null;
  adPlatforms: string[];
  actualResponse: string | null;
  dataQualityNotes: string[];
};

export type EmailMetricsAnalysisContext = {
  source: string;
  role: string;
  sourcePeriod: string;
  requestedPeriod: string;
  matchingMode: "requested_period" | "latest_available";
  months: EmailMetricMonthSummary[];
  interpretationRules: string[];
};
