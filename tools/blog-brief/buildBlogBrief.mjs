const DAY_MS = 24 * 60 * 60 * 1000;
const JST_MS = 9 * 60 * 60 * 1000;
const METRICS = ["like_count", "comment_count", "play_count", "share_count"];

// 自由文に混入した URL、連絡先、SNS ハンドルは項目ごと除外する。
function safeText(value) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (/https?:\/\/|\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/:?#]|\b)|\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b|@[^\s]+|(?:\+?\d[\d\s().-]{8,}\d)/i.test(text)) return "[除外]";
  return text;
}

function safeTags(value) {
  return Array.isArray(value) ? value.map(safeText).filter((tag) => tag && tag !== "[除外]") : [];
}

function number(value) {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function dateValue(value) {
  if (typeof value !== "string" || !value) return NaN;
  // date 型は日本時間の日付として扱う。
  return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+09:00` : value);
}

function articleDate(row) {
  const published = dateValue(row.published_at);
  if (Number.isFinite(published)) return published;
  const created = dateValue(row.created_at);
  return Number.isFinite(created) ? created : -Infinity;
}

function dateJst(time) {
  return new Date(time + JST_MS).toISOString().slice(0, 10);
}

function weekStart(time) {
  const shifted = new Date(time + JST_MS);
  const weekday = shifted.getUTCDay();
  const midnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return new Date(midnight - ((weekday + 6) % 7) * DAY_MS).toISOString().slice(0, 10);
}

function within(value, start, end) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return Number.isFinite(dateValue(value)) && value >= dateJst(start) && value <= dateJst(end);
  }
  const time = dateValue(value);
  return Number.isFinite(time) && time >= start && time <= end;
}

function pick(row, fields) {
  return Object.fromEntries(fields.map((field) => [field, field.endsWith("_at")
    ? (typeof row[field] === "string" && /^\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:?\d{2}))?$/.test(row[field]) && Number.isFinite(dateValue(row[field])) ? row[field] : "")
    : safeText(row[field])]));
}

function latestImport(data, errors, rowsName, importsName, isEligible = () => true) {
  if (errors[rowsName] || errors[importsName] || !Array.isArray(data[rowsName]) || !Array.isArray(data[importsName])) return [];
  const imports = data[importsName].filter((item) => item?.id && Number.isFinite(dateValue(item.created_at)) && (!item.status || ["imported", "analyzed"].includes(item.status)) && isEligible(item));
  imports.sort((a, b) => dateValue(b.created_at) - dateValue(a.created_at));
  if (!imports.length) return [];
  return data[rowsName].filter((item) => item?.import_id === imports[0].id);
}

function countBy(rows, field) {
  const counts = new Map();
  for (const row of rows) {
    const value = safeText(row[field]) || "未設定";
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function socialSection(rows, start, end) {
  const weekly = new Map();
  const tagWeeks = new Map();
  const metricTotals = Object.fromEntries(METRICS.map((key) => [key, { total: 0, average: null, samples: 0 }]));
  for (const row of rows) {
    const week = weekStart(dateValue(row.published_at));
    const sns = safeText(row.sns_type) || "未設定";
    const key = JSON.stringify([week, sns]);
    weekly.set(key, (weekly.get(key) || 0) + 1);
    for (const tag of new Set(safeTags(row.tags))) {
      if (!tagWeeks.has(tag)) tagWeeks.set(tag, new Map());
      const counts = tagWeeks.get(tag);
      counts.set(week, (counts.get(week) || 0) + 1);
    }
    for (const metric of METRICS) {
      const value = number(row[metric]);
      if (value !== null) {
        metricTotals[metric].total += value;
        metricTotals[metric].samples += 1;
      }
    }
  }
  for (const metric of METRICS) {
    const item = metricTotals[metric];
    if (item.samples) item.average = item.total / item.samples;
  }
  const weeks = [];
  for (let week = Date.parse(`${weekStart(start)}T00:00:00Z`); week <= Date.parse(`${weekStart(end)}T00:00:00Z`); week += 7 * DAY_MS) weeks.push(new Date(week).toISOString().slice(0, 10));
  const tags = [...tagWeeks].map(([tag, counts]) => ({
    tag,
    count: [...counts.values()].reduce((sum, count) => sum + count, 0),
    weeks: weeks.map((week) => ({
      week_start: week,
      count: counts.get(week) || 0,
      change: (counts.get(week) || 0) - (counts.get(new Date(Date.parse(`${week}T00:00:00Z`) - 7 * DAY_MS).toISOString().slice(0, 10)) || 0),
    })),
  })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)).slice(0, 50);
  const topPosts = rows.map((row) => ({
    ...pick(row, ["sns_type", "published_at", "category"]),
    tags: safeTags(row.tags),
    ai_summary: safeText(row.ai_summary),
    ...Object.fromEntries(METRICS.map((metric) => [metric, number(row[metric])])),
  })).sort((a, b) => METRICS.reduce((sum, metric) => sum + (b[metric] || 0) - (a[metric] || 0), 0)).slice(0, 20);
  return {
    weekly_counts: [...weekly].map(([key, count]) => { const [week_start, sns_type] = JSON.parse(key); return { week_start, sns_type, count }; }).sort((a, b) => a.week_start.localeCompare(b.week_start) || a.sns_type.localeCompare(b.sns_type)),
    tags,
    categories: countBy(rows, "category"),
    relevance: countBy(rows, "relevance"),
    metrics: metricTotals,
    top_posts: topPosts,
  };
}

function pagePath(value) {
  if (typeof value !== "string") return "";
  const path = value.split(/[?#]/, 1)[0];
  if (!path.startsWith("/") || path.startsWith("//")) return "[除外]";
  let decoded;
  try { decoded = decodeURIComponent(path); } catch { return "[除外]"; }
  return safeText(decoded);
}

function ga4Pages(rows) {
  const pages = new Map();
  for (const row of rows) {
    const path = pagePath(row.page_path || row.landing_page);
    if (!path || path === "[除外]") continue;
    const title = safeText(row.page_title);
    if (!pages.has(path)) pages.set(path, { page_path: path, page_title: title, views: 0, users: 0, line_clicks: 0, reservation_clicks: 0 });
    const page = pages.get(path);
    if (!page.page_title && title) page.page_title = title;
    for (const field of ["views", "users", "line_clicks", "reservation_clicks"]) page[field] += number(row[field]) || 0;
  }
  return [...pages.values()].sort((a, b) => b.views - a.views || a.page_path.localeCompare(b.page_path)).slice(0, 20);
}

function table(columns, rows) {
  if (!rows.length) return "該当データなし。\n";
  const escape = (value) => String(Array.isArray(value) ? value.join(", ") : value ?? "").replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
  return `| ${columns.join(" | ")} |\n| ${columns.map(() => "---").join(" | ")} |\n${rows.map((row) => `| ${columns.map((column) => escape(row[column])).join(" | ")} |`).join("\n")}\n`;
}

function markdownFor(brief) {
  const social = brief.social_posts;
  const sections = [
    `# ブログ用ネタ帳\n\n期間: ${brief.period.start} 〜 ${brief.period.end}（JST、${brief.period.days}日）\n\n季節の対象月: ${brief.season.months.map((month) => `${month}月`).join("、")}\n`,
    `## SNS: 週別件数\n\n${table(["week_start", "sns_type", "count"], social.weekly_counts)}`,
    `## SNS: タグ上位50（週別・前週比）\n\n${table(["tag", "count", "weekly"], social.tags.map((tag) => ({ ...tag, weekly: tag.weeks.map((week) => `${week.week_start}: ${week.count} (${week.change >= 0 ? "+" : ""}${week.change})`).join(", ") })))}`,
    `## SNS: 分類・関連度\n\nカテゴリー\n\n${table(["value", "count"], social.categories)}\n関連度\n\n${table(["value", "count"], social.relevance)}`,
    `## SNS: 数値指標\n\n${table(["metric", "total", "average", "samples"], Object.entries(social.metrics).map(([metric, value]) => ({ metric, ...value })))}\n投稿上位は各数値指標の合計順。平均は値のある投稿のみが対象。\n\n${table(["sns_type", "published_at", "category", "tags", "ai_summary", ...METRICS], social.top_posts)}`,
    `## トレンドリンク\n\n${table(["title", "category", "tags", "salon_relevance", "registered_at"], brief.trend_links)}`,
    `## キーワード\n\n${table(["name", "category", "priority", "use_count"], brief.keywords)}\nSEO\n\n${table(["keyword", "intent", "priority", "status"], brief.seo_keywords)}`,
    `## Search Console: 表示回数上位\n\n${table(["query", "clicks", "impressions", "ctr", "position"], brief.seo_search_console_rows.top_queries)}\n順位5〜20位\n\n${table(["query", "clicks", "impressions", "ctr", "position"], brief.seo_search_console_rows.opportunities)}`,
    `## GA4: ページ別（表示回数順）\n\n同じページの行を合計。取込データに重複や異なる集計単位が混在すると、数値が重複する可能性があります。\n\n${table(["page_path", "page_title", "views", "users", "line_clicks", "reservation_clicks"], brief.seo_ga4_rows)}`,
    `## 既存記事（全期間、公開日または作成日の新しい順）\n\n公開記事\n\n${table(["title", "target_keyword", "status", "published_at", "created_at"], brief.published_blog_articles)}\nブログ記事\n\n${table(["title", "target_keyword", "status", "created_at"], brief.blog_posts)}`,
    `## 取得できなかったセクション\n\n${table(["section", "reason"], Object.entries(brief.unavailable_sections).map(([section, reason]) => ({ section, reason })))}`,
  ];
  return `${sections.join("\n")}\n`;
}

