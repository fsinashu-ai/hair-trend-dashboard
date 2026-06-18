import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { load } from "cheerio";
import { detectSocialType, normalizeSocialUrl } from "@/lib/social/url";
import type { SocialMetadata } from "@/types/social";

const fetchTimeoutMs = 5_000;
const maxHtmlBytes = 512 * 1024;
const minimumDomainIntervalMs = 2_000;
const maxRedirects = 3;
const nextAllowedRequestAt = new Map<string, number>();

type MetadataErrorCode =
  | "blocked_address"
  | "blocked_by_robots"
  | "forbidden"
  | "invalid_content"
  | "invalid_url"
  | "rate_limited"
  | "response_too_large"
  | "timeout"
  | "unavailable";

export class SocialMetadataError extends Error {
  code: MetadataErrorCode;

  constructor(code: MetadataErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

type TikTokOembedResponse = {
  author_name?: string;
  author_url?: string;
  provider_name?: string;
  thumbnail_url?: string;
  title?: string;
  type?: string;
};

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map(Number);

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return true;
  }

  const [first, second] = parts;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase();

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

function isPrivateAddress(address: string) {
  const version = isIP(address);

  if (version === 4) {
    return isPrivateIpv4(address);
  }

  if (version === 6) {
    return isPrivateIpv6(address);
  }

  return true;
}

async function assertPublicUrl(value: string) {
  let url: URL;

  try {
    url = new URL(normalizeSocialUrl(value));
  } catch {
    throw new SocialMetadataError(
      "invalid_url",
      "httpまたはhttpsの公開URLを入力してください。",
    );
  }

  const hostname = url.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new SocialMetadataError(
      "blocked_address",
      "内部ネットワークのURLは取得できません。",
    );
  }

  const directIpVersion = isIP(hostname);
  const addresses = directIpVersion
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true }).catch(() => []);

  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => isPrivateAddress(address))
  ) {
    throw new SocialMetadataError(
      "blocked_address",
      "安全を確認できないURLのため取得を停止しました。",
    );
  }

  return url;
}

async function waitForDomain(hostname: string) {
  const now = Date.now();
  const allowedAt = nextAlllowedRequestAt.set(hostname) ?? 0;
  const waitMs = Math.max(0, allowedAt - now);

  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  nextAllowedRequestAt.set(hostname, Date.now() + minimumDomainIntervalMs);
}

async function fetchWithValidatedRedirects(
  value: string,
  init: RequestInit,
  redirectCount = 0,
): Promise<Response> {
  const url = await assertPublicUrl(value);
  await waitForDomain(url.hostname);

  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(fetchTimeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new SocialMetadataError(
        "timeout",
        "取得先の応答は噂間がかかったため停止しました。",
      );
    }

    throw new SocialMetadataError(
      "unavailable",
      "公開ページへ�h�続できませんでした。手動入力を利用してください。",
    );
  }

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");

    if (!location || redirectCount >= maxRedirects) {
      throw new SocialMetadataError(
        "unavailable",
        "転退先や安全に確認できませんでした。",
      );
    }

    return fetchWithValidatedRedirects(
      new URL(location, url).toString(),
      init,
      redirectCount + 1,
    );
  }

  return response;
}

