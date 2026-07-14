"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BlogEditor } from "@/components/blog/BlogEditor";
import { BlogGenerator } from "@/components/blog/BlogGenerator";
import { BlogList } from "@/components/blog/BlogList";
import { WordPressPreview } from "@/components/blog/WordPressPreview";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { dummyBlogPosts } from "@/data/dummyBlogPosts";
import { dummyTrends } from "@/data/dummyTrends";
import {
  createWordPressPreviewHtml,
  createLocalBlogPost,
  createSlug,
  getEmptySeoBlogFields,
  getTodayIsoDate,
  normalizeBlogCategory,
  sanitizeWordPressHtml,
  textToStringList,
  withBlogSeoDefaults,
} from "@/lib/blog";
import {
  readLocalBackupBlogPosts,
  readLocalBackupSnsPosts,
  saveLocalBackupBlogPosts,
} from "@/lib/backup/localStorage";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  createBlogPostInSupabase,
  deleteBlogPostFromSupabase,
  fetchBlogPostsFromSupabase,
  updateBlogPostInSupabase,
} from "@/lib/supabase/blogPosts";
import { fetchSnsPostsFromSupabase } from "@/lib/supabase/snsPosts";
import { fetchTrendLinksFromSupabase } from "@/lib/supabase/trends";
import type {
  BlogCategory,
  BlogGenerateRequest,
  BlogPost,
  BlogPostInput,
} from "@/types/blog";
import type { SnsPost } from "@/types/snsPost";
import type { Trend } from "@/types/trend";

type BlogView = "list" | "editor" | "generator" | "preview";
type StatusTone = "neutral" | "info" | "success" | "warning" | "error";

const supabaseEnabled = isSupabaseConfigured();

function createEmptyDraft(): BlogPostInput {
  return {
    ...getEmptySeoBlogFields(),
    category: "髪質改善",
    content: "",
    excerpt: "",
    metaDescription: "",
    relatedSnsPostIds: [],
    relatedTrendIds: [],
    relatedYoutubeUrls: [],
    slug: `hair-blog-${getTodayIsoDate()}`,
    status: "draft",
    tags: ["髪質改善", "松江市美容室"],
    targetKeyword: "",
    title: "",
  };
}

function createDraftFromParams(searchParams: URLSearchParams): BlogPostInput {
  const title = searchParams.get("title") ?? "";
  const keyword =
    searchParams.get("keyword") ??
    searchParams.get("category") ??
    "松江市 髪質改善";
  const category = normalizeBlogCategory(
    searchParams.get("blogCategory") ?? searchParams.get("category") ?? "髪質改善",
  );
  const trendId = searchParams.get("trendId");
  const snsPostId = searchParams.get("snsPostId");
  const youtubeUrl = searchParams.get("youtubeUrl") ?? searchParams.get("url");
  const draft = createEmptyDraft();

  return {
    ...draft,
    articleSummary:
      searchParams.get("summary") ?? searchParams.get("memo") ?? "",
    category,
    content: title
      ? [
          `${keyword}について、ef.mayke\`sのブログ下書きとして整理します。`,
          "## この記事で伝えたいこと",
          "ここにお客様の悩み、施術の考え方、ホームケアのポイントを書きます。",
          "## まとめ",
          "本気で髪を綺麗にしたい方は、まずはLINEからご相談ください。",
        ].join("\n\n")
      : draft.content,
    relatedSnsPostIds: snsPostId ? [snsPostId] : [],
    relatedTrendIds: trendId ? [trendId] : [],
    relatedYoutubeUrls: youtubeUrl?.includes("youtube") ? [youtubeUrl] : [],
    searchIntent: searchParams.get("searchIntent") ?? "",
    secondaryKeywords: textToStringList(
      searchParams.get("secondaryKeywords") ?? "",
    ),
    slug: createSlug(`${keyword}-${title || "blog"}`),
    sourceSeoKeywordId: searchParams.get("seoKeywordId") ?? "",
    sourceSearchConsoleImportId:
      searchParams.get("sourceSearchConsoleImportId") ?? "",
    tags: Array.from(new Set([keyword, category, "松江市美容室"])).filter(Boolean),
    targetKeyword: keyword,
    targetAudience: searchParams.get("targetAudience") ?? "",
    title: title ? `${title}をブログ化` : draft.title,
  };
}

