import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ts = require("typescript");

async function readProjectFile(relativePath) {
  return readFile(resolve(projectRoot, relativePath), "utf8");
}

test("sanitized n8n workflow keeps the Apify-to-dashboard contract", async () => {
  const workflow = JSON.parse(
    await readProjectFile(
      "automation/n8n/apify-social-import.workflow.example.json",
    ),
  );
  const nodeNames = workflow.nodes.map((node) => node.name);
  const sendNode = workflow.nodes.find((node) => node.name === "Send to dashboard");
  const serialized = JSON.stringify(workflow);

  assert.equal(workflow.settings.timezone, "Asia/Tokyo");
  assert.ok(nodeNames.includes("Start Apify Actor"));
  assert.ok(nodeNames.includes("Get Apify limits"));
  assert.ok(nodeNames.includes("Check Apify free budget"));
  assert.ok(nodeNames.includes("Get Dataset items"));
  assert.ok(nodeNames.includes("Send to dashboard"));
  assert.equal(sendNode?.executeOnce, true);
  assert.match(sendNode?.parameters?.jsonBody ?? "", /\$input\.all\(\)/);
  assert.match(serialized, /users\/me\/limits/);
  assert.match(serialized, /maxTotalChargeUsd/);
  assert.match(serialized, /APIFY_SAFE_USAGE_USD/);
  assert.match(serialized, /Apify API Bearer/);
  assert.match(serialized, /httpBearerAuth/);
  assert.match(serialized, /AUTOMATION_WEBHOOK_SECRET/);
  assert.doesNotMatch(serialized, /APIFY_API_TOKEN/);
  assert.doesNotMatch(serialized, /[?&]token=/i);
  assert.doesNotMatch(serialized, /apify_api_[A-Za-z0-9]{20,}/i);
  assert.doesNotMatch(serialized, /Bearer\s+[A-Za-z0-9._-]{24,}/);
});

test("weekly catch-up avoids duplicate runs after an offline Monday", async () => {
  const catchup = await readProjectFile(
    "automation/n8n/run-weekly-apify-catchup.ps1",
  );
  const checker = await readProjectFile(
    "automation/n8n/check-weekly-execution.mjs",
  );

  assert.match(catchup, /check-weekly-execution\.mjs/);
  assert.match(catchup, /N8N_RUNNERS_BROKER_PORT=5680/);
  assert.match(catchup, /Instagram already succeeded this week|already succeeded this week/);
  assert.doesNotMatch(catchup, /APIFY_API_TOKEN|AUTOMATION_WEBHOOK_SECRET/);
  assert.match(checker, /status = 'success'/);
  assert.match(checker, /startedAt >= \?/);
});

test("import route exposes bounded, replay-safe import behavior", async () => {
  const route = await readProjectFile(
    "src/app/api/automation/import-social/route.ts",
  );

  assert.match(route, /maxImportItems = 50/);
  assert.match(route, /freeImportItemLimit = 30/);
  assert.match(route, /freeAiLimit = 3/);
  assert.match(route, /budgetMode/);
  assert.match(route, /itemLimit/);
  assert.match(route, /maxRequestBodyBytes = 4 \* 1024 \* 1024/);
  assert.match(route, /idempotencyKey/);
  assert.match(route, /sourceMatchedCount/);
  assert.match(route, /classificationStatus/);
  assert.match(route, /sanitizePayload/);
});

test("distinct URLs with the same trend name are not title-deduplicated", async () => {
  const route = await readProjectFile(
    "src/app/api/automation/import-social/route.ts",
  );

  assert.doesNotMatch(route, /getTitleSimilarity|batchTitles|similarTitle/);
  assert.match(route, /if \(isDuplicateUrl\)/);
  assert.match(route, /existingUrls\.has\(normalizedUrl\)/);
  assert.match(route, /existingCanonicalUrls\.has\(normalizedCanonicalUrl\)/);
  assert.match(route, /existingImportKeys\.has\(normalizedImportKey\)/);
});

