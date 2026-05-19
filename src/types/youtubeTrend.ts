import type { SalonRelevance, TrendCategory } from "@/types/trend";

export type YoutubeTrendRangeDays = 7 | 30;

export type YoutubeSearchVideo = {
  id: string;
  title: string;
  url: string;
  channelTitle: string;
  publishedAt: string;
  thumbnail: string;
  keyword: string;
};

export type YoutubeGeneratedTrend = {
  title: string;
  url: string;
  category: TrendCategory;
  memo: string;
  tags: string[];
  registered_at: string;
  youtube_summary: string;
  stylist_points: string;
  instagram_idea: string;
  reel_script: string;
  counseling_idea: string;
  salon_relevance: SalonRelevance;
  channelTitle?: string;
  publishedAt?: string;
  thumbnail?: string;
};

export type YoutubeAutoGenerateResponse = {
  dailyLimit: number;
  generatedCount: number;
  providerLabel: string;
  rangeDays: YoutubeTrendRangeDays;
  remainingDailySlots: number;
  savedCount: number;
  savedTrends: YoutubeGeneratedTrend[];
  searchedKeywords: string[];
  trends: YoutubeGeneratedTrend[];
  videoCount: number;
  warnings: string[];
};
