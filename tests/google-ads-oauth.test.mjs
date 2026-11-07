import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function serviceAccountFixture() {
  const calls = [];
  const exports = {};
  const source = readFileSync(new URL("../src/lib/google/serviceAccount.server.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, {
    exports,
    require(name) {
      assert.equal(name, "node:crypto");
      return { createSign() { return { update() { return this; }, sign() { return Buffer.from("fake-signature"); } }; } };
    },
    process: { env: { GOOGLE_SERVICE_ACCOUNT_EMAIL: "fake@example.test", GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "fake-private-key" } },
    Buffer, URLSearchParams, AbortSignal, Date,
    async fetch(url, options) {
      calls.push({ url, options });
      return { ok: true, async json() { return { access_token: `fake-token-${calls.length}`, expires_in: 3600 }; } };
    },
  });
  return { service: exports, calls };
}

test("service account token uses the requested scope and caches tokens separately", async () => {
  const { service, calls } = serviceAccountFixture();
  const adsScope = "https://www.googleapis.com/auth/adwords";
  const ga4Scope = "https://www.googleapis.com/auth/analytics.readonly";
  assert.equal(service.isGoogleServiceAccountConfigured(), true);
  assert.equal(await service.getGoogleServiceAccountAccessToken(adsScope), "fake-token-1");
  assert.equal(await service.getGoogleServiceAccountAccessToken(adsScope), "fake-token-1");
  assert.equal(await service.getGoogleServiceAccountAccessToken(ga4Scope), "fake-token-2");
  assert.equal(calls.length, 2);
  const assertion = calls[0].options.body.get("assertion");
  const claims = JSON.parse(Buffer.from(assertion.split(".")[1], "base64url").toString("utf8"));
  assert.equal(claims.scope, adsScope);
  assert.equal(calls[0].options.body.get("grant_type"), "urn:ietf:params:oauth:grant-type:jwt-bearer");
});
