import { getSupabaseClient } from "@/lib/supabase/client";
import { snsTrendCategories } from "@/lib/sns";
import type { SnsType } from "@/types/snsPost";
import type {
  NewSocialPost,
  SocialPost,
  SocialReviewStatus,
} from "@/types/social";
import type { SalonRelevance, TrendCategory } from "@/types/trend";

type SocialPostRow = {
  id: string;
  source_id: string | null;
  sns_type: string;
  url: string;
  canonical_url: string;
  title: string;
  description: string | null;
  og_image_url: string | null;
  published_at: string | null;
  category: string;
  tags: string[] | null;
  ai_summary: string | null;
  relevance: string;
  instagram_post_idea: string | null;
  blog_idea: string | null;
  counseling_idea: string | null;
  source_name?: string | null;
  provider?: string | null;
  actor_id?: string | null;
  actor_run_id?: string | null;
  dataset_id?: string | null;
  import_run_id?: string | null;
  import_key?: string | null;
  payload_hash?: string | null;
  account_name?: string | null;
  handle?: string | null;
  external_id?: string | null;
  like_count?: number | null;
  comment_count?: number | null;
  play_count?: number | null;
  share_count?: number | null;
  raw_payload?: Record<string, unknown> | null;
  classification_provider?: string | null;
  classification_model?: string | null;
  classification_status?: string | null;
  classification_error?: string | null;
  classified_at?: string | null;
  review_status?: string | null;
  is_favorite?: boolean | null;
  imported_at: string;
  created_at?: string;
  updated_at?: string;
};

const selectFields =
  "id,source_id,sns_type,url,canonical_url,title,description,og_image_url,published_at,category,tags,ai_summary,relevance,instagram_post_idea,blog_idea,counseling_idea,source_name,provider,actor_id,actor_run_id,dataset_id,import_run_id,import_key,payload_hash,account_name,handle,external_id,like_count,comment_count,play_count,share_count,raw_payload,classification_provider,classification_model,classification_status,classification_error,classified_at,review_status,is_favorite,imported_at,created_at,updated_at";
const legacySelectFields =
  "id,source_id,sns_type,url,canonical_url,title,description,og_image_url,published_at,category,tags,ai_summary,relevance,instagram_post_idea,blog_idea,counseling_idea,imported_at,created_at,updated_at";
const legacyInsertOnlyFields = [
  "source_name",
  "provider",
  "actor_id",
  "actor_run_id",
  "dataset_id",
  "import_run_id",
  "import_key",
  "payload_hash",
  "account_name",
  "handle",
  "external_id",
  "like_count",
  "comment_count",
  "play_count",
  "share_count",
  "raw_payload",
  "classification_provider",
  "classification_model",
  "classification_status",
  "classification_error",
  "classified_at",
  "review_status",
  "is_favorite",
] as const;

function toSnsType(value: string): SnsType {
  return value === "Instagram" ||
    value === "YouTube" ||
    value === "Pinterest" ||
    value === "TikTok" ||
    value === "X"
    ? value
    : "Other";
}

function toCategory(value: string): TrendCategory {
  return (
    snsTrendCategories.find((category) => category === value) ?? "SNS投稿"
  );
}

function toRelevance(value: string): SalonRelevance {
  return value === "高" || value === "中" || value === "低" ? value : "中";
}

function toReviewStatus(value: string | null | undefined): SocialReviewStatus {
  return value === "採用" ||
    value === "保留" ||
    value === "不要" ||
    value === "未確認"
    ? value
    : "未確認";
}

function toSocialPost(row: SocialPostRow): SocialPost {
  return {
    aiSummary: row.ai_summary ?? "",
    blogIdea: row.blog_idea ?? "",
    canonicalUrl: row.canonical_url,
    category: toCategory(row.category),
    counselingIdea: row.counseling_idea ?? "",
    accountName: row.account_name ?? undefined,
    commentCount: row.comment_count ?? undefined,
    isFavorite: row.is_favorite ?? false,
    classificationError: row.classification_error ?? undefined,
    classificationModel: row.classification_model ?? undefined,
    classificationProvider: row.classification_provider ?? undefined,
    classificationStatus:
      row.classification_status === "gemini" ||
      row.classification_status === "mock" ||
      row.classification_status === "fallback" ||
      row.classification_status === "not_requested"
        ? row.classification_status
        : undefined,
    classifiedAt: row.classified_at ?? undefined,
    createdAt: row.created_at,
    description: row.description ?? "",
    externalId: row.external_id ?? undefined,
    handle: row.handle ?? undefined,
    id: row.id,
    importedAt: row.imported_at,
    importKey: row.import_key ?? undefined,
    importRunId: row.import_run_id ?? undefined,
    instagramPostIdea: row.instagram_post_idea ?? "",
    likeCount: row.like_count ?? undefined,
    ogImageUrl: row.og_image_url ?? "",
    payloadHash: row.payload_hash ?? undefined,
    provider: row.provider ?? undefined,
    playCount: row.play_count ?? undefined,
    publishedAt: row.published_at ?? undefined,
    rawPayload: row.raw_payload ?? undefined,
    relevance: toRelevance(row.relevance),
    reviewStatus: toReviewStatus(row.review_status),
    shareCount: row.share_count ?? undefined,
    snsType: toSnsType(row.sns_type),
    sourceName: row.source_name ?? undefined,
    sourceId: row.source_id ?? undefined,
    tags: row.tags ?? [],
    title: row.title,
    updatedAt: row.updated_at,
    actorId: row.actor_id ?? undefined,
    actorRunId: row.actor_run_id ?? undefined,
    datasetId: row.dataset_id ?? undefined,
    url: row.url,
  };
}

