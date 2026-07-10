import { NextResponse } from "next/server";
import { isAppRequestAuthorized } from "@/lib/security/appAccess.server";

export const runtime = "nodejs";

const allowedTables = new Set([
  "keywords",
  "trend_links",
  "ai_outputs",
  "trend_sources",
  "sns_posts",
  "social_sources",
  "social_posts",
  "blog_posts",
]);
const forwardedRequestHeaders = [
  "accept",
  "accept-profile",
  "cache-control",
  "content-type",
  "content-profile",
  "if-match",
  "if-none-match",
  "prefer",
  "range",
  "x-client-info",
  "x-upsert",
];
const forwardedResponseHeaders = [
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "location",
  "range-unit",
  "x-supabase-api-version",
];
const maxForwardedBodyBytes = 8 * 1024 * 1024;

function getSupabaseServerConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    .replace(/\/rest\/v1\/?$/, "")
    .replace(/\/+$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  return url && serviceRoleKey ? { serviceRoleKey, url } : null;
}

function isAllowedPath(path: string[]) {
  const [service, version, resource, bucket] = path;

  if (service === "rest" && version === "v1" && resource) {
    return allowedTables.has(resource);
  }

  return (
    service === "storage" &&
    version === "v1" &&
    resource === "object" &&
    bucket === "hair-images"
  );
}

function createForwardHeaders(request: Request, serviceRoleKey: string) {
  const headers = new Headers();

  forwardedRequestHeaders.forEach((header) => {
    const value = request.headers.get(header);
    if (value) headers.set(header, value);
  });
  headers.set("apikey", serviceRoleKey);
  headers.set("authorization", `Bearer ${serviceRoleKey}`);

  return headers;
}

function createResponseHeaders(response: Response) {
  const headers = new Headers({ "Cache-Control": "no-store" });

  forwardedResponseHeaders.forEach((header) => {
    const value = response.headers.get(header);
    if (value) headers.set(header, value);
  });

  return headers;
}

async function handleRequest(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  if (!isAppRequestAuthorized(request)) {
    return NextResponse.json(
      { error: "アプリのパスワード認証が必要です。" },
      { status: 401 },
    );
  }

  const { path } = await context.params;

  if (!isAllowedPath(path)) {
    return NextResponse.json({ error: "許可されていないデータ操作です。" }, { status: 403 });
  }

  const config = getSupabaseServerConfig();

  if (!config) {
    return NextResponse.json(
      { error: "Supabaseのサーバー設定が不足しています。" },
      { status: 503 },
    );
  }

  const requestUrl = new URL(request.url);
  const targetUrl = new URL(`${config.url}/${path.join("/")}`);
  targetUrl.search = requestUrl.search;
  const contentLength = Number(request.headers.get("content-length") || "0");

  if (Number.isFinite(contentLength) && contentLength > maxForwardedBodyBytes) {
    return NextResponse.json({ error: "アップロードできるファイルは8MB以下です。" }, { status: 413 });
  }

  const requestBody =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  if (requestBody && requestBody.byteLength > maxForwardedBodyBytes) {
    return NextResponse.json({ error: "アップロードできるファイルは8MB以下です。" }, { status: 413 });
  }

  try {
    const response = await fetch(targetUrl, {
      body: requestBody,
      cache: "no-store",
      headers: createForwardHeaders(request, config.serviceRoleKey),
      method: request.method,
      redirect: "manual",
    });

    return new NextResponse(response.body, {
      headers: createResponseHeaders(response),
      status: response.status,
      statusText: response.statusText,
    });
  } catch {
    return NextResponse.json(
      { error: "Supabaseとの通信に失敗しました。時間をおいて再度お試しください。" },
      { status: 502 },
    );
  }
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PATCH = handleRequest;
export const PUT = handleRequest;
export const DELETE = handleRequest;
export const HEAD = handleRequest;
