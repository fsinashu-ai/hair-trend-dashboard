import { createSign } from "node:crypto";
import { readFile, mkdir, appendFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseEnv } from "node:util";

const tokenUrl = "https://oauth2.googleapis.com/token";
const inspectUrl = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
const scope = "https://www.googleapis.com/auth/webmasters.readonly";
const fields = ["verdict", "coverageState", "lastCrawlTime", "googleCanonical", "userCanonical", "robotsTxtState", "indexingState", "pageFetchState", "sitemap"];

export function normalizeInspectionUrl(value) {
  const parsed = new URL(value);
  const parts = value.match(/^([a-z][a-z\d+.-]*:\/\/[^/?#]*)([^#]*)(#.*)?$/is);
  if (!parts) return parsed.href.replace(/%[0-9a-f]{2}/gi, (match) => match.toUpperCase());

  const pathAndQuery = parts[2]
    .replace(/[^\x00-\x7f]/gu, (character) => encodeURIComponent(character.toWellFormed()))
    .replace(/%[0-9a-f]{2}/gi, (match) => match.toUpperCase());
  return `${parts[1]}${pathAndQuery}${parts[3] || ""}`;
}

export function normalizePrivateKey(value) {
  return value.trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "").replace(/\\n/g, "\n");
}

export function readConfig(env) {
  const missing = [];
  let clientEmail = "";
  let privateKey = "";
  const jsonValue = env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();

  if (jsonValue) {
    try {
      const parsed = JSON.parse(jsonValue);
      if (typeof parsed.client_email === "string" && typeof parsed.private_key === "string" && parsed.client_email && parsed.private_key) {
        clientEmail = parsed.client_email.trim();
        privateKey = normalizePrivateKey(parsed.private_key);
      }
    } catch {
      missing.push("GOOGLE_SERVICE_ACCOUNT_JSON");
    }
  }
  if (!missing.length && (!clientEmail || !privateKey)) {
    clientEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || "";
    privateKey = normalizePrivateKey(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "");
    if (!clientEmail) missing.push("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    if (!privateKey) missing.push("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  }
  const siteUrl = env.SEARCH_CONSOLE_SITE_URL?.trim() || "";
  if (!siteUrl) missing.push("SEARCH_CONSOLE_SITE_URL");
  return { clientEmail, privateKey, siteUrl, missing };
}

function normalizeKeyFilePath(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

async function loadConfig(env, readKeyFile) {
  const keyFilePath = normalizeKeyFilePath(env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || "");
  if (!keyFilePath) return { config: readConfig(env), keyFilePath: "" };

  let content;
  try {
    content = await readKeyFile(keyFilePath, "utf8");
  } catch (error) {
    return { error: error?.code === "ENOENT" ? "GOOGLE_SERVICE_ACCOUNT_KEY_FILE: 見つからない" : "GOOGLE_SERVICE_ACCOUNT_KEY_FILE: 読めない" };
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { error: "GOOGLE_SERVICE_ACCOUNT_KEY_FILE: 読めない" };
  }
  if (typeof parsed?.client_email !== "string" || !parsed.client_email.trim() || typeof parsed?.private_key !== "string" || !normalizePrivateKey(parsed.private_key)) {
    return { error: "GOOGLE_SERVICE_ACCOUNT_KEY_FILE: 項目がない" };
  }
  const config = {
    clientEmail: parsed.client_email.trim(),
    privateKey: normalizePrivateKey(parsed.private_key),
    siteUrl: env.SEARCH_CONSOLE_SITE_URL?.trim() || "",
    missing: [],
  };
  if (!config.siteUrl) config.missing.push("SEARCH_CONSOLE_SITE_URL");
  return { config, keyFilePath, keyFileContent: content };
}

function redact(value, secrets) {
  let result = String(value);
  for (const secret of secrets) {
    if (secret) result = result.split(secret).join("[非表示]");
  }
  return result;
}

function cell(value, secrets) {
  if (Array.isArray(value)) value = value.join(", ");
  if (value === undefined || value === null || value === "") return "なし";
  return redact(value, secrets).replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
}

function japanDateTime(value) {
  if (!value) return "なし";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "なし";
  return `${new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(date)} JST`;
}

export function formatReport(results, secrets = []) {
  const lines = ["# Search Console URL検査", ""];
  for (const result of results) {
    lines.push(`## ${cell(result.url, secrets)}`, "");
    if (result.inputUrl && result.inputUrl !== result.url) {
      lines.push(`入力: ${cell(result.inputUrl, secrets)}`, "");
    }
    if (result.error) {
      lines.push("| HTTP | error.message |", "| --- | --- |", `| ${cell(result.error.status, secrets)} | ${cell(result.error.message, secrets)} |`, "");
      continue;
    }
    lines.push("| 項目 | 値 |", "| --- | --- |");
    for (const field of fields) {
      const value = field === "lastCrawlTime" ? japanDateTime(result.indexStatusResult?.[field]) : result.indexStatusResult?.[field];
      lines.push(`| ${field} | ${cell(value, secrets)} |`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

async function getAccessToken(config, fetchImpl, now) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const encode = (value) => Buffer.from(value).toString("base64url");
  const header = encode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = encode(JSON.stringify({ aud: tokenUrl, exp: issuedAt + 3600, iat: issuedAt, iss: config.clientEmail, scope }));
  const unsigned = `${header}.${claims}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(config.privateKey);
  const assertion = `${unsigned}.${encode(signature)}`;
  const response = await fetchImpl(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ assertion, grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer" }),
    signal: AbortSignal.timeout(20_000),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || typeof json.access_token !== "string" || !json.access_token) throw new Error("token");
  return json.access_token;
}

export async function inspectUrls(urls, siteUrl, accessToken, fetchImpl = fetch) {
  const results = [];
  for (const url of urls) {
    try {
      const response = await fetchImpl(inspectUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ inspectionUrl: url, siteUrl, languageCode: "ja" }),
        signal: AbortSignal.timeout(20_000),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        results.push({ url, error: { status: response.status, message: typeof json.error?.message === "string" ? json.error.message : "なし" } });
      } else {
        results.push({ url, indexStatusResult: json.inspectionResult?.indexStatusResult || {} });
      }
    } catch {
      results.push({ url, error: { status: "なし", message: "通信に失敗しました" } });
    }
  }
  return results;
}

export async function writeReport(markdown, now, { mkdirImpl = mkdir, appendFileImpl = appendFile } = {}) {
  const date = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10).replaceAll("-", "");
  const directory = join(process.cwd(), "runtime-data", "search-console");
  await mkdirImpl(directory, { recursive: true });
  await appendFileImpl(join(directory, `inspect-${date}.md`), `\n---\n\n実行: ${japanDateTime(now)}\n\n${markdown}`, "utf8");
}

export async function main({ args = process.argv.slice(2), env, fetchImpl = fetch, now = new Date(), save = writeReport, output = console.log, errorOutput = console.error, readKeyFile = readFile } = {}) {
  if (args.length === 0) {
    output("使い方: npm.cmd run sc:inspect -- <URL> [<URL> ...]");
    return 0;
  }
  if (args.length > 20 || args.some((url) => {
    try {
      const parsed = new URL(url);
      return !["http:", "https:"].includes(parsed.protocol) || Boolean(parsed.username || parsed.password);
    } catch {
      return true;
    }
  })) {
    errorOutput("URLは認証情報を含まないhttpまたはhttpsのURLを1〜20件指定してください。");
    return 1;
  }
  if (!env) {
    try {
      env = parseEnv(await readFile(join(process.cwd(), ".env.local"), "utf8"));
    } catch (error) {
      if (error?.code !== "ENOENT") {
        errorOutput(".env.local を読み取れません。");
        return 1;
      }
      env = {};
    }
  }
  const loaded = await loadConfig(env, readKeyFile);
  if (loaded.error) {
    errorOutput(loaded.error);
    return 1;
  }
  const config = loaded.config;
  if (config.missing.length) {
    errorOutput(config.missing.join("\n"));
    return 1;
  }
  let accessToken;
  try {
    accessToken = await getAccessToken(config, fetchImpl, now);
  } catch {
    errorOutput("Google OAuthトークンの取得に失敗しました。");
    return 1;
  }
  const secrets = [config.privateKey, config.privateKey.replace(/\n/g, "\\n"), env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, env.GOOGLE_SERVICE_ACCOUNT_JSON, env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE, loaded.keyFilePath, loaded.keyFileContent, config.clientEmail, accessToken].filter(Boolean).sort((first, second) => second.length - first.length);
  const urls = args.map(normalizeInspectionUrl);
  const results = (await inspectUrls(urls, config.siteUrl, accessToken, fetchImpl))
    .map((result, index) => ({ ...result, inputUrl: args[index] }));
  const markdown = formatReport(results, secrets);
  try {
    await save(markdown, now);
  } catch {
    errorOutput("検査結果の保存に失敗しました。");
    return 1;
  }
  output(markdown);
  return results.some((result) => result.error) ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then((code) => { process.exitCode = code; }).catch(() => {
    console.error("URL検査に失敗しました。");
    process.exitCode = 1;
  });
}
