import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { buildBlogBrief } from "./buildBlogBrief.mjs";

const PAGE_SIZE = 500;

function parseDays(args) {
  if (args.length === 0) return 90;
  if (args.length !== 2 || args[0] !== "--days" || !/^\d+$/.test(args[1])) {
    throw new Error("引数は --days 正の整数 の形式で指定してください。");
  }
  const days = Number(args[1]);
  if (!Number.isSafeInteger(days) || days < 1 || days > 36500) {
    throw new Error("--days は 1 から 36500 の整数で指定してください。");
  }
  return days;
}

function jstDate(date) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function safeReason(error) {
  const code = error?.code;
  if (["42P01", "42703", "PGRST204", "PGRST205"].includes(code)) {
    return "テーブルまたは必要な列が存在しないか、APIに公開されていません。";
  }
  if (code === "42501" || error?.status === 401 || error?.status === 403) {
    return "読み取り権限がありません。";
  }
  return "データ取得に失敗しました。接続、権限、テーブル設定を確認してください。";
}

async function readAll(client, table, columns, configure = (query) => query) {
  const rows = [];
  let total = null;
  do {
    const query = client.from(table).select(columns, { count: "exact" }).order("id");
    const result = await configure(query).range(rows.length, rows.length + PAGE_SIZE - 1);
    if (result.error) throw result.error;
    if (result.count === null) throw new Error("取得件数を確認できません。");
    total = result.count;
    if (result.data.length === 0 && rows.length < total) {
      throw new Error("全件を取得できません。");
    }
    rows.push(...result.data);
  } while (rows.length < total);
  return rows;
}

async function latestImport(client, table, isSearchConsole) {
  let query = client.from(table)
    .select(isSearchConsole ? "id,created_at,import_type,status" : "id,created_at,status")
    .in("status", ["imported", "analyzed"])
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);
  if (isSearchConsole) query = query.eq("import_type", "query");
  const result = await query;
  if (result.error) throw result.error;
  return result.data;
}

async function main() {
  const days = parseDays(process.argv.slice(2));
  let env;
  try {
    env = parseEnv(await readFile(join(process.cwd(), ".env.local"), "utf8"));
  } catch {
    throw new Error(".env.local を読み取れません。設定ファイルを確認してください。");
  }
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error(".env.local に必要な Supabase の設定がありません。");
  }
  let client;
  try {
    client = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  } catch {
    throw new Error("Supabase の接続設定が正しくありません。");
  }

  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const data = {};
  const errors = {};
  const sections = [
    ["social_posts", "sns_type,published_at,category,tags,ai_summary,relevance,like_count,comment_count,play_count,share_count", (query) => query.gte("published_at", start.toISOString()).lte("published_at", now.toISOString())],
    ["trend_links", "title,category,tags,salon_relevance,registered_at", (query) => query.gte("registered_at", jstDate(start)).lte("registered_at", jstDate(now))],
    ["keywords", "name,category,priority,use_count"],
    ["seo_keywords", "keyword,intent,priority,status"],
    ["published_blog_articles", "title,target_keyword,status,published_at,created_at"],
    ["blog_posts", "title,target_keyword,status,created_at"],
  ];

  await Promise.all(sections.map(async ([table, columns, configure]) => {
    try {
      data[table] = await readAll(client, table, columns, configure);
    } catch (error) {
      data[table] = [];
      errors[table] = safeReason(error);
    }
  }));

  const importedSections = [
    ["seo_search_console_imports", "seo_search_console_rows", "import_id,row_type,query,clicks,impressions,ctr,position", true],
    ["seo_ga4_imports", "seo_ga4_rows", "import_id,page_path,landing_page,page_title,views,users,line_clicks,reservation_clicks", false],
  ];
  await Promise.all(importedSections.map(async ([importsTable, rowsTable, columns, isSearchConsole]) => {
    data[importsTable] = [];
    data[rowsTable] = [];
    try {
      const imports = await latestImport(client, importsTable, isSearchConsole);
      data[importsTable] = imports;
      if (imports.length === 0) return;
      data[rowsTable] = await readAll(client, rowsTable, columns, (query) => {
        const filtered = query.eq("import_id", imports[0].id);
        return isSearchConsole ? filtered.eq("row_type", "query") : filtered;
      });
    } catch (error) {
      data[importsTable] = [];
      data[rowsTable] = [];
      errors[rowsTable] = safeReason(error);
    }
  }));

  const { brief, markdown } = buildBlogBrief({ data, errors, now, days });
  const outputDirectory = join(process.cwd(), "runtime-data", "blog-brief");
  const basename = `brief-${jstDate(now).replaceAll("-", "")}`;
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(join(outputDirectory, `${basename}.json`), `${JSON.stringify(brief, null, 2)}\n`, "utf8");
  await writeFile(join(outputDirectory, `${basename}.md`), markdown, "utf8");
  console.log(`runtime-data/blog-brief/${basename}.json と .md を作成しました。`);
}

main().catch((error) => {
  const safeMessages = [
    "引数は --days 正の整数 の形式で指定してください。",
    "--days は 1 から 36500 の整数で指定してください。",
    ".env.local を読み取れません。設定ファイルを確認してください。",
    ".env.local に必要な Supabase の設定がありません。",
    "Supabase の接続設定が正しくありません。",
  ];
  console.error(safeMessages.includes(error?.message) ? error.message : "ネタ帳の書き出しに失敗しました。ファイルの書き込み権限などを確認してください。");
  process.exitCode = 1;
});
