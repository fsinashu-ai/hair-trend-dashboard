import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const crypto = require("node:crypto");

function loadModule(path, modules, env = {}, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(code, {
    exports,
    require(name) {
      assert.ok(Object.hasOwn(modules, name), `unexpected dependency: ${name}`);
      return modules[name];
    },
    process: { env },
    Date,
    URLSearchParams,
    AbortSignal,
    console: { error() {}, warn() {} },
    fetch() { throw new Error("unexpected external request"); },
    ...globals,
  });
  return exports;
}

const NextResponse = {
  json(body, init = {}) { return new Response(JSON.stringify(body), { status: init.status ?? 200 }); },
  next() { return new Response(null, { status: 200 }); },
};

function mockDatabase() {
  const imports = [];
  const rows = [];
  let sequence = 0;
  let failNextRowInsert = false;
  function query(table) {
    const conditions = [];
    const orders = [];
    let action = "select";
    let inserted;
    let updated;
    let range;
    let limit;
    const builder = {
      select() { return builder; },
      eq(key, value) { conditions.push([key, value]); return builder; },
      order(key, options) { orders.push([key, options.ascending]); return builder; },
      range(start, end) { range = [start, end]; return builder; },
      limit(count) { limit = count; return builder; },
      insert(value) { action = "insert"; inserted = value; return builder; },
      update(value) { action = "update"; updated = value; return builder; },
      async maybeSingle() { const result = await execute(); return { ...result, data: result.data?.[0] ?? null }; },
      async single() { const result = await execute(); return { ...result, data: result.data?.[0] ?? null }; },
      then(resolve, reject) { return execute().then(resolve, reject); },
    };
    async function execute() {
      if (action === "insert") {
        if (table === "ad_csv_rows") {
          if (failNextRowInsert) { failNextRowInsert = false; return { data: null, error: new Error("fake failure") }; }
          rows.push(...inserted);
          return { data: [], error: null };
        }
        if (inserted.id && imports.some((item) => item.id === inserted.id)) {
          return { data: null, error: { code: "23505" } };
        }
        sequence += 1;
        const timestamp = new Date(Date.UTC(2026, 0, 1, 0, 0, sequence)).toISOString();
        const record = { id: `id-${sequence}`, created_at: timestamp, updated_at: timestamp, ...inserted };
        imports.push(record);
        return { data: [record], error: null };
      }
      let result = (table === "ad_csv_imports" ? imports : rows)
        .filter((item) => conditions.every(([key, value]) => item[key] === value));
      if (action === "update") {
        result.forEach((item) => Object.assign(item, updated));
      }
      result = [...result].sort((a, b) => {
        for (const [key, ascending] of orders) {
          const difference = String(a[key]).localeCompare(String(b[key]));
          if (difference) return ascending ? difference : -difference;
        }
        return 0;
      });
      if (range) result = result.slice(range[0], range[1] + 1);
      if (limit !== undefined) result = result.slice(0, limit);
      return { data: result, error: null };
    }
    return builder;
  }
  return { imports, rows, from: query, failNextInsert() { failNextRowInsert = true; } };
}

function storageFixture() {
  const db = mockDatabase();
  const storage = loadModule("../src/lib/supabase/adCsv.server.ts", {
    "node:crypto": crypto,
    "@/lib/supabase/serverClient": { getServerSupabaseClient: () => db },
  });
  const account = "a".repeat(64);
  const fileName = `google-ads-api-v1-${account}-campaign-2026-01-01-2026-01-31`;
  const metadata = { platform: "google", importType: "campaign", periodStart: "2026-01-01", periodEnd: "2026-01-31", reportMonth: "2026-01", comparisonLabel: "", memo: "" };
  const preview = (hash) => ({
    contentHash: hash, fileName, detectedType: "campaign", rows: [{ platform: "google", rowType: "campaign", rawData: {} }],
    validRowCount: 1, totalRowCount: 1, invalidRowCount: 0, warningCount: 0,
    metrics: { averageCpa: 0, averageCpc: 0, averageCtr: 0, totalClicks: 0, totalConversions: 0, totalCost: 0, totalImpressions: 0 },
  });
  return { db, storage, preview, metadata };
}

