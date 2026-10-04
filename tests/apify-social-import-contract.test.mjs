import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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
