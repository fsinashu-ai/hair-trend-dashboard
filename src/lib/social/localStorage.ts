import type {
  NewSocialPost,
  NewSocialSource,
  SocialPost,
  SocialSource,
} from "@/types/social";

const postsKey = "hair-trend-social-posts";
const sourcesKey = "hair-trend-social-sources";

const defaultSources: SocialSource[] = [
  {
    accountName: "Instagram 手動登録",
    id: "social-source-instagram",
    isActive: true,
    lastError: "",
    memo: "公式APIを使わない場合は、確認済みの公開投稿URLだけを登録します。",
    priority: "high",
    profileUrl: "https://www.instagram.com/",
    snsType: "Instagram",
    sourceMode: "manual_url",
  },
  {
    accountName: "Pinterest 公開URL",
    id: "social-source-pinterest",
    isActive: true,
    lastError: "",
    memo: "取得できる公開メタデータだけを参考表示します。",
    priority: "medium",
    profileUrl: "https://www.pinterest.com/",
    snsType: "Pinterest",
    sourceMode: "metadata_only",
  },
  {
    accountName: "YouTube Data API",
    id: "social-source-youtube",
    isActive: true,
    lastError: "",
    memo: "動画の自動検索は既存のYouTube公式API機能を利用します。",
    priority: "high",
    profileUrl: "https://www.youtube.com/",
    snsType: "YouTube",
    sourceMode: "official_api",
  },
];

function readValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveValue<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function readLocalSocialSources() {
  return readValue<SocialSource[]>(sourcesKey, defaultSources);
}

export function saveLocalSocialSources(sources: SocialSource[]) {
  saveValue(sourcesKey, sources);
}

export function readLocalSocialPosts() {
  return readValue<SocialPost[]>(postsKey, []);
}

export function saveLocalSocialPosts(posts: SocialPost[]) {
  saveValue(postsKey, posts);
}

export function createLocalSocialSource(input: NewSocialSource): SocialSource {
  const now = new Date().toISOString();

  return {
    ...input,
    createdAt: now,
    id: `social-source-${Date.now()}`,
    lastError: "",
    updatedAt: now,
  };
}

export function createLocalSocialPost(input: NewSocialPost): SocialPost {
  const now = new Date().toISOString();

  return {
    ...input,
    createdAt: now,
    id: `social-post-${Date.now()}`,
    updatedAt: now,
  };
}

