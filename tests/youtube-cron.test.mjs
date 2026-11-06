import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

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
    URLSearchParams,
    AbortSignal,
    Date,
    ...globals,
  });
  return exports;
}

const NextResponse = {
  json(body, init = {}) {
    return new Response(JSON.stringify(body), { status: init.status ?? 200 });
  },
  next() {
    return new Response(null, { status: 200 });
  },
};

function routeFixture({ configured = true, saveFails = false } = {}) {
  const calls = [];
  const supabase = {
    from(table) {
      return {
        async select() {
          return { data: table === "trend_links" ? [{ url: "https://youtu.be/existing", title: "古い施術紹介" }] : [], error: null };
        },
        insert(rows) {
          return {
            async select() {
              return saveFails
                ? { data: null, error: { message: "fake-api-key fake-cron-secret" } }
                : { data: rows, error: null };
            },
          };
        },
      };
    },
  };
  const route = loadModule("../src/app/api/youtube/auto-generate/route.ts", {
    "next/server": { NextResponse },
    "@/config/youtubeTrendKeywords": {
      defaultYoutubeTrendKeywords: ["髪型", "美容室"],
      youtubeTrendSearchConfig: { dailyVideoLimit: 30, keywordLimit: 6, maxResultsPerKeyword: 5, runVideoLimit: 30, rangeDays: 7 },
    },
    "@/lib/supabase/client": { getSupabaseClient: () => supabase },
    "@/lib/youtube": {
      getYoutubeDailyVideoLimit: (value) => value,
      getYoutubeKeywordLimit: (value) => value,
      getYoutubeRunVideoLimit: (value) => value,
      isYoutubeApiConfigured: () => configured,
      async searchYoutubeVideosForKeywords(input) {
        calls.push(input);
        return {
          duplicateCount: 1,
          videos: [
            { url: "https://youtu.be/existing", title: "古い施術紹介" },
            { url: "https://youtu.be/new", title: "新しいヘアスタイル" },
          ],
          warnings: ["YouTube検索中にエラーが発生しました: fake-api-key fake-cron-secret"],
        };
      },
    },
    "@/lib/youtubeTrendGenerator": {
      createMockYoutubeTrendCandidates: () => [],
      async classifyYoutubeVideosForTrends({ videos }) {
        return { providerLabel: "mock", trends: videos.map((video) => ({ ...video, tags: [] })) };
      },
    },
  }, { CRON_SECRET: "fake-cron-secret" });
  return { route, calls };
}

test("YouTube weekly cron preserves the existing schedules", () => {
  const { crons } = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.equal(crons.length, 3);
  for (const [path, schedule] of [
    ["/api/trends/auto-generate", "0 22 * * *"],
    ["/api/seo/monthly-fetch", "0 0 5 * *"],
    ["/api/youtube/auto-generate", "0 0 * * 2"],
  ]) {
    assert.equal(crons.filter((cron) => cron.path === path && cron.schedule === schedule).length, 1);
  }
});

test("GET requires a valid cron secret and does not execute on failure", async () => {
  const { route, calls } = routeFixture();
  for (const authorization of [undefined, "Bearer wrong"]) {
    const response = await route.GET(new Request("https://example.test", {
      headers: authorization ? { authorization } : {},
    }));
    assert.equal(response.status, 401);
    assert.equal(calls.length, 0);
    assert.doesNotMatch(await response.text(), /fake-cron-secret|fake-api-key/);
  }
});

test("GET searches seven days and returns counts without sensitive details", async () => {
  const { route, calls } = routeFixture();
  const response = await route.GET(new Request("https://example.test", {
    headers: { authorization: "Bearer fake-cron-secret" },
  }));
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].rangeDays, 7);
  const raw = await response.text();
  assert.doesNotMatch(raw, /fake-cron-secret|fake-api-key/);
  const result = JSON.parse(raw);
  assert.equal(result.ok, true);
  assert.equal(result.searchedKeywordCount, 2);
  assert.equal(result.foundCount, 3);
  assert.equal(result.savedCount, 1);
  assert.equal(result.duplicateCount, 2);
  assert.ok(result.warnings.length > 0);
});

