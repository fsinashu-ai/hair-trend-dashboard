import { NextResponse } from "next/server";
import {
  createExistingBlogArticle,
  deleteExistingBlogArticle,
  fetchExistingBlogArticles,
  updateExistingBlogArticle,
} from "@/lib/supabase/existingBlog.server";
import { isServerSupabaseConfigured } from "@/lib/supabase/serverClient";
import {
  normalizeExistingBlogSourceType,
  normalizeExistingBlogStatus,
  toStringList,
} from "@/lib/existingBlog";
import type { ExistingBlogArticleInput } from "@/types/existingBlog";

export const runtime = "nodejs";

function safeString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function sanitizeArticleInput(value: unknown): ExistingBlogArticleInput {
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    canonicalUrl: safeString(record.canonicalUrl, 700),
    category: safeString(record.category, 80) || "髪質改善",
    lastUpdatedAt: safeString(record.lastUpdatedAt, 10),
    memo: safeString(record.memo, 1000),
    publishedAt: safeString(record.publishedAt, 10),
    secondaryKeywords: toStringList(
      Array.isArray(record.secondaryKeywords)
        ? record.secondaryKeywords.filter(
            (item): item is string => typeof item === "string",
          )
        : safeString(record.secondaryKeywords, 500),
    ),
    sourceType: normalizeExistingBlogSourceType(
      safeString(record.sourceType, 40),
    ),
    status: normalizeExistingBlogStatus(safeString(record.status, 40)),
    targetKeyword: safeString(record.targetKeyword, 120),
    title: safeString(record.title, 180),
    url: safeString(record.url, 700),
  };
}

function validateInput(input: ExistingBlogArticleInput) {
  if (!input.title) return "記事タイトルを入力してください。";
  if (!input.url) return "記事URLを入力してください。";
  if (!/^https?:\/\//.test(input.url)) {
    return "記事URLは https:// から始まるURLで入力してください。";
  }
  return "";
}

export async function GET() {
  if (!isServerSupabaseConfigured()) {
    return NextResponse.json({
      articles: [],
      message: "Supabase未設定のため、画面側のサンプルデータで動作します。",
      mode: "local",
    });
  }

  try {
    const articles = (await fetchExistingBlogArticles()) ?? [];
    return NextResponse.json({ articles, mode: "supabase" });
  } catch (error) {
    console.error("[existing-blog] fetch failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "既存ブログを読み込めませんでした。Supabaseのテーブル設定を確認してください。" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const input = sanitizeArticleInput(await request.json().catch(() => ({})));
  const validationError = validateInput(input);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  if (!isServerSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase未設定のため、この端末内に保存してください。" },
      { status: 503 },
    );
  }

  try {
    const article = await createExistingBlogArticle(input);
    return NextResponse.json({ article });
  } catch (error) {
    console.error("[existing-blog] create failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "既存ブログを保存できませんでした。URLの重複やSQL設定を確認してください。" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const id = safeString(body.id, 100);
  const input = sanitizeArticleInput(body.article ?? body);
  const validationError = validateInput(input);

  if (!id) {
    return NextResponse.json({ error: "更新する記事が見つかりません。" }, { status: 400 });
  }
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  if (!isServerSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase未設定のため、この端末内で更新してください。" },
      { status: 503 },
    );
  }

  try {
    const article = await updateExistingBlogArticle(id, input);
    return NextResponse.json({ article });
  } catch (error) {
    console.error("[existing-blog] update failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "既存ブログを更新できませんでした。" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const id = safeString(body.id, 100);

  if (!id) {
    return NextResponse.json({ error: "削除する記事が見つかりません。" }, { status: 400 });
  }

  if (!isServerSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase未設定のため、この端末内で削除してください。" },
      { status: 503 },
    );
  }

  try {
    await deleteExistingBlogArticle(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[existing-blog] delete failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "既存ブログを削除できませんでした。" },
      { status: 500 },
    );
  }
}