function toRow(input: NewSocialPost) {
  return {
    ai_summary: input.aiSummary,
    blog_idea: input.blogIdea,
    canonical_url: input.canonicalUrl,
    category: input.category,
    counseling_idea: input.counselingIdea,
    description: input.description,
    actor_id: input.actorId || null,
    actor_run_id: input.actorRunId || null,
    classification_error: input.classificationError || null,
    classification_model: input.classificationModel || null,
    classification_provider: input.classificationProvider || null,
    classification_status: input.classificationStatus || null,
    classified_at: input.classifiedAt || null,
    dataset_id: input.datasetId || null,
    account_name: input.accountName || null,
    comment_count: input.commentCount ?? null,
    external_id: input.externalId || null,
    handle: input.handle || null,
    imported_at: input.importedAt,
    import_key: input.importKey || null,
    import_run_id: input.importRunId || null,
    instagram_post_idea: input.instagramPostIdea,
    like_count: input.likeCount ?? null,
    og_image_url: input.ogImageUrl,
    payload_hash: input.payloadHash || null,
    play_count: input.playCount ?? null,
    published_at: input.publishedAt || null,
    raw_payload: input.rawPayload ?? {},
    relevance: input.relevance,
    review_status: input.reviewStatus ?? "未確認",
    is_favorite: input.isFavorite ?? false,
    share_count: input.shareCount ?? null,
    sns_type: input.snsType,
    source_name: input.sourceName || null,
    provider: input.provider || null,
    source_id: input.sourceId || null,
    tags: input.tags,
    title: input.title,
    url: input.url,
  };
}

export async function fetchSocialPostsFromSupabase() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("social_posts")
    .select(selectFields)
    .order("imported_at", { ascending: false });

  if (!error) {
    return (data ?? []).map((row) => toSocialPost(row as SocialPostRow));
  }

  const fallback = await supabase
    .from("social_posts")
    .select(legacySelectFields)
    .order("imported_at", { ascending: false });

  if (fallback.error) {
    throw fallback.error;
  }

  return (fallback.data ?? []).map((row) => toSocialPost(row as SocialPostRow));
}

export async function createSocialPostInSupabase(input: NewSocialPost) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("social_posts")
    .insert(toRow(input))
    .select(selectFields)
    .single();

  if (!error) {
    return toSocialPost(data as SocialPostRow);
  }

  const fallbackRow = toRow(input);
  const legacyRow = { ...fallbackRow };
  legacyInsertOnlyFields.forEach((field) => {
    delete (legacyRow as Partial<typeof fallbackRow>)[field];
  });
  const fallback = await supabase
    .from("social_posts")
    .insert(legacyRow)
    .select(legacySelectFields)
    .single();

  if (fallback.error) {
    throw error;
  }

  return toSocialPost(fallback.data as SocialPostRow);
}

type SocialPostUpdate = {
  reviewStatus?: SocialReviewStatus;
  isFavorite?: boolean;
};

function toUpdateRow(changes: SocialPostUpdate) {
  return {
    ...(changes.reviewStatus
      ? { review_status: changes.reviewStatus }
      : {}),
    ...(typeof changes.isFavorite === "boolean"
      ? { is_favorite: changes.isFavorite }
      : {}),
  };
}

export async function updateSocialPostInSupabase(
  id: string,
  changes: SocialPostUpdate,
) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("social_posts")
    .update(toUpdateRow(changes))
    .eq("id", id)
    .select(selectFields)
    .single();

  if (error) {
    throw error;
  }

  return toSocialPost(data as SocialPostRow);
}

export async function updateSocialPostsInSupabase(
  ids: string[],
  changes: SocialPostUpdate,
) {
  const supabase = getSupabaseClient();

  if (!supabase || ids.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("social_posts")
    .update(toUpdateRow(changes))
    .in("id", ids)
    .select(selectFields);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => toSocialPost(row as SocialPostRow));
}
