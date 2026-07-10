import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const APP_ACCESS_COOKIE = "hair_trend_dashboard_access";
const appAccessCookieVersion = "v1";

function safeCompare(value: string, expectedValue: string) {
  const maxLength = Math.max(value.length, expectedValue.length);
  let mismatch = value.length === expectedValue.length ? 0 : 1;

  for (let index = 0; index < maxLength; index += 1) {
    mismatch |=
      (value.charCodeAt(index) || 0) ^ (expectedValue.charCodeAt(index) || 0);
  }

  return mismatch === 0;
}

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
  return createHmac("sha256", appPassword)
    .update(`${appAccessCookieVersion}:${appUser}`)
    .digest("base64url");
}

function hasValidAppAccessCookie(request: Request) {
  const receivedValue = getCookieValue(request, APP_ACCESS_COOKIE);
  const expectedValue = getAppAccessCookieValue();

  if (!receivedValue || !expectedValue) {
    return false;
  }

  const receivedBuffer = Buffer.from(receivedValue);
  const expectedBuffer = Buffer.from(expectedValue);

  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
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
