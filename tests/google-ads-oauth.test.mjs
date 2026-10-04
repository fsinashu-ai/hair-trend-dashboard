import assert from "node:assert/strict";
import test from "node:test";
import {
  googleAdsOAuthErrorMessage,
  readGoogleOAuthErrorCode,
} from "../src/lib/ads/googleAdsOauth.ts";

test("reads a safe OAuth error code", () => {
  assert.equal(readGoogleOAuthErrorCode({ error: "invalid_grant" }), "invalid_grant");
  assert.equal(readGoogleOAuthErrorCode({ error: " INVALID_CLIENT " }), "invalid_client");
});

test("rejects malformed OAuth error codes", () => {
  assert.equal(readGoogleOAuthErrorCode({ error: "invalid grant: secret=value" }), "unknown_error");
  assert.equal(readGoogleOAuthErrorCode(null), "unknown_error");
});

test("gives an actionable message for an expired refresh token", () => {
  const message = googleAdsOAuthErrorMessage("invalid_grant", 400);
  assert.match(message, /Refresh Token/);
  assert.match(message, /本番環境/);
  assert.match(message, /GOOGLE_ADS_REFRESH_TOKEN/);
});

test("does not include an upstream error description", () => {
  const message = googleAdsOAuthErrorMessage("unknown_error", 400);
  assert.equal(message.includes("client_secret"), false);
  assert.match(message, /unknown_error/);
});
