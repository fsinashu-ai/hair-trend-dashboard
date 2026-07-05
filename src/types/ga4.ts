export type Ga4ImportStatus = "preview" | "imported" | "analyzed" | "failed";

export type Ga4Row = {
  id?: string;
  importId?: string;
  landingPage: string;
  pageTitle: string;
  sourceMedium: string;
  channelGroup: string;
  deviceCategory: string;
  eventName: string;
  recordDate: string;
  users: number;
  sessions: number;
  views: number;
  engagementRate: number;
  averageEngagementSeconds: number;
  lineClicks: number;
  reservationClicks: number;
  conversions: number;
};

export type Ga4Metrics = {
  users: number;
  sessions: number;
  views: number;
  engagementRate: number;
  averageEngagementSeconds: number;
  lineClicks: number;
  reservationClicks: number;
  conversions: number;
  landingPageCount: number;
  sourceCount: number;
};

export type Ga4Import = {
  id: string;
  fileName: string;
  propertyName: string;
  periodStart: string;
  periodEnd: string;
  reportMonth: string;
  comparisonLabel: string;
  memo: string;
  rowCount: number;
  excludedRowCount: number;
  warningCount: number;
  status: Ga4ImportStatus;
  errorMessage: string;
  contentHash: string;
  metrics: Ga4Metrics;
  createdAt: string;
  updatedAt: string;
};

export type Ga4CsvIssue = {
  rowNumber: number;
  severity: "error" | "warning";
  message: string;
};

export type Ga4CsvPreview = {
  contentHash: string;
  fileName: string;
  recognizedColumns: string[];
  sourceColumns: string[];
  totalRowCount: number;
  validRowCount: number;
  excludedRowCount: number;
  errorCount: number;
  warningCount: number;
  issues: Ga4CsvIssue[];
  previewRows: Ga4Row[];
  rows?: Ga4Row[];
  metrics: Ga4Metrics;
};

export type Ga4MetricChange = {
  current: number;
  previous: number;
  difference: number;
  percentChange: number | null;
};

export type Ga4Comparison = {
  hasComparison: boolean;
  label: string;
  users: Ga4MetricChange;
  sessions: Ga4MetricChange;
  views: Ga4MetricChange;
  conversionClicks: Ga4MetricChange;
  engagementRatePointChange: number;
};

export type Ga4Candidate = Ga4Row & {
  key: string;
  reason: string;
  category:
    | "high_views_low_engagement"
    | "high_users_no_conversion"
    | "line_opportunity"
    | "top_landing_page"
    | "top_source"
    | "conversion_page";
};

export type Ga4BasicAnalysis = {
  highViewsLowEngagement: Ga4Candidate[];
  highUsersNoConversion: Ga4Candidate[];
  lineOpportunityPages: Ga4Candidate[];
  topLandingPages: Ga4Candidate[];
  topSources: Ga4Candidate[];
  conversionPages: Ga4Candidate[];
};

export type Ga4TaskSuggestion = {
  title: string;
  taskType: string;
  priority: "high" | "medium" | "low";
  reason: string;
  pageUrl?: string;
  sourceMedium?: string;
};

export type Ga4Analysis = {
  summary: string;
  positivePoints: string[];
  negativePoints: string[];
  priorityPages: Array<{
    pageUrl: string;
    reason: string;
    recommendedAction: string;
    priority: "high" | "medium" | "low";
  }>;
  conversionIdeas: string[];
  lineCtaSuggestions: string[];
  contentIdeas: Array<{
    targetKeyword: string;
    title: string;
    reason: string;
  }>;
  monthlyTasks: Ga4TaskSuggestion[];
  nextActions: string[];
  provider: "gemini" | "mock";
  providerLabel: string;
  model: string;
  analyzedAt: string;
};

export type Ga4Dataset = {
  imports: Ga4Import[];
  rowsByImport: Record<string, Ga4Row[]>;
  analysesByImport: Record<string, Ga4Analysis>;
};