function toBlogInput(post: BlogPost): BlogPostInput {
  const { createdAt, id, updatedAt, ...input } = withBlogSeoDefaults(post);
  void createdAt;
  void id;
  void updatedAt;
  return input;
}

function createGenerateRequestFromParams(
  searchParams: URLSearchParams,
): Partial<BlogGenerateRequest> {
  const title = searchParams.get("title") ?? "";
  const memo = searchParams.get("memo") ?? searchParams.get("summary") ?? "";

  return {
    articleSummary: memo,
    mainKeyword:
      searchParams.get("keyword") ??
      searchParams.get("category") ??
      "松江 髪質改善",
    preferredTitle: title,
    readerProblems: textToStringList(searchParams.get("readerProblems") ?? ""),
    referenceMemos: memo ? [memo] : [],
    referenceTitles: title ? [title] : [],
    searchIntent: searchParams.get("searchIntent") ?? "",
    secondaryKeywords: textToStringList(
      searchParams.get("secondaryKeywords") ?? "",
    ),
    sourcePriority: searchParams.get("priority") ?? "",
    sourceSeoKeywordId: searchParams.get("seoKeywordId") ?? "",
    sourceSearchConsoleImportId:
      searchParams.get("sourceSearchConsoleImportId") ?? "",
    sourceTargetPage: searchParams.get("targetPage") ?? "",
    sourceTrendId: searchParams.get("trendId") ?? "",
    targetAudience: searchParams.get("targetAudience") ?? "",
  };
}

function matchesBlogPost(post: BlogPost, query: string) {
  const lowerQuery = query.trim().toLowerCase();

  if (!lowerQuery) {
    return true;
  }

  return [
    post.title,
    post.slug,
    post.category,
    post.targetKeyword,
    post.excerpt,
    post.metaDescription,
    ...post.tags,
  ]
    .join(" ")
    .toLowerCase()
    .includes(lowerQuery);
}

