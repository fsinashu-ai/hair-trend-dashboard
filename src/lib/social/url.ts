import type { SnsType } from "@/types/snsPost";

const trackingParameters = new Set([
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
]);

export function detectSocialType(url: string): SnsType {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");

    if (hostname === "instagram.com" || hostname.endsWith(".instagram.com")) {
      return "Instagram";
    }

    if (
      hostname === "youtube.com" ||
      hostname.endsWith(".youtube.com") ||
      hostname === "youtu.be"
    ) {
      return "YouTube";
    }

    if (
      hostname === "pinterest.com" ||
      hostname.endsWith(".pinterest.com") ||
      hostname === "pin.it"
    ) {
      return "Pinterest";
    }

    if (hostname === "tiktok.com" || hostname.endsWith(".tiktok.com")) {
      return "TikTok";
    }

    if (
      hostname === "x.com" ||
      hostname.endsWith(".x.com") ||
      hostname === "twitter.com" ||
      hostname.endsWith(".twitter.com")
    ) {
      return "X";
    }
  } catch {
    return "Other";
  }

  return "Other";
}

export function normalizeSocialUrl(value: string) {
  const url = new URL(value.trim());

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("httpまたはhttpsの公開URLを入力してください。");
  }

  if (url.username || url.password) {
    throw new Error("認証情報を含むURLは登録できません。");
  }

  url.hash = "";

  for (const key of Array.from(url.searchParams.keys())) {
    if (key.toLowerCase().startsWith("utm_") || trackingParameters.has(key)) {
      url.searchParams.delete(key);
    }
  }

  if (
    (url.protocol === "https:" && url.port === "443") ||
    (url.protocol === "http:" && url.port === "80")
  ) {
    url.port = "";
  }

  url.hostname = url.hostname.toLowerCase();

  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString();
}

export function normalizeSocialHandle(value?: string) {
  const normalized = (value ?? "")
    .trim()
    .normalize("NFKC")
    .replace(/^@+/, "")
    .toLowerCase();

  if (!normalized) {
    return "";
  }

  if (!/^[a-z0-9._]+$/.test(normalized)) {
    throw new Error(
      "ハンドルは英数字・ピリオド・アンダースコアで入力してください。",
    );
  }

  return `@${normalized}`;
}

function normalizedTitleWords(value: string) {
  return new Set(
    value
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .split(/\s+/)
      .filter((word) => word.length > 1),
  );
}

function normalizedTitleBigrams(value: string) {
  const normalized = value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
  const bigrams = new Set<string>();

  for (let index = 0; index < normalized.length - 1; index += 1) {
    bigrams.add(normalized.slice(index, index + 2));
  }

  return bigrams;
}

function getSetSimilarity(first: Set<string>, second: Set<string>) {
  if (first.size === 0 || second.size === 0) {
    return 0;
  }

  const intersection = Array.from(first).filter((value) =>
    second.has(value),
  ).length;
  const union = new Set([...first, ...second]).size;

  return union > 0 ? intersection / union : 0;
}

export function getTitleSimilarity(first: string, second: string) {
  const firstWords = normalizedTitleWords(first);
  const secondWords = normalizedTitleWords(second);
  const wordSimilarity = getSetSimilarity(firstWords, secondWords);
  const bigramSimilarity = getSetSimilarity(
    normalizedTitleBigrams(first),
    normalizedTitleBigrams(second),
  );

  return Math.max(wordSimilarity, bigramSimilarity);
}
