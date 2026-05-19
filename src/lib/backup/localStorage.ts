import type { GeneratedPost } from "@/types/generatedPost";
import type { BlogPost } from "@/types/blog";
import type { Keyword } from "@/types/keyword";
import type { SnsPost } from "@/types/snsPost";
import type { Trend, TrendHeat } from "@/types/trend";

export type RecentTrendBackup = {
  category: string;
  heat: TrendHeat;
  id: string;
  title: string;
  viewedAt: string;
};

export const backupStorageKeys = {
  blogPosts: "hair-trend-dashboard:backup-blog-posts",
  generatedPosts: "hair-trend-dashboard:backup-generated-posts",
  keywords: "hair-trend-dashboard:backup-keywords",
  recentTrends: "hair-trend-dashboard:recent-trends",
  snsPosts: "hair-trend-dashboard:backup-sns-posts",
  trends: "hair-trend-dashboard:backup-trends",
} as const;

function readArrayFromStorage<T>(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(key);

  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return null;
    }

    return parsedValue as T[];
  } catch {
    return null;
  }
}

function saveArrayToStorage<T>(key: string, items: T[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(items));
}

export function readLocalBackupTrends() {
  return readArrayFromStorage<Trend>(backupStorageKeys.trends);
}

export function saveLocalBackupTrends(trends: Trend[]) {
  saveArrayToStorage(backupStorageKeys.trends, trends);
}

export function readLocalBackupKeywords() {
  return readArrayFromStorage<Keyword>(backupStorageKeys.keywords);
}

export function saveLocalBackupKeywords(keywords: Keyword[]) {
  saveArrayToStorage(backupStorageKeys.keywords, keywords);
}

export function readLocalBackupGeneratedPosts() {
  return readArrayFromStorage<GeneratedPost>(backupStorageKeys.generatedPosts);
}

export function saveLocalBackupGeneratedPosts(posts: GeneratedPost[]) {
  saveArrayToStorage(backupStorageKeys.generatedPosts, posts);
}

export function readLocalBackupSnsPosts() {
  return readArrayFromStorage<SnsPost>(backupStorageKeys.snsPosts);
}

export function saveLocalBackupSnsPosts(posts: SnsPost[]) {
  saveArrayToStorage(backupStorageKeys.snsPosts, posts);
}

export function readLocalBackupBlogPosts() {
  return readArrayFromStorage<BlogPost>(backupStorageKeys.blogPosts);
}

export function saveLocalBackupBlogPosts(posts: BlogPost[]) {
  saveArrayToStorage(backupStorageKeys.blogPosts, posts);
}

export function readLocalRecentTrends() {
  return readArrayFromStorage<RecentTrendBackup>(backupStorageKeys.recentTrends) ?? [];
}

export function saveLocalRecentTrends(recentTrends: RecentTrendBackup[]) {
  saveArrayToStorage(backupStorageKeys.recentTrends, recentTrends);
}
