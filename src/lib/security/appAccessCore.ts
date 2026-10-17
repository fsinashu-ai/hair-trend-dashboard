import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const APP_ACCESS_COOKIE_MAX_AGE_SECONDS = 12 * 60 * 60;
const appAccessCookieVersion = "v2";
const allowedFutureSkewSeconds = 60;

export function createAppAccessCookieValue(
  appPassword: string,
  appUser: string,
  issuedAtSeconds = Math.floor(Date.now() / 1000),
) {
  if (!Number.isSafeInteger(issuedAtSeconds) || issuedAtSeconds < 0) {
    throw new Error("Cookie issue time must be a non-negative integer.");
  }

  const signature = createHmac("sha256", appPassword)
    .update(`${appAccessCookieVersion}:${appUser}:${issuedAtSeconds}`)
    .digest("base64url");

  return `${appAccessCookieVersion}.${issuedAtSeconds}.${signature}`;
}

export function isAppAccessCookieValueValid(
  receivedValue: string,
  appPassword: string,
  appUser: string,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const parts = receivedValue.split(".");
  if (parts.length !== 3 || parts[0] !== appAccessCookieVersion) {
    return false;
  }

  const [, issuedAtText, receivedSignature] = parts;
  if (!/^(0|[1-9]\d*)$/.test(issuedAtText)) {
    return false;
  }

  const issuedAtSeconds = Number(issuedAtText);
  if (
    !Number.isSafeInteger(issuedAtSeconds) ||
    issuedAtSeconds > nowSeconds + allowedFutureSkewSeconds ||
    nowSeconds - issuedAtSeconds >= APP_ACCESS_COOKIE_MAX_AGE_SECONDS
  ) {
    return false;
  }

  const expectedSignature = createHmac("sha256", appPassword)
    .update(`${appAccessCookieVersion}:${appUser}:${issuedAtSeconds}`)
    .digest("base64url");
  const receivedBuffer = Buffer.from(receivedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

export function safeCompare(value: string, expectedValue: string) {
  const valueHash = createHash("sha256").update(value, "utf8").digest();
  const expectedHash = createHash("sha256")
    .update(expectedValue, "utf8")
    .digest();

  return timingSafeEqual(valueHash, expectedHash);
}