test("Google Ads Cron is added without changing existing schedules", () => {
  const { crons } = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.equal(crons.length, 4);
  for (const [path, schedule] of [
    ["/api/trends/auto-generate", "0 22 * * *"],
    ["/api/seo/monthly-fetch", "0 0 5 * *"],
    ["/api/youtube/auto-generate", "0 0 * * 2"],
    ["/api/ads/google/monthly-fetch", "0 1 5 * *"],
  ]) assert.equal(crons.filter((entry) => entry.path === path && entry.schedule === schedule).length, 1);
});

test("API snapshots skip identical content, keep changed versions and select only the latest successful one", async () => {
  const { db, storage, preview, metadata } = storageFixture();
  assert.equal((await storage.saveAdCsvImport(preview("a"), metadata)).version, "new");
  assert.equal((await storage.saveAdCsvImport(preview("a"), metadata)).version, "unchanged");
  assert.equal(db.imports.filter((row) => row.status === "imported").length, 1);
  assert.equal((await storage.saveAdCsvImport(preview("b"), metadata)).version, "updated");
  assert.equal((await storage.saveAdCsvImport(preview("a"), metadata)).version, "updated");
  assert.equal(db.imports.filter((row) => row.status === "imported").length, 3);
  const visible = await storage.fetchAdCsvImports(24);
  assert.equal(visible.length, 1);
  assert.equal(visible[0].fileHash, "a");
  assert.equal(visible[0].id, db.imports.filter((row) => row.status === "imported").at(-1).id);
});

test("failed API snapshot is hidden and can be retried; CSV retains separate duplicate rules", async () => {
  const { db, storage, preview, metadata } = storageFixture();
  db.failNextInsert();
  await assert.rejects(storage.saveAdCsvImport(preview("a"), metadata));
  assert.ok(db.imports.some((row) => row.status === "failed"));
  assert.equal((await storage.fetchAdCsvImports(24)).length, 0);
  assert.equal((await storage.saveAdCsvImport(preview("a"), metadata)).version, "new");
  const csv = { ...preview("csv"), fileName: "manual.csv" };
  const first = await storage.saveAdCsvImport(csv, metadata);
  assert.ok(first.item);
  assert.ok((await storage.saveAdCsvImport(csv, metadata)).duplicate);
  assert.equal((await storage.fetchAdCsvImports(24)).length, 2);
});

test("a successful empty API version replaces a previous nonempty version", async () => {
  const { storage, preview, metadata } = storageFixture();
  await storage.saveAdCsvImport(preview("nonempty"), metadata);
  const empty = { ...preview("empty"), rows: [], validRowCount: 0, totalRowCount: 0 };
  assert.equal((await storage.saveAdCsvImport(empty, metadata)).version, "updated");
  const visible = await storage.fetchAdCsvImports(24);
  assert.equal(visible.length, 1);
  assert.equal(visible[0].fileHash, "empty");
  assert.equal(visible[0].validRowCount, 0);
});

test("display limit is applied after filtering API versions and unsuccessful imports", async () => {
  const { db, storage, preview, metadata } = storageFixture();
  await storage.saveAdCsvImport(preview("original"), metadata);
  const imported = db.imports.find((row) => row.status === "imported");
  for (let index = 0; index < 105; index += 1) {
    db.imports.push({ ...imported, id: `failed-${index}`, status: "failed", created_at: new Date(Date.UTC(2026, 2, 1, 0, 0, index)).toISOString() });
  }
  const visible = await storage.fetchAdCsvImports(1);
  assert.equal(visible.length, 1);
  assert.equal(visible[0].fileHash, "original");
});

