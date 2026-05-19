export type TrendCategory =
  | "レディース"
  | "メンズ"
  | "カラー"
  | "パーマ"
  | "髪質改善"
  | "白髪ぼかし"
  | "SNS投稿"
  | "SNS運用"
  | "カウンセリング"
  | "店販"
  | "自社サイト"
  | "Instagram"
  | "ヘアカタログ"
  | "ヘアカラー"
  | "美容ディーラー"
  | "Pinterest"
  | "海外トレンド"
  | "YouTube";

export type TrendHeat = "高" | "中" | "低";
export type SalonRelevance = "高" | "中" | "低";

export type Trend = {
  id: string;
  title: string;
  summary: string;
  category: TrendCategory;
  sourceName: string;
  url: string;
  publishedAt: string;
  registeredAt: string;
  keywords: string[];
  tags: string[];
  memo: string;
  heat: TrendHeat;
  youtubeSummary?: string;
  stylistPoints?: string;
  instagramIdea?: string;
  reelScript?: string;
  counselingIdea?: string;
  salonRelevance?: SalonRelevance;
};
