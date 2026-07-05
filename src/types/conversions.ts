import type { Ga4Row } from "@/types/ga4";

export type ConversionDefinitionId =
  | "line"
  | "reservation"
  | "phone"
  | "instagram"
  | "map"
  | "inquiry"
  | "key_event";

export type ConversionDefinition = {
  id: ConversionDefinitionId;
  label: string;
  description: string;
  examples: string[];
  priority: "high" | "medium" | "low";
};

export type ConversionMetrics = {
  users: number;
  sessions: number;
  views: number;
  totalActions: number;
  lineClicks: number;
  reservationClicks: number;
  phoneClicks: number;
  instagramClicks: number;
  mapClicks: number;
  inquiryClicks: number;
  keyEvents: number;
  genericKeyEvents: number;
  conversionRate: number;
};

export type ConversionAggregateRow = {
  key: string;
  label: string;
  type: "page" | "source" | "channel" | "event";
  landingPage: string;
  pageTitle: string;
  sourceMedium: string;
  channelGroup: string;
  eventName: string;
  users: number;
  sessions: number;
  views: number;
  engagementRate: number;
  averageEngagementSeconds: number;
  metrics: ConversionMetrics;
  sampleRows: Ga4Row[];
};

export type ConversionOpportunity = {
  key: string;
  label: string;
  target: "page" | "source" | "channel";
  priority: "high" | "medium" | "low";
  reason: string;
  recommendedAction: string;
  users: number;
  sessions: number;
  views: number;
  totalActions: number;
  conversionRate: number;
  pageUrl?: string;
  sourceMedium?: string;
};

export type ConversionOverview = {
  metrics: ConversionMetrics;
  byPage: ConversionAggregateRow[];
  bySource: ConversionAggregateRow[];
  byChannel: ConversionAggregateRow[];
  byEvent: ConversionAggregateRow[];
  opportunities: ConversionOpportunity[];
  topConverters: ConversionAggregateRow[];
};

export type ConversionAnalysisTask = {
  title: string;
  taskType: "cta_update" | "internal_link" | "content_rewrite" | "faq_update" | "technical_check";
  priority: "high" | "medium" | "low";
  reason: string;
  pageUrl?: string;
  sourceMedium?: string;
};

export type ConversionAnalysis = {
  summary: string;
  goodSignals: string[];
  bottlenecks: string[];
  priorityFixes: ConversionOpportunity[];
  ctaSuggestions: string[];
  trackingSuggestions: string[];
  monthlyTasks: ConversionAnalysisTask[];
  nextActions: string[];
  provider: "gemini" | "mock";
  providerLabel: string;
  model: string;
  analyzedAt: string;
};
