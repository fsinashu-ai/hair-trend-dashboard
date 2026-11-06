import assert from "node:assert/strict";
import test from "node:test";
import { buildBlogBrief } from "../tools/blog-brief/buildBlogBrief.mjs";

const now = new Date("2026-11-06T03:00:00.000Z");

function emptyData() {
  return {
    social_posts: [],
    trend_links: [],
    keywords: [],
    seo_keywords: [],
    seo_search_console_imports: [],
    seo_search_console_rows: [],
    seo_ga4_imports: [],
    seo_ga4_rows: [],
    published_blog_articles: [],
    blog_posts: [],
  };
}

test("期間内の SNS を週・タグ・分類・指標別に集計する", () => {
  const data = emptyData();
  data.social_posts = [
    { sns_type: "Instagram", published_at: "2026-10-20T03:00:00Z", category: "カラー", relevance: "高", tags: ["艶髪"], like_count: 5, comment_count: 1, play_count: null, share_count: 2 },
    { sns_type: "Instagram", published_at: "2026-10-27T03:00:00Z", category: "カラー", relevance: "高", tags: ["艶髪"], like_count: 15, comment_count: 3, play_count: 30, share_count: 0 },
    { sns_type: "TikTok", published_at: "2026-10-28T03:00:00Z", category: "パーマ", relevance: "中", tags: ["艶髪", "艶髪"], like_count: 10, comment_count: null, play_count: 10, share_count: 1 },
    { sns_type: "Instagram", published_at: "2026-11-03T03:00:00Z", category: "パーマ", relevance: "中", tags: ["ボブ"], like_count: 0, comment_count: 0, play_count: 0, share_count: 0 },
    { sns_type: "TikTok", published_at: "2026-09-01T03:00:00Z", category: "期間外", tags: ["古いタグ"], like_count: 9999 },
    { sns_type: "TikTok", published_at: "2026-11-07T03:00:00Z", category: "未来", like_count: 9999 },
  ];
  data.trend_links = [
    { title: "最近の話題", category: "カラー", tags: ["艶髪"], salon_relevance: "高", registered_at: "2026-10-28" },
    { title: "古い話題", registered_at: "2026-09-01" },
  ];
  const { brief, markdown } = buildBlogBrief({ data, now, days: 30 });
  const social = brief.social_posts;
  assert.deepEqual(brief.season.months, [11, 12, 1]);
  assert.deepEqual(social.weekly_counts, [
    { week_start: "2026-10-19", sns_type: "Instagram", count: 1 },
    { week_start: "2026-10-26", sns_type: "Instagram", count: 1 },
    { week_start: "2026-10-26", sns_type: "TikTok", count: 1 },
    { week_start: "2026-11-02", sns_type: "Instagram", count: 1 },
  ]);
  const tag = social.tags.find((item) => item.tag === "艶髪");
  assert.equal(tag.count, 3);
  assert.deepEqual(tag.weeks.filter((week) => week.week_start >= "2026-10-19"), [
    { week_start: "2026-10-19", count: 1, change: 1 },
    { week_start: "2026-10-26", count: 2, change: 1 },
    { week_start: "2026-11-02", count: 0, change: -2 },
  ]);
  assert.equal(social.categories.find((item) => item.value === "カラー").count, 2);
  assert.equal(social.relevance.find((item) => item.value === "中").count, 2);
  assert.equal(social.metrics.like_count.total, 30);
  assert.equal(social.metrics.like_count.average, 7.5);
  assert.equal(social.metrics.play_count.total, 40);
  assert.equal(social.metrics.play_count.average, 40 / 3);
  assert.equal(social.top_posts[0].like_count, 15);
  assert.equal(social.top_posts[0].published_at, "2026-10-27T03:00:00Z");
  assert.deepEqual(brief.trend_links.map((row) => row.title), ["最近の話題"]);
  assert.equal(brief.trend_links[0].registered_at, "2026-10-28");
  assert.match(markdown, /最近の話題/);
  assert.doesNotMatch(markdown, /古い話題|古いタグ|期間外/);
});