function parseRobotsRules(text: string, pathname: string) {
  const groups: Array<{
    applies: boolean;
    rules: Array<{ allow: boolean; path: string }>;
  }> = [];
  let currentAgents: string[] = [];
  let currentRules: Array<{ allow: boolean; path: string }> = [];

  function finishGroup() {
    if (currentAgents.length > 0) {
      groups.push({
        applies: currentAgents.some(
          (agent) =>
            agent === "*" ||
            agent.includes("hairtrenddashboard") ||
            agent.includes("hair-trend-dashboard"),
        ),
        rules: currentRules,
      });
    }

    currentAgents = [];
    currentRules = [];
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();

    if (!line) {
      continue;
    }

    const separator = line.indexOf(":");

    if (separator === -1) {
      continue;
    }

    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      if (currentRules.length > 0) {
        finishGroup();
      }

      currentAgents.push(value.toLowerCase());
      continue;
    }

    if ((field === "allow" || field === "disallow") && currentAgents.length > 0) {
      currentRules.push({
        allow: field === "allow",
        path: value,
      });
    }
  }

  finishGroup();

  const matchesPath = (rulePath: string) => {
    const anchorsAtEnd = rulePath.endsWith("$");
    const pathWithoutEndMarker = anchorsAtEnd ? rulePath.slice(0, -1) : rulePath;
    const pattern = pathWithoutEndMarker
      .replace(/[.+?$^{}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    const expression = new RegExp(`^${pattern}${anchorsAtEnd ? "$" : ""}`);

    return expression.test(pathname);
  };
  const matchingRules = groups
    .filter((group) => group.applies)
    .flatMap((group) => group.rules)
    .filter((rule) => rule.path && matchesPath(rule.path))
    .sort(
      (first, second) =>
        second.path.length - first.path.length ||
        Number(second.allow) - Number(first.allow),
    );

  return matchingRules[0]?.allow !== false;
}

async function assertRobotsAllowed(targetUrl: URL) {
  const robotsUrl = new URL("/robots.txt", targetUrl.origin).toString();
  const response = await fetchWithValidatedRedirects(robotsUrl, {
    headers: {
      Accept: "text/plain",
      "User-Agent": "HairTrendDashboard/1.0",
    },
    method: "GET",
  });

  if (response.status === 404) {
    return;
  }

  if (response.status === 401 || response.status === 403) {
    throw new SocialMetadataError(
      "blocked_by_robots",
      "取得先のアクセス方針によりメタデータ取得を停止しました。",
    );
  }

  if (response.status === 429) {
    throw new SocialMetadataError(
      "rate_limited",
      "取得先のレート制限を検出したため停止しました。",
    );
  }

  if (!response.ok) {
    return;
  }

  const robotsText = (await response.text()).slice(0, 128 * 1024);

  if (
    !parseRobotsRules(
      robotsText,
      `${targetUrl.pathname || "/"}${targetUrl.search}`,
    )
  ) {
    throw new SocialMetadataError(
      "blocked_by_robots",
      "robots.txtで取得が許可されていないため停止しました。",
    );
  }
}

async function readLimitedHtml(response: Response) {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let html = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalBytes += value.byteLength;

    if (totalBytes > maxHtmlBytes) {
      await reader.cancel();
      throw new SocialMetadataError(
        "response_too_large",
        "ページが大きすぎるため、必要最小限に取得を停止しました。",
      );
    }

    html += decoder.decode(value, { stream: true });
  }

  return html + decoder.decode();
}

function cleanText(value: string | undefined, maxLength = 1_000) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function resolveReferenceUrl(value: string | undefined, baseUrl: string) {
  if (!value) {
    return "";
  }

  try {
    return normalizeSocialUrl(new URL(value, baseUrl).toString());
  } catch {
    return "";
  }
}