test("GET marks a failed save or missing API key as not ok without exposing secrets", async () => {
  for (const options of [{ saveFails: true }, { configured: false }]) {
    const { route, calls } = routeFixture(options);
    const response = await route.GET(new Request("https://example.test", {
      headers: { authorization: "Bearer fake-cron-secret" },
    }));
    const raw = await response.text();
    const result = JSON.parse(raw);
    assert.equal(response.status, 200);
    assert.equal(result.ok, false);
    assert.equal(result.savedCount, 0);
    assert.ok(result.warnings.length > 0);
    assert.doesNotMatch(raw, /fake-cron-secret|fake-api-key/);
    if (!options.configured && !options.saveFails) {
      assert.equal(calls.length, 0);
      assert.equal(result.searchedKeywordCount, 0);
    }
  }
});

test("screen POST keeps its selected search period and existing response", async () => {
  const { route, calls } = routeFixture();
  const response = await route.POST(new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify({ rangeDays: 30 }),
  }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(calls[0].rangeDays, 30);
  assert.equal(result.rangeDays, 30);
  assert.equal(result.videoCount, 2);
  assert.equal(result.savedCount, 1);
  assert.equal(result.searchedKeywords.length, 2);
  assert.ok(Array.isArray(result.trends));
});

test("proxy allows a valid cron bearer for YouTube GET only", () => {
  const proxy = loadModule("../src/proxy.ts", {
    "next/server": { NextResponse },
    "@/lib/security/appAccess.server": {
      hasValidAppAccessCookie: () => false,
      hasBasicAuthAttempt: () => false,
      isAppRequestAuthorized: (request) => request.headers.get("authorization") === "Basic fake-login",
      getAppAccessCookieValue: () => null,
      safeCompare: (a, b) => a === b,
    },
    "@/lib/security/loginRateLimit": {
      checkBasicAuthRequest: (_store, _ip, _cookie, check) => ({ authorized: check(), retryAfterSeconds: 0 }),
      clearBasicAuthFailures: () => {},
    },
  }, { CRON_SECRET: "fake-cron-secret" });
  const request = (method, authorization) => ({
    method,
    nextUrl: { pathname: "/api/youtube/auto-generate" },
    headers: new Headers(authorization ? { authorization } : {}),
  });
  assert.equal(proxy.proxy(request("GET", "Bearer fake-cron-secret")).status, 200);
  assert.equal(proxy.proxy(request("GET", "Bearer wrong")).status, 401);
  assert.equal(proxy.proxy(request("GET")).status, 401);
  assert.equal(proxy.proxy(request("POST", "Bearer fake-cron-secret")).status, 401);
  assert.equal(proxy.proxy(request("POST", "Basic fake-login")).status, 200);
});

test("YouTube search times out per keyword and continues to the next", async () => {
  const calls = [];
  const timeouts = [];
  const youtube = loadModule("../src/lib/youtube.ts", {}, { YOUTUBE_API_KEY: "fake-api-key" }, {
    AbortSignal: { timeout(ms) {
      timeouts.push(ms);
      const controller = new AbortController();
      if (timeouts.length === 1) queueMicrotask(() => controller.abort());
      return controller.signal;
    } },
    async fetch(_url, options) {
      calls.push(options);
      if (calls.length === 1) {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => reject(new Error("timeout")), { once: true });
        });
      }
      return { ok: true, async json() { return { items: [{ id: { videoId: "one" }, snippet: { title: "test" } }] }; } };
    },
  });
  const result = await youtube.searchYoutubeVideosForKeywords({ keywords: ["first", "second"], maxResultsPerKeyword: 5, rangeDays: 7 });
  assert.equal(calls.length, 2);
  assert.deepEqual(timeouts, [8000, 8000]);
  assert.ok(calls.every((call) => call.signal instanceof AbortSignal));
  assert.equal(result.warnings.length, 1);
  assert.equal(result.videos.length, 1);
});

test("YouTube search counts duplicate results without changing the unique video list", async () => {
  const youtube = loadModule("../src/lib/youtube.ts", {}, { YOUTUBE_API_KEY: "fake-api-key" }, {
    async fetch() {
      return { ok: true, async json() { return { items: [{ id: { videoId: "same" }, snippet: { title: "test" } }] }; } };
    },
  });
  const result = await youtube.searchYoutubeVideosForKeywords({ keywords: ["first", "second"], maxResultsPerKeyword: 5, rangeDays: 7 });
  assert.equal(result.videos.length, 1);
  assert.equal(result.duplicateCount, 1);
});
