import { NextResponse } from "next/server";
import { generateBlogRewriteSuggestion } from "@/lib/blogRewrite.server";
import { saveBlogRewriteHistory } from "@/lib/supabase/existingBlog.server";
import type { ExistingBlogArticle } from "@/types/existingBlog";

export const runtime = "nodejs";

function safeArticle(value: unknown): ExistingBlogArticle | null {
  if (!value || typeof value !== "object") return null;
  const article = value as ExistingBlogArticle;
  if (!article.title || !article.url) return null;
  return article;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const article = safeArticle(body.article);

  if (!article) {
    return NextResponse.json(
      { error: "リライトする記事を選んでください。" },
      { status: 400 },
    );
  }

  try {
    const suggestion = await generateBlogRewriteSuggestion(article);
    const history = await saveBlogRewriteHistory({ article, suggestion });
    return NextResponse.json({ history, suggestion });
  } catch (error) {
    console.error("[blog-rewrite] failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "リライト提案を作成できませんでした。時間をおいてもう一度お試しください。" },
      { status: 500 },
    );
  }
}
