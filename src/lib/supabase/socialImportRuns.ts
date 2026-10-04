import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  NewSocialImportRun,
  SocialImportRun,
  SocialImportRunUpdate,
} from "@/types/socialImport";

function toRow(input: NewSocialImportRun) {
  return {
    actor_id: input.actorId || null,
    actor_run_id: input.actorRunId || null,
    ai_classified_count: input.aiClassifiedCount,
    dataset_id: input.datasetId || null,
    duplicate_count: input.duplicateCount,
    error_count: input.errorCount,
    error_summary: input.errorSummary || null,
    finished_at: input.finishedAt || null,
    idempotency_key: input.idempotencyKey || null,
    normalized_count: input.normalizedCount,
    provider: input.provider,
    received_count: input.receivedCount,
    request_id: input.requestId || null,
    saved_count: input.savedCount,
    skipped_count: input.skippedCount,
    source_matched_count: input.sourceMatchedCount,
    source_name: input.sourceName,
    started_at: input.startedAt,
    status: input.status,
  };
}

function toSocialImportRun(row: Record<string, unknown>): SocialImportRun {
  const asNumber = (key: string) =>
    typeof row[key] === "number" ? row[key] : Number(row[key] ?? 0);
  const asString = (key: string) =>
    typeof row[key] === "string" && row[key] ? row[key] : undefined;

  return {
    actorId: asString("actor_id"),
    actorRunId: asString("actor_run_id"),
    aiClassifiedCount: asNumber("ai_classified_count"),
    datasetId: asString("dataset_id"),
    duplicateCount: asNumber("duplicate_count"),
    errorCount: asNumber("error_count"),
    errorSummary: asString("error_summary"),
    finishedAt: asString("finished_at"),
    id: String(row.id),
    idempotencyKey: asString("idempotency_key"),
    normalizedCount: asNumber("normalized_count"),
    provider: String(row.provider ?? "Apify"),
    receivedCount: asNumber("received_count"),
    requestId: asString("request_id"),
    savedCount: asNumber("saved_count"),
    skippedCount: asNumber("skipped_count"),
    sourceMatchedCount: asNumber("source_matched_count"),
    sourceName: String(row.source_name ?? "Apify"),
    startedAt: String(row.started_at ?? ""),
    status: (row.status ?? "running") as SocialImportRun["status"],
  };
}

export async function createSocialImportRun(input: NewSocialImportRun) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("social_import_runs")
    .insert(toRow(input))
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return toSocialImportRun(data as Record<string, unknown>);
}

export async function findSocialImportRunByIdempotency(
  provider: string,
  idempotencyKey: string,
) {
  const supabase = getSupabaseClient();

  if (!supabase || !idempotencyKey) {
    return null;
  }

  const { data, error } = await supabase
    .from("social_import_runs")
    .select("*")
    .eq("provider", provider)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? toSocialImportRun(data as Record<string, unknown>)
    : null;
}

export async function updateSocialImportRun(
  id: string,
  changes: SocialImportRunUpdate,
) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const row = Object.fromEntries(
    [
      ...Object.entries(changes),
      ["updatedAt", new Date().toISOString()],
    ].map(([key, value]) => [
      key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
      value,
    ]),
  );
  const { data, error } = await supabase
    .from("social_import_runs")
    .update(row)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return toSocialImportRun(data as Record<string, unknown>);
}

export async function fetchSocialImportRunsFromSupabase(limit = 8) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("social_import_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(Math.max(1, Math.min(50, limit)));

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) =>
    toSocialImportRun(row as Record<string, unknown>),
  );
}