test("concurrent API imports cannot create duplicate successful versions", async () => {
  const { db, storage, preview, metadata } = storageFixture();
  const results = await Promise.allSettled([
    storage.saveAdCsvImport(preview("same"), metadata),
    storage.saveAdCsvImport(preview("same"), metadata),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal(db.imports.filter((row) => row.status === "imported").length, 1);
  assert.equal((await storage.saveAdCsvImport(preview("same"), metadata)).version, "unchanged");
});

test("an interrupted import stays locked until its previous writer is confirmed stopped", async () => {
  const { db, storage, preview, metadata } = storageFixture();
  await storage.saveAdCsvImport(preview("first"), metadata);
  const lock = db.imports.find((row) => row.file_hash === "google-ads-import-lock-v1");
  lock.status = "preview";
  await assert.rejects(storage.saveAdCsvImport(preview("second"), metadata));
  assert.equal(db.imports.filter((row) => row.status === "imported").length, 1);
  assert.equal(lock.status, "preview");
});

test("local API history shows only the latest successful version while CSV remains visible", () => {
  const name = `google-ads-api-v1-${"a".repeat(64)}-campaign-2026-01-01-2026-01-31`;
  const imports = [
    { id: "failed", fileName: name, status: "failed", createdAt: "2026-02-04" },
    { id: "new", fileName: name, status: "imported", createdAt: "2026-02-03" },
    { id: "csv", fileName: "manual.csv", status: "imported", createdAt: "2026-02-02" },
    { id: "old", fileName: name, status: "imported", createdAt: "2026-02-01" },
  ];
  let data = JSON.stringify({ imports, rowsByImport: {} });
  const window = { localStorage: { getItem: () => data, setItem: (_key, value) => { data = value; } }, dispatchEvent() {} };
  const local = loadModule("../src/lib/ads/adCsvLocalStorage.ts", {
    "@/config/adCsv": { adCsvConfig: { localStorageRowLimit: 2000 } },
  }, {}, { window, Event });
  assert.equal(JSON.stringify(local.readLocalAdCsvDataset().imports.map((item) => item.id)), JSON.stringify(["new", "csv"]));
  local.addLocalAdCsvImport({ id: "newest", fileName: name, status: "imported", createdAt: "2026-02-05" }, []);
  assert.equal(JSON.stringify(local.readLocalAdCsvDataset().imports.map((item) => item.id)), JSON.stringify(["newest", "csv"]));
  assert.equal(JSON.parse(data).imports.length, 5);
});

function adsFixture({ loginId, customerId = "123-456-7890", responseRows = [], configured = true, maxImportRows = 20000 } = {}) {
  const calls = [];
  const scopes = [];
  const ads = loadModule("../src/lib/ads/googleAds.server.ts", {
    "node:crypto": crypto,
    "@/config/adCsv": { adCsvConfig: { maxImportRows, previewRowLimit: 10 } },
    "@/lib/ads/adCsvAnalysis": { summarizeAdCsvRows: () => ({}) },
    "@/lib/google/serviceAccount.server": {
      isGoogleServiceAccountConfigured: () => configured,
      async getGoogleServiceAccountAccessToken(scope) { scopes.push(scope); return "fake-access-token"; },
    },
    "@/lib/supabase/adCsv.server": { async saveAdCsvImport() { return { version: "new" }; } },
  }, { GOOGLE_ADS_CUSTOMER_ID: customerId, ...(loginId ? { GOOGLE_ADS_LOGIN_CUSTOMER_ID: loginId } : {}) }, {
    async fetch(url, options) {
      calls.push({ url, options });
      return { ok: true, async json() { return [{ results: responseRows }]; } };
    },
  });
  return { ads, calls, scopes };
}

const reportInput = { importType: "campaign", periodStart: "2026-01-01", periodEnd: "2026-01-31", reportMonth: "2026-01", comparisonLabel: "", memo: "" };

test("Ads report uses service account adwords scope, readonly report and optional MCC header", async () => {
  for (const loginId of [undefined, "987-654-3210"]) {
    const { ads, calls, scopes } = adsFixture({ loginId });
    const result = await ads.fetchGoogleAdsReport(reportInput);
    assert.deepEqual(scopes, ["https://www.googleapis.com/auth/adwords"]);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /customers\/1234567890\/googleAds:searchStream$/);
    assert.equal(calls[0].options.method, "POST");
    assert.ok(calls[0].options.signal instanceof AbortSignal);
    assert.match(JSON.parse(calls[0].options.body).query, /FROM campaign/);
    assert.equal(calls[0].options.headers.Authorization, "Bearer fake-access-token");
    assert.equal(calls[0].options.headers["developer-token"], undefined);
    assert.equal(calls[0].options.headers["login-customer-id"], loginId ? "9876543210" : undefined);
    assert.doesNotMatch(result.preview.fileName, /1234567890|9876543210/);
  }
  const source = readFileSync(new URL("../src/lib/ads/googleAds.server.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /GOOGLE_ADS_(?:DEVELOPER_TOKEN|REFRESH_TOKEN|CLIENT_ID|CLIENT_SECRET)|developer-token|refresh_token/);
});

test("Ads results at the row limit carry a truncation warning", async () => {
  const rows = [{ segments: { date: "2026-01-01" }, campaign: { name: "A" } }];
  const { ads } = adsFixture({ responseRows: rows, maxImportRows: 1 });
  const result = await ads.fetchGoogleAdsReport(reportInput);
  assert.equal(result.preview.warningCount, 1);
  assert.ok(result.preview.issues.length > 0);
});

test("Ads content hash ignores row ordering and memo, but detects changed metrics", async () => {
  const rowA = { segments: { date: "2026-01-01" }, campaign: { name: "A" }, metrics: { impressions: "12", clicks: "1", costMicros: "1000000" } };
  const rowB = { segments: { date: "2026-01-01" }, campaign: { name: "B" }, metrics: { impressions: "20", clicks: "2", costMicros: "2000000" } };
  const first = await adsFixture({ responseRows: [rowA, rowB] }).ads.fetchGoogleAdsReport(reportInput);
  const reordered = await adsFixture({ responseRows: [rowB, rowA] }).ads.fetchGoogleAdsReport({ ...reportInput, memo: "別のメモ" });
  const changed = await adsFixture({ responseRows: [{ ...rowA, metrics: { ...rowA.metrics, clicks: "3" } }, rowB] }).ads.fetchGoogleAdsReport(reportInput);
  assert.equal(first.preview.contentHash, reordered.preview.contentHash);
  assert.notEqual(first.preview.contentHash, changed.preview.contentHash);
  const missing = adsFixture({ configured: false });
  await assert.rejects(missing.ads.fetchGoogleAdsReport(reportInput));
  assert.equal(missing.calls.length, 0);
  const otherAccount = await adsFixture({ customerId: "111-222-3333", responseRows: [rowA, rowB] }).ads.fetchGoogleAdsReport(reportInput);
  assert.notEqual(first.preview.fileName, otherAccount.preview.fileName);
});

test("manual API hides unexpected failure details from its response and logs", async () => {
  const logs = [];
  class GoogleAdsReportError extends Error {}
  const route = loadModule("../src/app/api/ads/google/fetch/route.ts", {
    "next/server": { NextResponse },
    "@/lib/ads/googleAds.server": {
      GoogleAdsReportError,
      getGoogleAdsConfigStatus: () => ({ configured: false, missing: ["GOOGLE_ADS_CUSTOMER_ID"] }),
      async fetchGoogleAdsReport() { throw new Error("fake-token 1234567890 fake-secret"); },
    },
    "@/lib/supabase/serverClient": { isServerSupabaseConfigured: () => true },
  }, {}, { console: { error(...args) { logs.push(args); } } });
  const response = await route.POST(new Request("https://example.test", { method: "POST", body: "{}" }));
  const text = await response.text();
  assert.equal(response.status, 400);
  assert.doesNotMatch(text + JSON.stringify(logs), /fake-token|1234567890|fake-secret/);
  const settings = await route.GET();
  assert.deepEqual((await settings.json()).googleAds.missing, ["GOOGLE_ADS_CUSTOMER_ID"]);
});

function cronFixture({ version = "new", fail = false, dbConfigured = true, rowCount = 1, now = "2026-01-05T01:00:00Z" } = {}) {
  const calls = [];
  const logs = [];
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } }
  const route = loadModule("../src/app/api/ads/google/monthly-fetch/route.ts", {
    "next/server": { NextResponse },
    "@/lib/security/appAccess.server": { safeCompare: (a, b) => a === b },
    "@/lib/supabase/serverClient": { isServerSupabaseConfigured: () => dbConfigured },
    "@/lib/ads/googleAds.server": { async fetchGoogleAdsReport(input) {
      calls.push(input);
      if (fail) throw new Error("fake-token 1234567890 fake-secret");
      return { preview: { validRowCount: rowCount, warningCount: 0 }, async save() { return { version }; } };
    } },
  }, { CRON_SECRET: "fake-secret" }, { Date: Clock, console: { error(...args) { logs.push(args); } } });
  return { route, calls, logs };
}

test("Cron authentication and previous-month calculation across year and leap month", async () => {
  const auth = cronFixture();
  assert.equal(auth.route.maxDuration, 60);
  assert.equal((await auth.route.GET(new Request("https://example.test"))).status, 401);
  assert.equal(auth.calls.length, 0);
  for (const [now, start, end] of [
    ["2026-01-05T01:00:00Z", "2025-12-01", "2025-12-31"],
    ["2024-03-05T01:00:00Z", "2024-02-01", "2024-02-29"],
    ["2026-05-05T01:00:00Z", "2026-04-01", "2026-04-30"],
  ]) {
    const { route, calls } = cronFixture({ now });
    const response = await route.GET(new Request("https://example.test", { headers: { authorization: "Bearer fake-secret" } }));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.periodStart, start);
    assert.equal(body.periodEnd, end);
    assert.equal(calls[0].importType, "campaign");
  }
});

