export type SearchConsoleImportType =
  | "query"
  | "page"
  | "device"
  | "country"
  | "date";

export type SearchConsoleImportStatus =
  | "preview"
  | "imported"
  | "analyzed"
  | "failed";

export type SearchConsoleRow = {
  id?: string;
  importId?: string;
  rowType: SearchConsoleImportType;
  query: string;
  pageUrl: string;
  device: string;
  country: string;
  recordDate: string;
  clicks: number;
  impressions: number;
  /** Decimal ratio. 3.5% is stored as 0.035. */
  ctr: number;
  position: number;
};

export type SearchConsoleMetrics = {
  clicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number;
  queryCount: number;
  pageCount: number;
};

export type SearchConsoleImport = {
  id: string;
  importType: SearchConsoleImportType;
  fileName: string;
  periodStart: string;
  periodEnd: string;
  reportMonth: string;
  comparisonLabel: string;
  memo: string;
  rowCount: number;
  excludedRowCount: number;
  warningCount: number;
  status: SearchConsoleImportStatus;
  errorMessage: string;
  contentHash: string;
  metrics: SearchConsoleMetrics;
  createdAt: string;
  updatedAt: string;
};

export type SearchConsoleCsvIssue = {
  rowNumber: number;
  severity: "error" | "warning";
  message: string;
};

export type SearchConsoleCsvPreview = {
  contentHash: string;
  fileName: string;
  requestedType: SearchConsoleImportType;
  detectedType: SearchConsoleImportType;
  recognizedColumns: string[];
  sourceColumns: string[];
  totalRowCount: number;
  validRowCount: number;
  excludedRowCount: number;
  errorCount: number;
  warningCount: number;
  issues: SearchConsoleCsvIssue[];
  previewRows: SearchConsoleRow[];
  rows?: SearchConsoleRow[];
  metrics: SearchConsoleMetrics;
};

export type SearchConsoleMetricChange = {
  current: number;
  previous: number;
  difference: number;
  percentChange: number | null;
};

export type SearchConsoleComparison = {
  hasComparison: boolean;
  label: string;
  clicks: SearchConsoleMetricChange;
  impressions: SearchConsoleMetricChange;
  ctrPointChange: number;
  /** Positive means the average position improved. */
  positionImprovement: number;
};

export type SearchConsoleCandidate = SearchConsoleRow & {
  key: string;
  reason: string;
  category:
    | "low_ctr"
    | "position_4_10"
    | "position_11_20"
    | "position_21_30"
    | "zero_click"
    | "clicks_down"
    | "impressions_up"
    | "position_up"
    | "position_down"
    | "page_opportunity";
};

export type SearchConsoleBasicAnalysis = {
  highImpressionsLowCtr: SearchConsoleCandidate[];
  positionFourToTen: SearchConsoleCandidate[];
  positionElevenToTwenty: SearchConsoleCandidate[];
  positionTwentyOneToThirty: SearchConsoleCandidate[];
  zeroClickHighImpressions: SearchConsoleCandidate[];
  clicksDown: SearchConsoleCandidate[];
  impressionsUp: SearchConsoleCandidate[];
  positionUp: SearchConsoleCandidate[];
  positionDown: SearchConsoleCandidate[];
  improvementPages: SearchConsoleCandidate[];
  topKeywords: SearchConsoleRow[];
  topPages: SearchConsoleRow[];
};

export type SearchConsolePriorityKeyword = {
  keyword: string;
  reason: string;
  recommendedAction: string;
  priority: "high" | "medium" | "low";
};

export type SearchConsolePriorityPage = {
  url: string;
  reason: string;
  recommendedAction: string;
  priority: "high" | "medium" | "low";
};

export type SearchConsoleArticleIdea = {
  targetKeyword: string;
  title: string;
  searchIntent: string;
  reason: string;
};

export type SearchConsoleTaskSuggestion = {
  title: string;
  taskType: string;
  priority: "high" | "medium" | "low";
  reason: string;
  keyword?: string;
  pageUrl?: string;
};

export type SearchConsoleSeoAnalysis = {
  summary: string;
  positivePoints: string[];
  negativePoints: string[];
  priorityKeywords: SearchConsolePriorityKeyword[];
  priorityPages: SearchConsolePriorityPage[];
  titleSuggestions: Array<{
    keyword: string;
    currentTitle: string;
    suggestedTitle: string;
    reason: string;
  }>;
  metaDescriptionSuggestions: Array<{
    pageUrl: string;
    suggestedDescription: string;
    reason: string;
  }>;
  rewriteSuggestions: string[];
  newArticleIdeas: SearchConsoleArticleIdea[];
  internalLinkSuggestions: string[];
  ctaSuggestions: string[];
  monthlyTasks: SearchConsoleTaskSuggestion[];
  nextMonthGoals: string[];
  provider: "gemini" | "mock";
  providerLabel: string;
  model: string;
  analyzedAt: string;
};

export type SearchConsoleDataset = {
  imports: SearchConsoleImport[];
  rowsByImport: Record<string, SearchConsoleRow[]>;
  analysesByImport: Record<string, SearchConsoleSeoAnalysis>;
};

