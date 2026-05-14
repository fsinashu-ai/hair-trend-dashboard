import type { SnsType } from "@/types/snsPost";
import type { TrendCategory } from "@/types/trend";

export const snsTrendCategories: TrendCategory[] = [
  "レディース",
  "メンズ",
  "カラー",
  "パーマ",
  "髪質改善",
  "白髪ぼかし",
  "SNS投稿",
  "SNS運用",
  "カウンセリング",
  "店販",
  "Instagram",
  "Pinterest",
  "YouTube",
  "海外トレンド",
];

export function detectSnsTypeFromUrl(url: string): SnsType {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");

    if (hostname.includes("instagram.com")) {
      return "Instagram";
    }

    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
      return "YouTube";
    }

    if (hostname.includes("pinterest.") || hostname.includes("pin.it")) {
      return "Pinterest";
    }

    if (hostname.includes("tiktok.com")) {
      return "TikTok";
    }

    if (hostname === "x.com" || hostname.endsWith(".x.com")) {
      return "X";
    }

    if (hostname.includes("twitter.com")) {
      return "X";
    }
  } catch {
    return "Other";
  }

  return "Other";
}

export function splitTags(value: string) {
  return value
    .split(/[,\n、]/)
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean)
    .map((tag) => `#${tag}`);
}

export function tagsToInputValue(tags: string[]) {
  return tags.map((tag) => tag.replace(/^#/, "")).join("、");
}
