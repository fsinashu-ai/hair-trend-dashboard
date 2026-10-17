import "server-only";
import {
  createAppAccessCookieValue,
  isAppAccessCookieValueValid,
  safeCompare,
} from "./appAccessCore";

export {
  APP_ACCESS_COOKIE_MAX_AGE_SECONDS,
  safeCompare,
} from "./appAccessCore";

export const APP_ACCESS_COOKIE = "hair_trend_dashboard_access";

function getBasicAuthCredentials(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Basic ")) {
    return null;
  }

  try {
    const decoded = Buffer.from(
      authorization.slice("Basic ".length),
      "base64",
    ).toString("utf8");
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex < 0) {
      return null;
    }

    return {
      password: decoded.slice(separatorIndex + 1),
      user: decoded.slice(0, separatorIndex),
    };
  } catch {
    return null;
  }
}

function getCookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const [cookieName, ...valueParts] = part.trim().split("=");
    if (cookieName === name) {
      return valueParts.join("=") || null;
    }
  }

  return null;
}

export function getAppAccessCookieValue() {
  const appPassword = process.env.APP_PASSWORD?.trim();

  if (!appPassword) {
    return null;
  }

  const appUser = process.env.APP_USER?.trim() || "salon";
  return createAppAccessCookieValue(appPassword, appUser);
}

export function hasValidAppAccessCookie(request: Request) {
  const receivedValue = getCookieValue(request, APP_ACCESS_COOKIE);
  const appPassword = process.env.APP_PASSWORD?.trim();

  if (!receivedValue || !appPassword) {
    return false;
  }

  const appUser = process.env.APP_USER?.trim() || "salon";
  return isAppAccessCookieValueValid(
    receivedValue,
    appPassword,
    appUser,
  );
}

export function hasBasicAuthAttempt(request: Request) {
  return /^Basic(?:\s|$)/i.test(request.headers.get("authorization") ?? "");
}

export function isAppRequestAuthorized(request: Request) {
  const appPassword = process.env.APP_PASSWORD?.trim();

  // Local development can still use the dummy-data fallback without a password.
  // A deployed app must never expose server-side data access without this secret.
  if (!appPassword) {
    return process.env.NODE_ENV !== "production";
  }

  if (hasValidAppAccessCookie(request)) {
    return true;
  }

  const credentials = getBasicAuthCredentials(request);
  const appUser = process.env.APP_USER?.trim() || "salon";

  return Boolean(
    credentials &&
      safeCompare(credentials.user, appUser) &&
      safeCompare(credentials.password, appPassword),
  );
}