export function BlogManager() {
  const searchParams = useSearchParams();
  const hasBlogSource =
    Boolean(searchParams.get("title")) || Boolean(searchParams.get("keyword"));
  const initialGeneratorRequest = useMemo(
    () => createGenerateRequestFromParams(searchParams),
    [searchParams],
  );
  const [posts, setPosts] = useState<BlogPost[]>(() =>
    supabaseEnabled ? [] : readLocalBackupBlogPosts() ?? dummyBlogPosts,
  );
  const [trends, setTrends] = useState<Trend[]>(() =>
    supabaseEnabled ? [] : dummyTrends,
  );
  const [snsPosts, setSnsPosts] = useState<SnsPost[]>(() =>
    supabaseEnabled ? [] : readLocalBackupSnsPosts() ?? [],
  );
  const [view, setView] = useState<BlogView>(
    searchParams.get("view") === "generator"
      ? "generator"
      : hasBlogSource
        ? "editor"
        : "list",
  );
  const [draft, setDraft] = useState<BlogPostInput>(() =>
    hasBlogSource ? createDraftFromParams(searchParams) : createEmptyDraft(),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("すべて");
  const [selectedStatus, setSelectedStatus] = useState("すべて");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [isLoading, setIsLoading] = useState(supabaseEnabled);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<StatusTone>(
    supabaseEnabled ? "info" : "warning",
  );
  const [message, setMessage] = useState(
    supabaseEnabled
      ? "Supabaseからブログ記事を読み込んでいます。"
      : "Supabase未設定のため、この端末にブログ下書きを保存します。",
  );

  useEffect(() => {
    if (!supabaseEnabled) {
      return;
    }

    let isMounted = true;

    async function loadBlogData() {
      try {
        const [blogPosts, trendLinks, snsPostData] = await Promise.all([
          fetchBlogPostsFromSupabase(),
          fetchTrendLinksFromSupabase(),
          fetchSnsPostsFromSupabase(),
        ]);

        if (!isMounted) {
          return;
        }

        setPosts(blogPosts ?? []);
        setTrends(trendLinks ?? []);
        setSnsPosts(snsPostData ?? []);
        setStatusTone(blogPosts?.length ? "success" : "warning");
        setMessage(
          blogPosts?.length
            ? "Supabaseに保存されているブログ記事を表示しています。"
            : "データ待ちです。新規作成またはAIブログ生成から下書きを作成してください。",
        );
      } catch {
        if (!isMounted) {
          return;
        }

        setPosts([]);
        setTrends([]);
        setSnsPosts([]);
        setStatusTone("warning");
        setMessage(
          "取得に失敗しました。再読み込みしても直らない場合はblog_postsテーブル設定を確認してください。",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadBlogData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (supabaseEnabled) {
      return;
    }

    saveLocalBackupBlogPosts(posts);
  }, [posts]);

  const categories = useMemo(
    () =>
      Array.from(new Set(posts.map((post) => post.category))).sort((a, b) =>
        a.localeCompare(b, "ja"),
      ) as BlogCategory[],
    [posts],
  );

  const filteredPosts = useMemo(() => {
    const matchedPosts = posts.filter((post) => {
      const matchesCategory =
        selectedCategory === "すべて" || post.category === selectedCategory;
      const matchesStatus =
        selectedStatus === "すべて" || post.status === selectedStatus;

      return matchesCategory && matchesStatus && matchesBlogPost(post, searchText);
    });

    return [...matchedPosts].sort((first, second) => {
      const firstTime = new Date(first.createdAt).getTime() || 0;
      const secondTime = new Date(second.createdAt).getTime() || 0;

      return sortOrder === "newest" ? secondTime - firstTime : firstTime - secondTime;
    });
  }, [posts, searchText, selectedCategory, selectedStatus, sortOrder]);

  function startCreate() {
    setEditingId(null);
    setDraft(createEmptyDraft());
    setView("editor");
  }

  function startEdit(post: BlogPost) {
    setEditingId(post.id);
    setDraft(toBlogInput(post));
    setView("editor");
  }

  async function saveDraft() {
    if (!draft.title.trim() || !draft.content.trim()) {
      setStatusTone("warning");
      setMessage("タイトルと本文を入力してください。");
      return;
    }

    const safeDraft = withBlogSeoDefaults({
      ...draft,
      bodyHtml: sanitizeWordPressHtml(draft.bodyHtml ?? ""),
      wordpressHtml: sanitizeWordPressHtml(
        draft.wordpressHtml?.trim()
          ? draft.wordpressHtml
          : createWordPressPreviewHtml(draft.content),
      ),
    });

    setIsSaving(true);
    setStatusTone("info");
    setMessage("ブログ下書きを保存しています。");

    try {
      if (supabaseEnabled) {
        const shouldUpdate = editingId && !editingId.startsWith("dummy-");
        const savedPost = shouldUpdate
          ? await updateBlogPostInSupabase(editingId, safeDraft)
          : await createBlogPostInSupabase(safeDraft);

        if (savedPost) {
          setPosts((currentPosts) => {
            const withoutCurrent = currentPosts.filter(
              (post) => post.id !== editingId,
            );

            return [savedPost, ...withoutCurrent];
          });
        }

        setStatusTone("success");
        setMessage("ブログ下書きをSupabaseに保存しました。");
      } else if (editingId) {
        setPosts((currentPosts) =>
          currentPosts.map((post) =>
            post.id === editingId
              ? {
                  ...post,
                  ...safeDraft,
                  updatedAt: new Date().toISOString(),
                }
              : post,
          ),
        );
        setStatusTone("warning");
        setMessage("この端末のブログ下書きを更新しました。");
      } else {
        setPosts((currentPosts) => [
          createLocalBlogPost(safeDraft),
          ...currentPosts,
        ]);
        setStatusTone("warning");
        setMessage("この端末にブログ下書きを保存しました。");
      }

      setEditingId(null);
      setDraft(createEmptyDraft());
      setView("list");
    } catch {
      setStatusTone("error");
      setMessage("ブログ下書きの保存に失敗しました。Supabase設定を確認してください。");
    } finally {
      setIsSaving(false);
    }
  }

  async function deletePost(postId: string) {
    setDeletingId(postId);
    setStatusTone("info");
    setMessage("ブログ記事を削除しています。");

    try {
      if (supabaseEnabled && !postId.startsWith("dummy-")) {
        await deleteBlogPostFromSupabase(postId);
      }

      setPosts((currentPosts) => currentPosts.filter((post) => post.id !== postId));
      setStatusTone("success");
      setMessage("ブログ記事を削除しました。");
    } catch {
      setStatusTone("error");
      setMessage("ブログ記事の削除に失敗しました。");
    } finally {
      setDeletingId(null);
    }
  }

  async function duplicatePost(post: BlogPost) {
    const duplicatedDraft: BlogPostInput = {
      ...toBlogInput(post),
      slug: createSlug(`${post.slug}-copy`),
      status: "draft",
      title: `${post.title} のコピー`,
    };

    setIsSaving(true);
    setStatusTone("info");
    setMessage("ブログ記事を複製しています。");

    try {
      if (supabaseEnabled) {
        const savedPost = await createBlogPostInSupabase(duplicatedDraft);

        if (savedPost) {
          setPosts((currentPosts) => [savedPost, ...currentPosts]);
        }
      } else {
        setPosts((currentPosts) => [
          createLocalBlogPost(duplicatedDraft),
          ...currentPosts,
        ]);
      }

      setStatusTone("success");
      setMessage("ブログ記事を複製しました。");
    } catch {
      setStatusTone("error");
      setMessage("ブログ記事の複製に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  function applyGeneratedDraft(generatedDraft: BlogPostInput) {
    setEditingId(null);
    setDraft(generatedDraft);
    setView("editor");
  }

  return (
    <>
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {[
          ["list", "ブログ管理"],
          ["editor", editingId ? "ブログ編集" : "ブログ新規作成"],
          ["generator", "AIブログ生成"],
          ["preview", "WordPressプレビュー"],
        ].map(([value, label]) => (
          <button
            className={`min-h-10 shrink-0 rounded-md border px-3 text-sm font-semibold ${
              view === value
                ? "border-teal-700 bg-teal-50 text-teal-800"
                : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
            }`}
            key={value}
            onClick={() => setView(value as BlogView)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-5">
        <StatusMessage
          isLoading={isLoading || isSaving || Boolean(deletingId)}
          tone={statusTone}
        >
          {isLoading ? "ブログデータを読み込んでいます。" : message}
        </StatusMessage>
      </div>

      {view === "list" ? (
        <BlogList
          categories={categories}
          deletingId={deletingId}
          filteredPosts={filteredPosts}
          postsCount={posts.length}
          searchText={searchText}
          selectedCategory={selectedCategory}
          selectedStatus={selectedStatus}
          sortOrder={sortOrder}
          onCategoryChange={setSelectedCategory}
          onCreate={startCreate}
          onDelete={deletePost}
          onDuplicate={duplicatePost}
          onEdit={startEdit}
          onSearchChange={setSearchText}
          onSortChange={setSortOrder}
          onStatusChange={setSelectedStatus}
        />
      ) : null}

      {view === "editor" ? (
        <BlogEditor
          draft={draft}
          editingId={editingId}
          isSaving={isSaving}
          snsPosts={snsPosts}
          trends={trends}
          onCancel={() => setView("list")}
          onChange={setDraft}
          onPreview={() => setView("preview")}
          onSubmit={saveDraft}
        />
      ) : null}

      {view === "generator" ? (
        <BlogGenerator
          initialRequest={initialGeneratorRequest}
          initialSeoKeywordId={searchParams.get("seoKeywordId") ?? undefined}
          initialTrendId={searchParams.get("trendId") ?? undefined}
          snsPosts={snsPosts}
          trends={trends}
          onGenerated={applyGeneratedDraft}
        />
      ) : null}

      {view === "preview" ? (
        <WordPressPreview post={draft} />
      ) : null}
    </>
  );
}