test("最新の成功した取り込みから検索とページの上位を作る", () => {
  const data = emptyData();
  data.seo_search_console_imports = [
    { id: "old", import_type: "query", status: "imported", created_at: "2026-10-01T00:00:00Z" },
    { id: "new", import_type: "query", status: "analyzed", created_at: "2026-11-01T00:00:00Z" },
    { id: "pages", import_type: "page", status: "imported", created_at: "2026-11-02T00:00:00Z" },
    { id: "failed", import_type: "query", status: "failed", created_at: "2026-11-03T00:00:00Z" },
  ];
  data.seo_search_console_rows = [
    ...Array.from({ length: 35 }, (_, i) => ({ import_id: "new", row_type: "query", query: `検索${i}`, clicks: i, impressions: 1000 - i, ctr: 0.1, position: i < 25 ? 10 : 3 })),
    { import_id: "new", row_type: "page", query: "ページ行", impressions: 9999 },
    { import_id: "old", row_type: "query", query: "古い取込", impressions: 9999 },
    { import_id: "failed", row_type: "query", query: "失敗した取込", impressions: 9999 },
  ];
  data.seo_ga4_imports = [
    { id: "old-ga", status: "imported", created_at: "2026-10-01T00:00:00Z" },
    { id: "new-ga", status: "imported", created_at: "2026-11-01T00:00:00Z" },
    { id: "failed-ga", status: "failed", created_at: "2026-11-03T00:00:00Z" },
  ];
  data.seo_ga4_rows = [
    ...Array.from({ length: 22 }, (_, i) => ({ import_id: "new-ga", page_path: `/page-${i}`, page_title: `記事${i}`, views: 100 - i, users: 20, line_clicks: 2, reservation_clicks: 1 })),
    { import_id: "new-ga", page_path: "/page-0", page_title: "別の表題", views: 5, users: 3, line_clicks: 1, reservation_clicks: 2 },
    { import_id: "old-ga", page_path: "/old", views: 9999 },
    { import_id: "failed-ga", page_path: "/failed", views: 9999 },
  ];
  const { brief } = buildBlogBrief({ data, now });
  assert.equal(brief.seo_search_console_rows.top_queries.length, 30);
  assert.equal(brief.seo_search_console_rows.top_queries[0].query, "検索0");
  assert.equal(brief.seo_search_console_rows.opportunities.length, 20);
  assert.ok(brief.seo_search_console_rows.opportunities.every((row) => row.position >= 5 && row.position <= 20));
  assert.equal(brief.seo_ga4_rows.length, 20);
  assert.equal(brief.seo_ga4_rows[0].page_path, "/page-0");
  assert.equal(brief.seo_ga4_rows.filter((row) => row.page_path === "/page-0").length, 1);
  assert.equal(brief.seo_ga4_rows[0].views, 105);
  assert.equal(brief.seo_ga4_rows[0].reservation_clicks, 3);
});