test("saved social posts contain no source text or string raw payload values", async () => {
  const route = await readProjectFile(
    "src/app/api/automation/import-social/route.ts",
  );
  const sourceFile = ts.createSourceFile(
    "import-social-route.ts",
    route,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const helperNames = [
    "isRecord",
    "getNestedValue",
    "pickString",
    "pickNumber",
    "cleanText",
    "cleanHandle",
    "getNeutralPostTitle",
    "detectSnsTypeFromText",
    "extractUrl",
    "extractTags",
    "sanitizePayload",
    "createPayloadHash",
    "normalizeImportKey",
    "normalizePublishedAt",
    "normalizeImportItem",
    "fallbackClassification",
    "toSocialPostInput",
  ];
  const helperSources = new Map();

  for (const statement of sourceFile.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name &&
      helperNames.includes(statement.name.text)
    ) {
      helperSources.set(statement.name.text, statement.getFullText(sourceFile));
    }
  }

  for (const name of helperNames) {
    assert.ok(helperSources.has(name), `route helper ${name} should exist`);
  }

  const helperCode = ts.transpile(
    Array.from(helperSources.values()).join("\n"),
    { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 },
  );
  const routeRuntime = {
    createHash,
    detectSocialType(url) {
      return url.includes("instagram.com")
        ? "Instagram"
        : url.includes("tiktok.com")
          ? "TikTok"
          : "Other";
    },
    normalizeSocialUrl(value) {
      const url = new URL(value);
      return `${url.origin}${url.pathname.replace(/\/+$/, "")}${url.search}`;
    },
    snsTrendCategories: ["髪質改善", "カラー", "パーマ", "白髪ぼかし", "Instagram", "SNS投稿"],
  };

  runInNewContext(
    `${helperCode}\nglobalThis.contract = { normalizeImportItem, fallbackClassification, toSocialPostInput };`,
    routeRuntime,
  );

  const caption = "この本文コピーは禁止です #髪質改善 #艶髪";
  const incomingItem = {
    caption,
    commentsCount: 8,
    details: {
      caption: "raw内の文章",
      isPinned: false,
      score: 3,
      samples: ["配列内の文章", 5, { text: "入れ子の文章", value: 2 }],
    },
    id: "post-123",
    isVideo: true,
    likesCount: 120,
    platform: "Instagram",
    thumbnailUrl: "https://example.com/private-thumbnail.jpg",
    timestamp: "2026-10-16T08:00:00.000Z",
    title: "元の投稿タイトルの文章",
    url: "https://www.instagram.com/p/post-123/",
    username: "sample_salon",
  };
  const item = routeRuntime.contract.normalizeImportItem(
    incomingItem,
    "Apify",
    "Apify",
  );

  assert.ok(item);
  assert.equal(item.description, caption);
  assert.equal(item.title, "@sample_salon の投稿");
  assert.deepEqual(JSON.parse(JSON.stringify(item.tags)), ["#髪質改善", "#艶髪"]);

  const fallback = routeRuntime.contract.fallbackClassification(item);
  const fallbackPost = JSON.parse(
    JSON.stringify(
      routeRuntime.contract.toSocialPostInput(
        item,
        { classification: fallback, provider: "モック分類", status: "mock" },
        { classifiedAt: "2026-10-16T08:01:00.000Z", provider: "Apify" },
      ),
    ),
  );

  assert.equal(fallbackPost.description, "");
  assert.equal(fallbackPost.title, "@sample_salon の投稿");
  assert.equal(fallbackPost.ogImageUrl, "");
  assert.notEqual(fallbackPost.aiSummary, caption);
  assert.notEqual(fallbackPost.payloadHash, undefined);

  const aiClassification = {
    ...fallback,
    summary: "艶のあるストレートスタイルへの関心が高まっています。",
    trendName: "艶髪ストレートの需要",
  };
  const aiPost = JSON.parse(
    JSON.stringify(
      routeRuntime.contract.toSocialPostInput(
        item,
        { classification: aiClassification, provider: "Gemini", status: "gemini" },
        { classifiedAt: "2026-10-16T08:01:00.000Z", provider: "Apify" },
      ),
    ),
  );

  assert.equal(aiPost.title, "艶髪ストレートの需要");
  assert.equal(aiPost.description, "");
  assert.equal(aiPost.ogImageUrl, "");

  function assertOnlyNumbersAndBooleans(value) {
    if (Array.isArray(value)) {
      value.forEach(assertOnlyNumbersAndBooleans);
      return;
    }

    if (value && typeof value === "object") {
      Object.values(value).forEach(assertOnlyNumbersAndBooleans);
      return;
    }

    assert.ok(typeof value === "number" || typeof value === "boolean");
  }

  for (const post of [fallbackPost, aiPost]) {
    assertOnlyNumbersAndBooleans(post.rawPayload);
    const serializedPost = JSON.stringify(post);

    for (const sourceText of [
      "この本文コピーは禁止です",
      "元の投稿タイトルの文章",
      "raw内の文章",
      "配列内の文章",
      "入れ子の文章",
      "private-thumbnail.jpg",
    ]) {
      assert.equal(serializedPost.includes(sourceText), false);
    }
  }

  const changedCaptionItem = routeRuntime.contract.normalizeImportItem(
    { ...incomingItem, caption: "別の本文です #カラー", title: "別のタイトル" },
    "Apify",
    "Apify",
  );

  assert.equal(changedCaptionItem.importKey, item.importKey);
  assert.equal(changedCaptionItem.payloadHash, item.payloadHash);
  assert.match(item.payloadHash, /^[a-f0-9]{64}$/);
});

test("database contract records import lineage without exposing the run ledger", async () => {
  const migration = await readProjectFile("supabase/apify-social-import-v2.sql");
  const schema = await readProjectFile("supabase/schema.sql");

  for (const content of [migration, schema]) {
    assert.match(content, /social_import_runs/);
    assert.match(content, /import_run_id/);
    assert.match(content, /classification_status/);
    assert.match(content, /social_posts_import_key_uidx/);
  }

  assert.match(migration, /revoke all on table public\.social_import_runs from anon, authenticated/);
  assert.match(migration, /grant select, insert, update on table public\.social_import_runs to service_role/);
});
