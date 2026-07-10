import { NextRequest, NextResponse } from "next/server";
import {
  APP_ACCESS_COOKIE,
  getAppAccessCookieValue,
  isAppRequestAuthorized,
} from "@/lib/security/appAccess.server";

const authRealm = "Hair Trend Dashboard";

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
      request.nextUrl.pathname === "/api/seo/ga4/fetch") &&
    request.headers.get("authorization") === `Bearer ${cronSecret}`
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
    (authorization === `Bearer ${automationSecret}` ||
      headerSecret === automationSecret)
  );
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

export function proxy(request: NextRequest) {
  if (isAuthorizedCronRequest(request)) {
    return withSecurityHeaders(NextResponse.next());
  }

  if (isAuthorizedAutomationRequest(request)) {
    return withSecurityHeaders(NextResponse.next());
  }

  if (!isAuthenticated(request)) {
    return createUnauthorizedResponse(request);
  }

  const response = NextResponse.next();
  const accessCookie = getAppAccessCookieValue();

  if (accessCookie && !request.cookies.get(APP_ACCESS_COOKIE)) {
    response.cookies.set({
      httpOnly: true,
      maxAge: 60 * 60 * 12,
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