test("許可された項目だけを出力し、自由文中の URL と識別情報も除外する", () => {
  const data = emptyData();
  const privateFields = { url: "https://private.example/post", canonical_url: "https://private.example/canonical", account_name: "秘密のアカウント", handle: "secret_handle", external_id: "secret_id", description: "秘密の本文", raw_payload: { text: "秘密の生データ" }, og_image_url: "https://private.example/image", title: "秘密の投稿タイトル", link_url: "https://private.example/link", link_text: "秘密のリンク" };
  data.social_posts = [{ ...privateFields, sns_type: "Instagram", published_at: "2026-11-03T00:00:00Z", category: "カラー", relevance: "高", tags: ["安全", "@secret_handle"], ai_summary: "詳細は https://private.example/summary", like_count: 5 }];
  data.trend_links = [{ ...privateFields, title: "安全なトレンド", category: "カラー", tags: ["安全"], salon_relevance: "高", registered_at: "2026-11-03" }];
  data.keywords = [{ name: "安全キーワード", category: "カラー", priority: "高", use_count: 2, memo: "秘密のメモ" }];
  data.seo_keywords = [{ keyword: "検索語", intent: "情報収集", priority: "high", status: "tracking", memo: "秘密のメモ" }];
  data.published_blog_articles = [{ title: "公開記事", target_keyword: "艶髪", status: "published", published_at: "2026-11-01", created_at: "2026-10-01T00:00:00Z", content: "秘密の記事本文" }];
  data.blog_posts = [{ title: "下書き", target_keyword: "カラー", status: "draft", created_at: "2026-11-02T00:00:00Z", content: "秘密の記事本文" }];
  data.seo_ga4_imports = [{ id: "ga", status: "imported", created_at: "2026-11-01T00:00:00Z" }];
  data.seo_ga4_rows = [{ ...privateFields, import_id: "ga", page_path: "/blog?email=secret%40example.com", page_title: "ページ", views: 3 }];
  const { brief, markdown } = buildBlogBrief({ data, now });
  const output = JSON.stringify(brief) + markdown;
  for (const secret of ["private.example", "秘密のアカウント", "secret_handle", "secret_id", "秘密の本文", "秘密の生データ", "秘密の投稿タイトル", "秘密のリンク", "秘密のメモ", "秘密の記事本文", "secret%40example.com"]) {
    assert.equal(output.includes(secret), false, secret);
  }
  function assertNoForbiddenKeys(value) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!["url", "canonical_url", "handle", "account_name", "external_id", "description", "raw_payload", "og_image_url", "link_url", "link_text", "content"].includes(key), key);
      assertNoForbiddenKeys(child);
    }
  }
  assertNoForbiddenKeys(brief);
  assert.deepEqual(brief.social_posts.top_posts[0].tags, ["安全"]);
  assert.equal(brief.seo_ga4_rows[0].page_path, "/blog");
  assert.equal(brief.published_blog_articles[0].title, "公開記事");
  assert.equal(brief.blog_posts[0].title, "下書き");
});

test("欠けたセクションと取得エラーがあっても他の結果を出力する", () => {
  const data = emptyData();
  delete data.trend_links;
  data.keywords = [{ name: "安全なキーワード", category: "カラー", priority: "高", use_count: 1 }];
  const { brief, markdown } = buildBlogBrief({ data, errors: { social_posts: "権限がありません" }, now });
  assert.equal(brief.social_posts.top_posts.length, 0);
  assert.deepEqual(brief.trend_links, []);
  assert.ok(brief.unavailable_sections.trend_links);
  assert.match(brief.unavailable_sections.social_posts, /権限/);
  assert.equal(brief.keywords[0].name, "安全なキーワード");
  assert.match(markdown, /権限がありません/);
});

test("SNS の上位件数を制限し、期間外の既存記事も含める", () => {
  const data = emptyData();
  data.social_posts = Array.from({ length: 55 }, (_, i) => ({
    sns_type: "Instagram", published_at: "2026-11-01T00:00:00Z", category: "カラー",
    tags: [`タグ${i}`], like_count: i,
  }));
  data.published_blog_articles = [
    { title: "期間外の公開記事", published_at: "2026-01-01", created_at: "2026-11-01T00:00:00Z" },
    { title: "公開日なし", published_at: null, created_at: "2026-10-15T00:00:00Z", content: "非公開の本文", url: "https://example.com/private" },
    { title: "対象記事", published_at: "2026-11-01", created_at: "2025-01-01T00:00:00Z" },
    { title: "日付なし", published_at: null, created_at: null },
  ];
  data.blog_posts = [
    { title: "古い下書き", created_at: "2026-01-01T00:00:00Z" },
    { title: "新しい下書き", created_at: "2026-11-01T00:00:00Z" },
  ];
  const { brief, markdown } = buildBlogBrief({ data, now, days: 30 });
  assert.equal(brief.social_posts.tags.length, 50);
  assert.equal(brief.social_posts.top_posts.length, 20);
  assert.equal(brief.social_posts.top_posts[0].like_count, 54);
  assert.deepEqual(brief.published_blog_articles.map((row) => row.title), ["対象記事", "公開日なし", "期間外の公開記事", "日付なし"]);
  assert.deepEqual(brief.blog_posts.map((row) => row.title), ["新しい下書き", "古い下書き"]);
  assert.match(markdown, /期間外の公開記事/);
  assert.doesNotMatch(JSON.stringify(brief) + markdown, /非公開の本文|example\.com\/private/);
});
