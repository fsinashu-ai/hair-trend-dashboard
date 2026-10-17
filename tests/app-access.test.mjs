import assert from "node:assert/strict";
import test from "node:test";
import {
  APP_ACCESS_COOKIE_MAX_AGE_SECONDS,
  createAppAccessCookieValue,
  isAppAccessCookieValueValid,
} from "../src/lib/security/appAccessCore.ts";
import {
  checkBasicAuthRequest,
  clearBasicAuthFailures,
  getBasicAuthLockoutSeconds,
  recordBasicAuthFailure,
} from "../src/lib/security/loginRateLimit.ts";

const appPassword = "test-password";
const appUser = "salon";

test("v2 access cookie verifies after issue", () => {
  const issuedAt = 1_800_000_000;
  const cookie = createAppAccessCookieValue(appPassword, appUser, issuedAt);

  assert.match(cookie, /^v2\.1800000000\.[A-Za-z0-9_-]{43}$/);
  assert.equal(
    isAppAccessCookieValueValid(cookie, appPassword, appUser, issuedAt),
    true,
  );
});

test("access cookie expires after twelve hours", () => {
  const issuedAt = 1_800_000_000;
  const cookie = createAppAccessCookieValue(appPassword, appUser, issuedAt);

  assert.equal(
    isAppAccessCookieValueValid(
      cookie,
      appPassword,
      appUser,
      issuedAt + APP_ACCESS_COOKIE_MAX_AGE_SECONDS + 1,
    ),
    false,
  );
});

test("access cookie rejects timestamps too far in the future", () => {
  const issuedAt = 1_800_000_000;
  const cookie = createAppAccessCookieValue(appPassword, appUser, issuedAt);

  assert.equal(
    isAppAccessCookieValueValid(cookie, appPassword, appUser, issuedAt - 61),
    false,
  );
});

test("access cookie rejects a tampered signature", () => {
  const issuedAt = 1_800_000_000;
  const cookie = createAppAccessCookieValue(appPassword, appUser, issuedAt);
  const lastCharacter = cookie.at(-1);
  const tamperedCookie = `${cookie.slice(0, -1)}${lastCharacter === "A" ? "B" : "A"}`;

  assert.equal(
    isAppAccessCookieValueValid(tamperedCookie, appPassword, appUser, issuedAt),
    false,
  );
});

test("access cookie rejects malformed and legacy values", () => {
  const malformedValues = [
    "v1.1800000000.signature",
    "v2.not-a-time.signature",
    "v2.1800000000",
    "v2.1800000000.signature.extra",
    "v2.-1.signature",
  ];

  for (const value of malformedValues) {
    assert.equal(
      isAppAccessCookieValueValid(value, appPassword, appUser, 1_800_000_000),
      false,
      value,
    );
  }
});

test("Basic auth limit blocks on the tenth failure and clears on success", () => {
  const store = new Map();
  const clientIp = "203.0.113.10";
  const now = 1_800_000_000_000;

  for (let attempt = 1; attempt < 10; attempt += 1) {
    assert.equal(recordBasicAuthFailure(store, clientIp, now), 0);
  }

  assert.ok(recordBasicAuthFailure(store, clientIp, now) > 0);
  assert.ok(getBasicAuthLockoutSeconds(store, clientIp, now) > 0);

  clearBasicAuthFailures(store, clientIp);
  assert.equal(getBasicAuthLockoutSeconds(store, clientIp, now), 0);
  assert.equal(recordBasicAuthFailure(store, clientIp, now), 0);
});

test("lockout skips Basic verification unless a valid cookie is present", () => {
  const store = new Map();
  const clientIp = "203.0.113.11";
  const now = 1_800_000_000_000;
  let verificationCalled = false;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    recordBasicAuthFailure(store, clientIp, now);
  }

  const lockedRequest = checkBasicAuthRequest(
    store,
    clientIp,
    false,
    () => {
      verificationCalled = true;
      return true;
    },
    now,
  );

  assert.equal(lockedRequest.authorized, false);
  assert.ok(lockedRequest.retryAfterSeconds > 0);
  assert.equal(verificationCalled, false);

  const cookieRequest = checkBasicAuthRequest(
    store,
    clientIp,
    true,
    () => {
      verificationCalled = true;
      return false;
    },
    now,
  );

  assert.equal(cookieRequest.authorized, true);
  assert.equal(cookieRequest.retryAfterSeconds, 0);
  assert.equal(verificationCalled, false);
});
