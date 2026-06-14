import type { SnsType } from "@/types/snsPost";
import type { SalonRelevance, TrendCategory } from "@/types/trend";

export type SocialSourceMode =
  | "official_api"
  | "manual_url"
  | "metadata_only";

export type SocialPriority = "high" | "medium" | "low";

export type SocialSource = {
  id: string;
  snsType: SnsType;
  accountName: string;
  profileUrl: string;
  sourceMode: SocialSourceMode;
  isActive: boolean;
  priority: SocialPriority;
  memo: string;
  lastCheckedAt?: string;
  lastError: string;
  createdAt?: string;
  updatedAt?: string;
};

export type NewSocialSource = Omit<
  SocialSource,
  "id" | "lastCheckedAt" | "lastError" | "createdAt" | "updatedAt"
>;

export type SocialMetadata = {
  requestedUrl: string;
  finalUrl: string;
  canonicalUrl: string;
  snsType: SnsType;
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  publishedAt?: string;
};

export type SocialClassification = {
  trendName: string;
  category: TrendCategory;
  summary: string;
  tags: string[];
  relevance: SalonRelevance;
  instagramPostIdea: string;
  blogIdea: string;
  counselingIdea: string;
  providerLabel: string;
};

export type SocialPost = {
  id: string;
  sourceId?: string;
  snsType: SnsType;
  url: string;
  canonicalUrl: string;
  title: string;
  description: string;
  ogImageUrl: string;
  publishedAt?: string;
  category: TrendCategory;
  tags: string[];
  aiSummary: string;
  relevance: SalonRelevance;
  instagramPostIdea: string;
  blogIdea: string;
  counselingIdea: string;
  importedAt: string;
  createdAt?: string;
  updatedAt?: string;
};

export type NewSocialPost = Omit<
  SocialPost,
  "id" | "createdAt" | "updatedAt"
>;

