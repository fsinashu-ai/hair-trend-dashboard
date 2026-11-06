import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("非表示の画面はナビリンクに含まず、主要な画面は残す", async () => {
  const navigation = await readFile("src/data/navigation.ts", "utf8");
  const marketing = await readFile("src/components/marketing/MarketingSectionNav.tsx", "utf8");
  const hiddenPaths = [
    "/seo/keywords", "/seo/pages", "/seo/reports", "/keywords",
    "/post-generator", "/image-analysis", "/quality-check",
    "/seo/tasks", "/ads/creatives", "/ads/reports",
  ];

  for (const path of hiddenPaths) {
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const link = new RegExp(`href\\s*:\\s*["']${escaped}["']`);
    assert.doesNotMatch(navigation, link, `${path} is hidden in the main navigation`);
    assert.doesNotMatch(marketing, link, `${path} is hidden in the marketing navigation`);
  }

  for (const path of ["/trends", "/blog", "/seo", "/settings"]) {
    assert.ok(navigation.includes(`href: "${path}"`), `${path} remains available`);
  }
  for (const path of ["/seo/search-console", "/seo/ga4", "/ads/imports"]) {
    assert.ok(marketing.includes(`href: "${path}"`), `${path} remains available`);
  }
});
