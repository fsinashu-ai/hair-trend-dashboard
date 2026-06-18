import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { load } from "cheerio";
import { detectSocialType, normalizeSocialUrl } from "@/lib/social/url";
import type { SocialMetadata } from "@/types/social";

const fetchTimeoutMs = 5_000;
const maxHtmlBytes = 512 * 1024;
const maxRedirects = 3;
const nextAllowedRequestAt = new Map<string, number>();
const minimumDomainIntervalMs = 2_000;

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

type TikTokOembedResponse = {
  author_name?: string;
  thumbnail_url?: string;
  title?: string;
};

export class SocialMetadataError extends Error {
  code: MetadataErrorCode;

  constructor(code: MetadataErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function cleanText(value: string | undefined, maxLength = 1_000) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

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
    throw new SocialMetadataError("invalid_url", "Public http or https URL is required.");
  }

  const hostname = url.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new SocialMetadataError("blocked_address", "Local network URLs are blocked.");
  }

  const directIpVersion = isIP(hostname);
  const addresses = directIpVersion
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true }).catch(() => []);

  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => isPrivateAddress(address))
  ) {
    throw new SocialMetadataError("blocked_address", "This URL could not be verified safely.");
  }

  return url;
}

async function waitForDomain(hostname: string) {
  const now = Date.now();
  const allowedAt = nextAllowedRequestAt.get(hostname) ?? 0;
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
      throw new SocialMetadataError("timeout", "The request timed out.");
    }

    throw new SocialMetadataError("unavailable", "Could not connect to the public URL.");
  }

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");

    if (!location || redirectCount >= maxRedirects) {
      throw new SocialMetadataError("unavailable", "Redirect target could not be verified.");
    }

    return fetchWithValidatedRedirects(
      new URL(location, url).toString(),
      init,
      redirectCount + 1,
    );
  }

  return response;
}

function robotsAllows(text: string, pathname: string) {
  let appliesToUs = false;
  let currentAllows = true;
  let bestMatchLength = -1;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();

    if (!line.includes(":")) {
      continue;
    }

    const [rawField, ...rawValue] = line.split(":");
    const field = rawField.trim().toLowerCase();
    const value = rawValue.join(":").trim();

    if (field === "user-agent") {
      const agent = value.toLowerCase();
      appliesToUs =
        agent === "*" ||
        agent.includes("hairtrenddashboard") ||
        agent.includes("hair-trend-dashboard");
      continue;
    }

    if (!appliesToUs || (field !== "allow" && field !== "disallow") || !value) {
      continue;
    }

    const plainPath = value.endsWith("$") ? value.slice(0, -1) : value;
    const matches = value.endsWith("$")
      ? pathname === plainPath
      : pathname.startsWith(plainPath);

    if (matches && plainPath.length >= bestMatchLength) {
      bestMatchLength = plainPath.length;
      currentAllows = field === "allow";
    }
  }

  return currentAllows;
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

  if (response.status === 404 || !response.ok) {
    return;
  }

  if (response.status === 401 || response.status === 403) {
    throw new SocialMetadataError("blocked_by_robots", "Metadata access is blocked.");
  }

  if (response.status === 429) {
    throw new SocialMetadataError("rate_limited", "Rate limit was detected.");
  }

  const robotsText = (await response.text()).slice(0, 128 * 1024);
  const pathname = `${targetUrl.pathname || "/"}${targetUrl.search}`;

  if (!robotsAllows(robotsText, pathname)) {
    throw new SocialMetadataError("blocked_by_robots", "robots.txt does not allow this URL.");
  }
}

async function readLimitedText(response: Response) {
  const text = await response.text();

  if (new Blob([text]).size > maxHtmlBytes) {
    throw new SocialMetadataError("response_too_large", "The response is too large.");
  }

  return text;
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
        | Array<Record<string, unknown>>;
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

function extractMetadata(html: string, requestedUrl: string, finalUrl: string): SocialMetadata {
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
    throw new SocialMetadataError("forbidden", "TikTok oEmbed access is forbidden.");
  }

  if (response.status === 429) {
    throw new SocialMetadataError("rate_limited", "TikTok oEmbed rate limit was detected.");
  }

  if (!response.ok) {
    throw new SocialMetadataError("unavailable", "TikTok oEmbed metadata is unavailable.");
  }

  const data = (await response.json()) as TikTokOembedResponse;
  const title = cleanText(data.title, 300);
  const authorName = cleanText(data.author_name, 120);
  const thumbnailUrl = resolveReferenceUrl(data.thumbnail_url, endpoint.toString());
  const normalizedTargetUrl = normalizeSocialUrl(targetUrl.toString());
  const fallbackTitle = authorName ? `${authorName} TikTok video` : "TikTok video";
  const description = authorName
    ? `${authorName} public TikTok video. Only oEmbed metadata was checked.`
    : "Public TikTok video. Only oEmbed metadata was checked.";

  if (!title && !authorName && !thumbnailUrl) {
    throw new SocialMetadataError("invalid_content", "TikTok oEmbed metadata was empty.");
  }

  return {
    canonicalUrl: normalizedTargetUrl,
    description,
    finalUrl: normalizedTargetUrl,
    ogDescription: title || description,
    ogImageUrl: thumbnailUrl,
    ogTitle: title || fallbackTitle,
    requestedUrl: normalizeSocialUrl(requestedUrl),
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

  const response = await fetchWithValidatedRedirects(targetUrl.toString(), {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ja,en;q=0.8",
      "User-Agent": "HairTrendDashboard/1.0",
    },
    method: "GET",
  });

  if (response.status === 403) {
    throw new SocialMetadataError("forbidden", "The URL does not allow metadata access.");
  }

  if (response.status === 429) {
    throw new SocialMetadataError("rate_limited", "Rate limit was detected.");
  }

  if (!response.ok) {
    throw new SocialMetadataError("unavailable", `Metadata request failed: ${response.status}`);
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (
    !contentType.includes("text/html") &&
    !contentType.includes("application/xhtml+xml")
  ) {
    throw new SocialMetadataError("invalid_content", "The URL is not an HTML page.");
  }

  const html = await readLimitedText(response);
  const metadata = extractMetadata(html, value, response.url || targetUrl.toString());

  if (
    !metadata.title &&
    !metadata.description &&
    !metadata.ogTitle &&
    !metadata.ogDescription &&
    !metadata.ogImageUrl
  ) {
    throw new SocialMetadataError("invalid_content", "No public metadata was found.");
  }

  return metadata;
}
