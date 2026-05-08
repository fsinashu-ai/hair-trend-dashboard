import { NextRequest, NextResponse } from "next/server";

const authRealm = "Hair Trend Dashboard";

const securityHeaders = {
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function safeCompare(value: string, expectedValue: string) {
  const maxLength = Math.max(value.length, expectedValue.length);
  let mismatch = value.length === expectedValue.length ? 0 : 1;

  for (let index = 0; index < maxLength; index += 1) {
    mismatch |=
      (value.charCodeAt(index) || 0) ^ (expectedValue.charCodeAt(index) || 0);
  }

  return mismatch === 0;
}

function getBasicAuthCredentials(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Basic ")) {
    return null;
  }

  try {
    const decodedValue = atob(authorization.slice("Basic ".length));
    const separatorIndex = decodedValue.indexOf(":");

    if (separatorIndex === -1) {
      return null;
    }

    return {
      password: decodedValue.slice(separatorIndex + 1),
      user: decodedValue.slice(0, separatorIndex),
    };
  } catch {
    return null;
  }
}

function isAuthenticated(request: NextRequest) {
  const appPassword = process.env.APP_PASSWORD;

  if (!appPassword) {
    return true;
  }

  const credentials = getBasicAuthCredentials(request);
  const appUser = process.env.APP_USER || "salon";

  if (!credentials) {
    return false;
  }

  return (
    safeCompare(credentials.user, appUser) &&
    safeCompare(credentials.password, appPassword)
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
  if (!isAuthenticated(request)) {
    return createUnauthorizedResponse(request);
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!favicon.ico|robots.txt|sitemap.xml).*)"],
};
