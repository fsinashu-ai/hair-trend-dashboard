import { getSupabaseClient } from "@/lib/supabase/client";
import type { SnsType } from "@/types/snsPost";
import type {
  NewSocialSource,
  SocialPriority,
  SocialSource,
  SocialSourceMode,
} from "@/types/social";

type SocialSourceRow = {
  id: string;
  sns_type: string;
  account_name: string;
  handle: string;
  profile_url: string;
  category: string;
  source_mode: string;
  is_active: boolean;
  priority: string;
  memo: string | null;
  last_checked_at: string | null;
  last_error: string | null;
  created_at?: string;
  updated_at?: string;
};

const selectFields =
  "id,sns_type,account_name,handle,profile_url,category,source_mode,is_active,priority,memo,last_checked_at,last_error,created_at,updated_at";

function toSnsType(value: string): SnsType {
  return value === "Instagram" ||
    value === "YouTube" ||
    value === "Pinterest" ||
    value === "TikTok" ||
    value === "X"
    ? value
    : "Other";
}

function toMode(value: string): SocialSourceMode {
  return value === "official_api" ||
    value === "manual_url" ||
    value === "metadata_only"
    ? value
    : "manual_url";
}

function toPriority(value: string): SocialPriority {
  return value === "high" || value === "medium" || value === "low"
    ? value
    : "medium";
}

function toSocialSource(row: SocialSourceRow): SocialSource {
  return {
    accountName: row.account_name,
    category: row.category as SocialSource["category"],
    createdAt: row.created_at,
    handle: row.handle,
    id: row.id,
    isActive: row.is_active,
    lastCheckedAt: row.last_checked_at ?? undefined,
    lastError: row.last_error ?? "",
    memo: row.memo ?? "",
    priority: toPriority(row.priority),
    profileUrl: row.profile_url,
    snsType: toSnsType(row.sns_type),
    sourceMode: toMode(row.source_mode),
    updatedAt: row.updated_at,
  };
}

function toRow(input: NewSocialSource) {
  return {
    account_name: input.accountName,
    category: input.category ?? "その他",
    handle: input.handle ?? "",
    is_active: input.isActive,
    memo: input.memo,
    priority: input.priority,
    profile_url: input.profileUrl,
    sns_type: input.snsType,
    source_mode: input.sourceMode,
  };
}

export async function fetchSocialSourcesFromSupabase() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("social_sources")
    .select(selectFields)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => toSocialSource(row as SocialSourceRow));
}

export async function createSocialSourceInSupabase(input: NewSocialSource) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("social_sources")
    .insert(toRow(input))
    .select(selectFields)
    .single();

  if (error) {
    throw error;
  }

  return toSocialSource(data as SocialSourceRow);
}

export async function updateSocialSourceInSupabase(
  id: string,
  changes: Partial<NewSocialSource> & {
    lastCheckedAt?: string;
    lastError?: string;
  },
) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const row = {
    ...(changes.accountName !== undefined
      ? { account_name: changes.accountName }
      : {}),
    ...(changes.category !== undefined ? { category: changes.category } : {}),
    ...(changes.handle !== undefined ? { handle: changes.handle } : {}),
    ...(changes.isActive !== undefined ? { is_active: changes.isActive } : {}),
    ...(changes.lastCheckedAt !== undefined
      ? { last_checked_at: changes.lastCheckedAt }
      : {}),
    ...(changes.lastError !== undefined
      ? { last_error: changes.lastError }
      : {}),
    ...(changes.memo !== undefined ? { memo: changes.memo } : {}),
    ...(changes.priority !== undefined ? { priority: changes.priority } : {}),
    ...(changes.profileUrl !== undefined
      ? { profile_url: changes.profileUrl }
      : {}),
    ...(changes.snsType !== undefined ? { sns_type: changes.snsType } : {}),
    ...(changes.sourceMode !== undefined
      ? { source_mode: changes.sourceMode }
      : {}),
  };
  const { data, error } = await supabase
    .from("social_sources")
    .update(row)
    .eq("id", id)
    .select(selectFields)
    .single();

  if (error) {
    throw error;
  }

  return toSocialSource(data as SocialSourceRow);
}
