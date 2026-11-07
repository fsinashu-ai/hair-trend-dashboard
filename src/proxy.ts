import { NextRequest, NextResponse } from "next/server";
import {
  APP_ACCESS_COOKIE,
  APP_ACCESS_COOKIE_MAX_AGE_SECONDS,
  getAppAccessCookieValue,
  hasBasicAuthAttempt,
  hasValidAppAccessCookie,
  isAppRequestAuthorized,
  safeCompare,
} from "@/lib/security/appAccess.server";
import {
  checkBasicAuthRequest,
  clearBasicAuthFailures,
  recordBasicAuthFailure,
  type LoginRateLimitEntry,
} from "@/lib/security/loginRateLimit";

const authRealm = "Hair Trend Dashboard";
// On Vercel this in-memory limit is best-effort per instance.
const basicAuthFailures = new Map<string, LoginRateLimitEntry>();

const securityHeaders = {
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function isAuthenticated(request: NextRequest) {
  return isAppRequestAuthorized(request);
}

function isAuthorizedCronRequest(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return false;
  }

  return (
    request.method === "GET" &&
    (request.nextUrl.pathname === "/api/trends/auto-generate" ||
      request.nextUrl.pathname === "/api/youtube/auto-generate" ||
      request.nextUrl.pathname === "/api/seo/ga4/fetch" ||
      request.nextUrl.pathname === "/api/seo/monthly-fetch" ||
      request.nextUrl.pathname === "/api/ads/google/monthly-fetch" ||
      request.nextUrl.pathname === "/api/seo/search-console/fetch") &&
    safeCompare(
      request.headers.get("authorization") ?? "",
      `Bearer ${cronSecret}`,
    )
  );
}

function isAuthorizedAutomationRequest(request: NextRequest) {
  const automationSecret = process.env.AUTOMATION_WEBHOOK_SECRET?.trim();

  if (!automationSecret) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-automation-secret");

  return (
    request.method === "POST" &&
    request.nextUrl.pathname === "/api/automation/import-social" &&
    (safeCompare(authorization ?? "", `Bearer ${automationSecret}`) ||
      safeCompare(headerSecret ?? "", automationSecret))
  );
}

function getClientIp(request: NextRequest) {
  const forwardedIp = request.headers
    .get("x-forwarded-for")
    ?.split(",", 1)[0]
    .trim();
  const realIp = request.headers.get("x-real-ip")?.trim();

  return forwardedIp || realIp || "unknown";
}

function withSecurityHeaders(response: NextResponse) {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

function createUnauthorizedResponse(request: NextRequest) {
  const headers = {
    ...securityHeaders,
    "Cache-Control": "no-store",
    "WWW-Authenticate": `Basic realm="${authRealm}", charset="UTF-8"`,
  };

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "アプリのパスワード認証が必要です。" },
      { headers, status: 401 },
    );
  }

  return new NextResponse("Authentication required.", {
    headers,
    status: 401,
  });
}

function createRateLimitedResponse(
  request: NextRequest,
  retryAfterSeconds: number,
) {
  const message = "Too many failed authentication attempts. Try again later.";
  const headers = {
    ...securityHeaders,
    "Cache-Control": "no-store",
    "Retry-After": String(retryAfterSeconds),
  };

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: message },
      { headers, status: 429 },
    );
  }

  return new NextResponse(message, { headers, status: 429 });
}

export function proxy(request: NextRequest) {
  if (isAuthorizedCronRequest(request)) {
    return withSecurityHeaders(NextResponse.next());
  }

  if (isAuthorizedAutomationRequest(request)) {
    return withSecurityHeaders(NextResponse.next());
  }

  const clientIp = getClientIp(request);
  const hasValidAccessCookie = hasValidAppAccessCookie(request);
  const authCheck = checkBasicAuthRequest(
    basicAuthFailures,
    clientIp,
    hasValidAccessCookie,
    () => isAuthenticated(request),
  );

  if (authCheck.retryAfterSeconds > 0) {
    return createRateLimitedResponse(request, authCheck.retryAfterSeconds);
  }

  if (!authCheck.authorized) {
    if (hasBasicAuthAttempt(request)) {
      const retryAfterSeconds = recordBasicAuthFailure(
        basicAuthFailures,
        clientIp,
      );

      if (retryAfterSeconds > 0) {
        return createRateLimitedResponse(request, retryAfterSeconds);
      }
    }

    return createUnauthorizedResponse(request);
  }

  clearBasicAuthFailures(basicAuthFailures, clientIp);

  const response = NextResponse.next();
  const accessCookie = getAppAccessCookieValue();

  if (accessCookie && !hasValidAccessCookie) {
    response.cookies.set({
      httpOnly: true,
      maxAge: APP_ACCESS_COOKIE_MAX_AGE_SECONDS,
      name: APP_ACCESS_COOKIE,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      value: accessCookie,
    });
  }

  return withSecurityHeaders(response);
}

export const config = {
  matcher: ["/((?!favicon.ico|robots.txt|sitemap.xml).*)"],
};
