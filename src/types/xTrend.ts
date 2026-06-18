import type { SocialPost } from "@/types/social";
import type { SnsType } from "@/types/snsPost";
import type { SalonRelevance, TrendCategory } from "@/types/trend";

export type XSearchPost = {
  authorName: string;
  createdAt: string;
  engagementScore: number;
  id: string;
  keyword: string;
  likeCount: number;
  replyCount: number;
  repostCount: number;
  text: string;
  url: string;
  username: string;
};

export type XGeneratedSocialPost = {
  aiSummary: string;
  authorName: string;
  blogIdea: string;
  canonicalUrl: string;
  category: TrendCategory;
  counselingIdea: string;
  description: string;
  engagementScore: number;
  importedAt: string;
  instagramPostIdea: string;
  keyword: string;
  ogImageUrl: string;
  publishedAt?: string;
  relevance: SalonRelevance;
  reviewStatus: "未確認";
  snsType: Extract<SnsType, "X">;
  tags: string[];
  title: string;
  url: string;
  username: string;
};

export type XAutoGenerateResponse = {
  generatedCount: number;
  posts: XGeneratedSocialPost[];
  providerLabel: string;
  remainingRunSlots: number;
  savedCount: number;
  savedPosts: SocialPost[];
  searchedKeywords: string[];
  tweetCount: number;
  warnings: string[];
};
