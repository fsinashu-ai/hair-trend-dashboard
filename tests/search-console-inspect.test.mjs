import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import test from "node:test";
import { formatReport, main, normalizePrivateKey, readConfig } from "../tools/search-console/inspect-urls.mjs";

test("サービスアカウントの秘密鍵を既存の形式と同じように整える", () => {
  assert.equal(normalizePrivateKey('  "first\\nsecond"  '), "first\nsecond");
  assert.equal(normalizePrivateKey(" 'first\\nsecond' "), "first\nsecond");
  const config = readConfig({ GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: " test@example.invalid ", private_key: "first\\nsecond" }), SEARCH_CONSOLE_SITE_URL: "sc-domain:example.invalid" });
  assert.equal(config.clientEmail, "test@example.invalid");
  assert.equal(config.privateKey, "first\nsecond");
  assert.deepEqual(config.missing, []);
  assert.deepEqual(readConfig({}).missing, ["GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "SEARCH_CONSOLE_SITE_URL"]);
  assert.deepEqual(readConfig({ GOOGLE_SERVICE_ACCOUNT_JSON: "{" }).missing, ["GOOGLE_SERVICE_ACCOUNT_JSON", "SEARCH_CONSOLE_SITE_URL"]);
});

test("URLがない場合は設定を読まずに使い方を表示する", async () => {
  const messages = [];
  const code = await main({ args: [], output: (message) => messages.push(message), fetchImpl: () => { throw new Error("通信しない"); } });
  assert.equal(code, 0);
  assert.match(messages[0], /npm\.cmd run sc:inspect/);
});

test("設定不足は名前のみを表示し通信しない", async () => {
  const errors = [];
  const code = await main({ args: ["https://example.invalid/"], env: {}, errorOutput: (message) => errors.push(message), fetchImpl: () => { throw new Error("通信しない"); } });
  assert.equal(code, 1);
  assert.equal(errors.join("\n"), "GOOGLE_SERVICE_ACCOUNT_EMAIL\nGOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY\nSEARCH_CONSOLE_SITE_URL");
});

test("検査応答の指定項目を表にし、欠損と日本時間を表示する", () => {
  const report = formatReport([{ url: "https://example.invalid/a", indexStatusResult: { verdict: "PASS", coverageState: "登録済み", lastCrawlTime: "2026-11-21T16:05:06Z", googleCanonical: "https://example.invalid/a", sitemap: ["https://example.invalid/a.xml", "https://example.invalid/b.xml"] } }]);
  assert.match(report, /\| verdict \| PASS \|/);
  assert.match(report, /\| coverageState \| 登録済み \|/);
  assert.match(report, /\| lastCrawlTime \| 2026\/11\/22 01:05:06 JST \|/);
  assert.match(report, /\| userCanonical \| なし \|/);
  assert.match(report, /\| sitemap \| https:\/\/example\.invalid\/a\.xml, https:\/\/example\.invalid\/b\.xml \|/);
  assert.match(formatReport([{ url: "https://example.invalid", indexStatusResult: { sitemap: [], lastCrawlTime: "invalid" } }]), /\| sitemap \| なし \|/);
});

test("署名した読み取り専用トークンで順に検査し、エラー後も続けて秘密を出さない", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
  const accessToken = "fake-access-token-for-test";
  const email = "service@example.invalid";
  const siteUrl = "sc-domain:example.invalid";
  const urls = ["https://example.invalid/first", "https://example.invalid/second"];
  const calls = [];
  const output = [];
  let saved = "";
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) {
      const assertion = options.body.get("assertion");
      const [header, claims, signature] = assertion.split(".");
      const payload = JSON.parse(Buffer.from(claims, "base64url").toString());
      assert.equal(payload.scope, "https://www.googleapis.com/auth/webmasters.readonly");
      assert.equal(payload.iss, email);
      assert.equal(payload.aud, "https://oauth2.googleapis.com/token");
      assert.equal(createVerify("RSA-SHA256").update(`${header}.${claims}`).verify(publicKey, Buffer.from(signature, "base64url")), true);
      return { ok: true, json: async () => ({ access_token: accessToken }) };
    }
    assert.equal(url, "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect");
    assert.equal(options.headers.Authorization, `Bearer ${accessToken}`);
    assert.deepEqual(JSON.parse(options.body), { inspectionUrl: urls[calls.length - 2], siteUrl, languageCode: "ja" });
    if (calls.length === 2) return { ok: false, status: 403, json: async () => ({ error: { message: `拒否 ${accessToken} ${privateKey} ${email}`, extra: "not-for-output" } }) };
    return { ok: true, json: async () => ({ inspectionResult: { indexStatusResult: { verdict: "PASS" }, extra: "not-for-output" } }) };
  };
  const code = await main({
    args: urls,
    env: { GOOGLE_SERVICE_ACCOUNT_EMAIL: email, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: privateKey, SEARCH_CONSOLE_SITE_URL: siteUrl },
    fetchImpl,
    now: new Date("2026-11-21T16:00:00Z"),
    save: async (markdown) => { saved = markdown; },
    output: (message) => output.push(message),
    errorOutput: (message) => output.push(message),
  });
  assert.equal(code, 1);
  assert.equal(calls.length, 3);
  assert.equal(output[0], saved);
  assert.match(saved, /\| 403 \| 拒否/);
  assert.match(saved, /\| verdict \| PASS \|/);
  for (const secret of [privateKey, accessToken, email, "not-for-output"]) assert.equal(saved.includes(secret), false);
});

