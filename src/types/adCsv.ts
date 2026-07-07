export type AdCsvPlatform =
  | "google"
  | "meta"
  | "instagram"
  | "facebook"
  | "line"
  | "other";

export type AdCsvImportType =
  | "campaign"
  | "ad_group"
  | "ad"
  | "keyword"
  | "search_term"
  | "daily"
  | "unknown";

export type AdCsvImportStatus =
  | "preview"
  | "imported"
  | "failed";

export type AdCsvMetrics = {
  totalCost: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  averageCtr: number;
  averageCpc: number;
  averageCpa: number;
};

export type AdCsvRow = {
  id?: string;
  importId?: string;
  platform: AdCsvPlatform;
  rowType: AdCsvImportType;
  recordDate: string;
  campaignName: string;
  adGroupName: string;
  adName: string;
  keyword: string;
  searchTerm: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cost: number;
  conversions: number;
  cpa: number;
  cpc: number;
  cpm: number;
  reach: number;
  linkClicks: number;
  landingPageViews: number;
  finalUrl: string;
  status: string;
  device: string;
  area: string;
  rawData: Record<string, string>;
};

export type AdCsvIssue = {
  rowNumber: number;
  severity: "error" | "warning";
  message: string;
};

export type AdCsvPreview = {
  contentHash: string;
  fileName: string;
  platform: AdCsvPlatform;
  requestedType: AdCsvImportType;
  detectedType: AdCsvImportType;
  recognizedColumns: string[];
  sourceColumns: string[];
  totalRowCount: number;
  validRowCount: number;
  invalidRowCount: number;
  errorCount: number;
  warningCount: number;
  issues: AdCsvIssue[];
  previewRows: AdCsvRow[];
  rows?: AdCsvRow[];
  metrics: AdCsvMetrics;
};

export type AdCsvImportMetadata = {
  platform: AdCsvPlatform;
  importType: AdCsvImportType;
  periodStart: string;
  periodEnd: string;
  reportMonth: string;
  comparisonLabel: string;
  memo: string;
};

export type AdCsvImport = AdCsvImportMetadata & {
  id: string;
  fileName: string;
  fileHash: string;
  rowCount: number;
  validRowCount: number;
  invalidRowCount: number;
  warningCount: number;
  metrics: AdCsvMetrics;
  status: AdCsvImportStatus;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
};

export type AdCsvDataset = {
  imports: AdCsvImport[];
  rowsByImport: Record<string, AdCsvRow[]>;
};

export type AdCsvGroupSummary = AdCsvMetrics & {
  key: string;
  campaignName: string;
  adGroupName: string;
  adName: string;
  keyword: string;
  searchTerm: string;
  finalUrl: string;
  rowCount: number;
};

export type AdCsvMetricChange = {
  current: number;
  previous: number;
  difference: number;
  percentChange: number | null;
};

export type AdCsvComparison = {
  hasComparison: boolean;
  label: string;
  totalCost: AdCsvMetricChange;
  totalImpressions: AdCsvMetricChange;
  totalClicks: AdCsvMetricChange;
  totalConversions: AdCsvMetricChange;
  averageCtrPointChange: number;
  averageCpc: AdCsvMetricChange;
  averageCpa: AdCsvMetricChange;
};

export type AdCsvImprovementCandidate = {
  category:
    | "high_cost"
    | "high_clicks"
    | "low_ctr"
    | "high_cpa"
    | "has_conversion"
    | "clicks_no_conversion"
    | "impressions_low_clicks"
    | "high_cpc"
    | "negative_term"
    | "lp_improvement"
    | "cost_spike";
  key: string;
  reason: string;
  metrics: AdCsvMetrics;
};

export type AdCsvBasicAnalysis = {
  highCostCampaigns: AdCsvImprovementCandidate[];
  highClickCampaigns: AdCsvImprovementCandidate[];
  lowCtrItems: AdCsvImprovementCandidate[];
  highCpaItems: AdCsvImprovementCandidate[];
  conversionItems: AdCsvImprovementCandidate[];
  clicksNoConversionItems: AdCsvImprovementCandidate[];
  highImpressionsLowClicksItems: AdCsvImprovementCandidate[];
  highCpcKeywords: AdCsvImprovementCandidate[];
  negativeSearchTerms: AdCsvImprovementCandidate[];
  lpImprovementItems: AdCsvImprovementCandidate[];
  costSpikeDays: AdCsvImprovementCandidate[];
};
