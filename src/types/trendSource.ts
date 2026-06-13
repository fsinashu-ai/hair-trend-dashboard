export type TrendSourceType =
  | "RSS"
  | "公式サイト"
  | "自社サイト"
  | "メーカー"
  | "美容ディーラー"
  | "美容メディア";

export type TrendSourcePriority = "high" | "medium" | "low";

export type TrendSourceRssStatus =
  | "unchecked"
  | "available"
  | "unavailable"
  | "error";

export type ManagedTrendSource = {
  id: string;
  title: string;
  url: string;
  sourceType: TrendSourceType;
  category: string;
  priority: TrendSourcePriority;
  isActive: boolean;
  memo: string;
  rssUrl: string | null;
  rssStatus: TrendSourceRssStatus;
  consecutiveFailures: number;
  lastError: string;
  lastFetchedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
};
