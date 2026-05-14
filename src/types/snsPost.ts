import type { TrendCategory } from "@/types/trend";

export type SnsType =
  | "Instagram"
  | "YouTube"
  | "Pinterest"
  | "TikTok"
  | "X"
  | "Other";

export type SnsAiClassification = {
  trendName: string;
  category: TrendCategory;
  memo: string;
  tags: string[];
  instagramPostIdea: string;
  counselingIdea: string;
};

export type SnsPost = {
  id: string;
  snsType: SnsType;
  url: string;
  title: string;
  memo: string;
  category: TrendCategory;
  tags: string[];
  aiSummary: string;
  postIdea: string;
  counselingIdea: string;
  savedAt: string;
  createdAt?: string;
  updatedAt?: string;
};

export type NewSnsPost = Omit<SnsPost, "id" | "createdAt" | "updatedAt">;