test("件数超過では通信せず拒否する", async () => {
  const code = await main({ args: Array(21).fill("https://example.invalid/"), env: {}, fetchImpl: () => { throw new Error("通信しない"); }, errorOutput: () => {} });
  assert.equal(code, 1);
});

test("鍵ファイルを優先し、引用符を除いた場所から読み、鍵とメールを出力から隠す", async () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
  const email = "file-service@example.invalid";
  const token = "mock-token";
  const keyFilePath = "mock-key-path";
  const keyContent = JSON.stringify({ client_email: ` ${email} `, private_key: privateKey.replace(/\n/g, "\\n") });
  const output = [];
  let saved = "";
  let calls = 0;
  const code = await main({
    args: ["https://example.invalid/article"],
    env: {
      GOOGLE_SERVICE_ACCOUNT_KEY_FILE: `  ' ${keyFilePath} '  `,
      GOOGLE_SERVICE_ACCOUNT_JSON: "invalid fallback",
      GOOGLE_SERVICE_ACCOUNT_EMAIL: "other@example.invalid",
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "other-key",
      SEARCH_CONSOLE_SITE_URL: "sc-domain:example.invalid",
    },
    readKeyFile: async (path, encoding) => {
      assert.equal(path === keyFilePath && encoding === "utf8", true);
      return keyContent;
    },
    fetchImpl: async (_url, options) => {
      calls += 1;
      if (calls === 1) {
        const claims = options.body.get("assertion").split(".")[1];
        assert.equal(JSON.parse(Buffer.from(claims, "base64url").toString()).iss === email, true);
        return { ok: true, json: async () => ({ access_token: token }) };
      }
      return { ok: false, status: 403, json: async () => ({ error: { message: `拒否 ${privateKey} ${email} ${token} ${keyFilePath} ${keyContent}` } }) };
    },
    save: async (markdown) => { saved = markdown; },
    output: (message) => output.push(message),
    errorOutput: (message) => output.push(message),
  });
  assert.equal(code, 1);
  assert.equal(calls, 2);
  assert.equal(output[0], saved);
  assert.match(saved, /\| 403 \| 拒否/);
  for (const secret of [privateKey, privateKey.replace(/\n/g, "\\n"), email, token, keyFilePath, keyContent]) {
    assert.equal(saved.includes(secret), false);
  }
});

test("鍵ファイルに問題がある場合は種類だけを表示して処理を止める", async () => {
  const cases = [
    { read: async () => { throw Object.assign(new Error("private path"), { code: "ENOENT" }); }, expected: "見つからない" },
    { read: async () => { throw Object.assign(new Error("private path"), { code: "EACCES" }); }, expected: "読めない" },
    { read: async () => "{ broken", expected: "読めない" },
    { read: async () => JSON.stringify({ client_email: "example@example.invalid" }), expected: "項目がない" },
    { read: async () => JSON.stringify({ private_key: "mock-key" }), expected: "項目がない" },
    { read: async () => "null", expected: "項目がない" },
    { read: async () => JSON.stringify({ client_email: "  ", private_key: "mock-key" }), expected: "項目がない" },
  ];
  for (const item of cases) {
    const errors = [];
    const code = await main({
      args: ["https://example.invalid/"],
      env: { GOOGLE_SERVICE_ACCOUNT_KEY_FILE: ' "mock-key-path" ', GOOGLE_SERVICE_ACCOUNT_JSON: "{}", SEARCH_CONSOLE_SITE_URL: "sc-domain:example.invalid" },
      readKeyFile: item.read,
      fetchImpl: () => { throw new Error("通信しない"); },
      save: () => { throw new Error("保存しない"); },
      errorOutput: (message) => errors.push(message),
    });
    assert.equal(code, 1);
    assert.deepEqual(errors, [`GOOGLE_SERVICE_ACCOUNT_KEY_FILE: ${item.expected}`]);
  }
});