test("Cron returns only safe counts and fixed errors, without credentials or account numbers", async () => {
  for (const fail of [false, true]) {
    const { route, logs } = cronFixture({ fail, version: "updated" });
    const response = await route.GET(new Request("https://example.test", { headers: { authorization: "Bearer fake-secret" } }));
    const text = await response.text();
    assert.doesNotMatch(text + JSON.stringify(logs), /fake-token|1234567890|fake-secret/);
    assert.equal(JSON.parse(text).ok, !fail);
  }
});

test("Cron reports every save result and preserves a successful zero-row version", async () => {
  for (const version of ["new", "updated", "unchanged"]) {
    const { route } = cronFixture({ version, rowCount: 0 });
    const response = await route.GET(new Request("https://example.test", { headers: { authorization: "Bearer fake-secret" } }));
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.saveStatus, version);
    assert.equal(body.rowCount, 0);
    assert.ok(body.warnings.length > 0);
  }
});

test("proxy permits only Cron GET; manual POST still needs app login", () => {
  const proxy = loadModule("../src/proxy.ts", {
    "next/server": { NextResponse },
    "@/lib/security/appAccess.server": {
      hasValidAppAccessCookie: () => false, hasBasicAuthAttempt: () => false,
      isAppRequestAuthorized: (request) => request.headers.get("authorization") === "Basic fake-login",
      getAppAccessCookieValue: () => null, safeCompare: (a, b) => a === b,
    },
    "@/lib/security/loginRateLimit": {
      checkBasicAuthRequest: (_store, _ip, _cookie, check) => ({ authorized: check(), retryAfterSeconds: 0 }),
      clearBasicAuthFailures() {},
    },
  }, { CRON_SECRET: "fake-secret" });
  const request = (method, authorization) => ({ method, nextUrl: { pathname: "/api/ads/google/monthly-fetch" }, headers: new Headers(authorization ? { authorization } : {}) });
  assert.equal(proxy.proxy(request("GET", "Bearer fake-secret")).status, 200);
  assert.equal(proxy.proxy(request("GET", "Bearer wrong")).status, 401);
  assert.equal(proxy.proxy(request("POST", "Bearer fake-secret")).status, 401);
  assert.equal(proxy.proxy(request("POST", "Basic fake-login")).status, 200);
});
