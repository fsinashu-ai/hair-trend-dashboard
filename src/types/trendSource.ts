export type TrendSourceType =
  | "RSS"
  | "公式サイト"
  | "自社サイト"
  | "メーカー"
  | "美容ディーラー"
  | "美容メディア";

export type ManagedTrendSource = {
  id: string;
  title: string;
  url: string;
  sourceType: TrendSourceType;
  isActive: boolean;
  memo: string;
  lastFetchedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
};