function getJsonLdPublishedAt(html: string) {
  const $ = load(html);

  for (const element of $('script[type="application/ld+json"]').toArray().slice(0, 5)) {
    try {
      const value = JSON.parse($(element).text()) as
        | Record<string, unknown>
        | Array<Record<string, unknown>;
      const candidates = Array.isArray(value) ? value : [value];

      for (const candidate of candidates) {
        const datePublished = candidate.datePublished;

        if (typeof datePublished === "string" && datePublished.trim()) {
          return datePublished.trim();
        }
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

function extractMetadata(
  html: string,
  requestedUrl: string,
  finalUrl: string,
): SocialMetadata {
  const $ = load(html);
  const meta = (selector: string) =>
    cleanText($(selector).first().attr("content"));
  const title = cleanText($("title").first().text(), 300);
  const ogTitle = meta('meta[property="og:title"]');
  const description =
    meta('meta[name="description"]') || meta('meta[name="twitter:description"]');
  const ogDescription = meta('meta[property="og:description"]');
  const canonicalUrl =
    resolveReferenceUrl($('link[rel="canonical"]').first().attr("href"), finalUrl) ||
    normalizeSocialUrl(finalUrl);
  const ogImageUrl = resolveReferenceUrl(
    $('meta[property="og:image"]').first().attr("content") ||
      $('meta[name="twitter:image"]').first().attr("content"),
    finalUrl,
  );
  const publishedAt =
    meta('meta[property="article:published_time"]') ||
    meta('meta[name="date"]') ||
    meta('meta[name="datePublished"]') ||
    meta('meta[itemprop="datePublished"]') ||
    getJsonLdPublishedAt(html);

  return {
    canonicalUrl,
    description,
    finalUrl: normalizeSocialUrl(finalUrl),
    ogDescription,
    ogImageUrl,
    ogTitle,
    publishedAt,
    requestedUrl: normalizeSocialUrl(requestedUrl),
    snsType: detectSocialType(canonicalUrl || finalUrl),
    title: ogTitle || title,
  };
}

async function fetchTikTokOembedMetadata(
  requestedUrl: string,
  targetUrl: URL,
): Promise<SocialMetadata> {
  const endpoint = new URL("https://www.tiktok.com/oembed");
  endpoint.searchParams.set("url", targetUrl.toString());

  const response = await fetchWithValidatedRedirects(endpoint.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "HairTrendDashboard/1.0",
    },
    method: "GET",
  });

  if (response.status === 403) {
    throw new SocialMetadataError(
      "forbidden",
      "TikTok公式oEmbedで取得が許可されませんでした。手動入力を利用してください。",
    );
  }

  if (response.status === 429) {
    throw new SocialMetadataError(
      "rate_limited",
      "TikTok公式oEmbedのレート制限を検出したため停止しました。",
    );
  }

  if (!response.ok) {
    throw new SocialMetadataError(
      "unavailable",
      `TikTok公式oEmbedで取得できませんでした（${response.status}）。手動入力を利用してください。`,
    );
  }

  let data: TikTokOembedResponse;

  try {
    data = (await response.json()) as TikTokOembedResponse;
  } catch {
    throw new SocialMetadataError(
      "invalid_content",
      "TikTok公式oEmbedの応答を読み取れませんでした。手動入力を利用してください。",
    );
  }

  const title = cleanText(data.title, 300);
  const authorName = cleanText(data.author_name, 120);
  const thumbnailUrl = resolveReferenceUrl(
    data.thumbnail_url,
    endpoint.toString(),
  );

  if (!title && !authorName && !thumbnailUrl) {
    throw new SocialMetadataError(
      "invalid_content",
      "TikTok公式oEmbedから公開メタデータを取得できませんでした。手動入力を利用してください。",
    );
  }

  const normalizedRequestedUrl = normalizeSocialUrl(requestedUrl);
  const normalizedTargetUrl = normalizeSocialUrl(targetUrl.toString());
  const fallbackTitle = authorName
    ? `${authorName}のTikTok動画`
    : "TikTok動画";
  const description = authorName
    ? `${authorName}のTikTok公開動画です。公式oEmbedでタイトルとサムネイルURLだけを確認しました。`
    : "TikTok公開動画です。公式oEmbedでタイトルとサムネイルURLだけを確認しました。";

  return {
    canonicalUrl: normalizedTargetUrl,
    description,
    finalUrl: normalizedTargetUrl,
    ogDescription: title || description,
    ogImageUrl: thumbnailUrl,
    ogTitle: title || fallbackTitle,
    requestedUrl: normalizedRequestedUrl,
    snsType: "TikTok",
    title: title || fallbackTitle,
  };
}

export async function fetchSocialMetadata(value: string) {
  const targetUrl = await assertPublicUrl(value);

  if (detectSocialType(targetUrl.toString()) === "TikTok") {
    return fetchTikTokOembedMetadata(value, targetUrl);
  }

  await assertRobotsAllowed(targetUrl);

  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchWithValidatedRedirects(targetUrl.toString(), {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ja,en;q=0.8",
        "User-Agent": "HairTrendDashboard/1.0",
      },
      method: "GET",
    });
    lastResponse = response;

    if (response.status === 403) {
      throw new SocialMetadataError(
        "forbidden",
        "取得先が自動取得を許可していません。手動入力を利用してください。",
      );
    }

    if (response.status === 429) {
      throw new SocialMetadataError(
        "rate_limited",
        "取得先のレート制限を検出したため停止しました。",
      );
    }

    if (response.ok) {
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

      if (
        !contentType.includes("text/html") &&
        !contentType.includes("application/xhtml+xml")
      ) {
        throw new SocialMetadataError(
          "invalid_content",
          "HTML公開ページではないためメタデータを取得できません。",
        );
      }

      const html = await readLimitedHtml(response);
      const metadata = extractMetadata(
        html,
        value,
        response.url || targetUrl.toString(),
      );

      if (
        !metadata.title &&
        !metadata.description &&
        !metadata.ogTitle &&
        !metadata.ogDescription &&
        !metadata.ogImageUrl
      ) {
        throw new SocialMetadataError(
          "invalid_content",
          "タイトルやdescriptionなどの公開メタデータを取得できませんでした。手動入力を利用してください。",
        );
      }

      return metadata;
    }

    if (response.status < 500 || attempt === 1) {
      break;
    }
  }

  throw new SocialMetadataError(
    "unavailable",
    `公開ページを取得できませんでした（${lastResponse?.status ?? "接続失敗"}）。手動入力を利用してください。`,
  );
}