export function buildBlogBrief({ data = {}, errors = {}, now, days = 90 } = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError("now は有効な Date が必要です");
  if (!Number.isInteger(days) || days < 1) throw new RangeError("days は1以上の整数が必要です");
  const end = now.getTime();
  const start = end - days * DAY_MS;
  const names = ["social_posts", "trend_links", "keywords", "seo_keywords", "seo_search_console_rows", "seo_ga4_rows", "published_blog_articles", "blog_posts"];
  const unavailable = {};
  for (const name of names) {
    const related = name === "seo_search_console_rows" ? "seo_search_console_imports" : name === "seo_ga4_rows" ? "seo_ga4_imports" : null;
    const reason = errors[name] || (related && errors[related]);
    if (reason) unavailable[name] = safeText(reason) || "取得できませんでした";
    else if (!Array.isArray(data[name]) || (related && !Array.isArray(data[related]))) unavailable[name] = "データが渡されませんでした";
  }
  const rows = (name) => unavailable[name] ? [] : data[name];
  const social = rows("social_posts").filter((row) => within(row.published_at, start, end));
  const queryRows = latestImport(data, errors, "seo_search_console_rows", "seo_search_console_imports", (item) => !item.import_type || item.import_type === "query")
    .filter((row) => row.row_type === "query")
    .map((row) => ({ query: safeText(row.query), ...Object.fromEntries(["clicks", "impressions", "ctr", "position"].map((field) => [field, number(row[field])])) }))
    .sort((a, b) => (b.impressions || 0) - (a.impressions || 0));
  const month = new Date(end + JST_MS).getUTCMonth() + 1;
  const brief = {
    generated_at: now.toISOString(),
    period: { start: dateJst(start), end: dateJst(end), days, article_date_basis: "全期間、公開日（なければ作成日）の新しい順" },
    season: { months: [month, month % 12 + 1, (month + 1) % 12 + 1] },
    social_posts: socialSection(social, start, end),
    trend_links: rows("trend_links").filter((row) => within(row.registered_at, start, end)).map((row) => ({ ...pick(row, ["title", "category", "salon_relevance", "registered_at"]), tags: safeTags(row.tags) })),
    keywords: rows("keywords").map((row) => ({ ...pick(row, ["name", "category", "priority"]), use_count: number(row.use_count) })),
    seo_keywords: rows("seo_keywords").map((row) => pick(row, ["keyword", "intent", "priority", "status"])),
    seo_search_console_rows: { top_queries: queryRows.slice(0, 30), opportunities: queryRows.filter((row) => row.position !== null && row.position >= 5 && row.position <= 20).slice(0, 20) },
    seo_ga4_rows: ga4Pages(latestImport(data, errors, "seo_ga4_rows", "seo_ga4_imports")),
    published_blog_articles: rows("published_blog_articles").map((row) => pick(row, ["title", "target_keyword", "status", "published_at", "created_at"])).sort((a, b) => articleDate(b) - articleDate(a)),
    blog_posts: rows("blog_posts").map((row) => pick(row, ["title", "target_keyword", "status", "created_at"])).sort((a, b) => articleDate(b) - articleDate(a)),
    unavailable_sections: unavailable,
  };
  return { brief, markdown: markdownFor(brief) };
}
