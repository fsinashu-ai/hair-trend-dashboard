import { getServerSupabaseClient } from "@/lib/supabase/serverClient";
import type {
  AdCreative,
  AdCreativeContent,
  AdCreativeInput,
  AdCreativeStatus,
} from "@/types/adCreative";

type AdCreativeRow = {
  id: string;
  campaign_id: string | null;
  platform: string;
  campaign_name: string;
  objective: string;
  target_area: string;
  target_audience: string;
  main_appeal: string;
  input_keywords: string[] | null;
  landing_page_url: string;
  budget_memo: string;
  current_issue: string;
  desired_cta: string;
  tone: string;
  generated_content: unknown;
  google_headlines: string[] | null;
  google_descriptions: string[] | null;
  instagram_copies: string[] | null;
  facebook_copies: string[] | null;
  cta_suggestions: string[] | null;
  lp_suggestions: string[] | null;
  negative_keywords: string[] | null;
  ab_test_ideas: string[] | null;
  caution_expressions: string[] | null;
  ai_provider: "gemini" | "mock" | "manual";
  ai_model: string;
  status: AdCreativeStatus;
  memo: string;
  created_at: string;
  updated_at: string;
};

const adCreativeSelectFields = [
  "id",
  "campaign_id",
  "platform",
  "campaign_name",
  "objective",
  "target_area",
  "target_audience",
  "main_appeal",
  "input_keywords",
  "landing_page_url",
  "budget_memo",
  "current_issue",
  "desired_cta",
  "tone",
  "generated_content",
  "google_headlines",
  "google_descriptions",
  "instagram_copies",
  "facebook_copies",
  "cta_suggestions",
  "lp_suggestions",
  "negative_keywords",
  "ab_test_ideas",
  "caution_expressions",
  "ai_provider",
  "ai_model",
  "status",
  "memo",
  "created_at",
  "updated_at",
].join(",");

function toStringList(value: string[] | null) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function toCreative(row: AdCreativeRow): AdCreative {
  const generatedContent =
    row.generated_content && typeof row.generated_content === "object"
      ? (row.generated_content as AdCreativeContent)
      : ({
          abTestIdeas: row.ab_test_ideas ?? [],
          campaignName: row.campaign_name,
          cautionExpressions: row.caution_expressions ?? [],
          ctaSuggestions: row.cta_suggestions ?? [],
          facebookAds: { bodyCopies: row.facebook_copies ?? [], descriptions: [], headlines: [] },
          googleSearchAds: {
            descriptions: row.google_descriptions ?? [],
            headlines: row.google_headlines ?? [],
            keywords: row.input_keywords ?? [],
            negativeKeywords: row.negative_keywords ?? [],
          },
          instagramAds: {
            bodyCopies: row.instagram_copies ?? [],
            imageIdeas: [],
            reelIdeas: [],
            shortCopies: [],
            storyCopies: [],
          },
          lpImprovementSuggestions: row.lp_suggestions ?? [],
          mainAppeal: row.main_appeal,
          objective: row.objective,
          platform: row.platform,
          recommendedMetrics: [],
          summary: "",
          targetArea: row.target_area,
          targetAudience: row.target_audience,
        } satisfies AdCreativeContent);

  return {
    abTestIdeas: toStringList(row.ab_test_ideas),
    aiModel: row.ai_model,
    aiProvider: row.ai_provider,
    budgetMemo: row.budget_memo,
    campaignId: row.campaign_id ?? "",
    campaignName: row.campaign_name,
    cautionExpressions: toStringList(row.caution_expressions),
    createdAt: row.created_at,
    ctaSuggestions: toStringList(row.cta_suggestions),
    currentIssue: row.current_issue,
    desiredCta: row.desired_cta,
    facebookCopies: toStringList(row.facebook_copies),
    generatedContent,
    googleDescriptions: toStringList(row.google_descriptions),
    googleHeadlines: toStringList(row.google_headlines),
    id: row.id,
    inputKeywords: toStringList(row.input_keywords),
    instagramCopies: toStringList(row.instagram_copies),
    landingPageUrl: row.landing_page_url,
    lpSuggestions: toStringList(row.lp_suggestions),
    mainAppeal: row.main_appeal,
    memo: row.memo,
    negativeKeywords: toStringList(row.negative_keywords),
    objective: row.objective,
    platform: row.platform,
    status: row.status,
    targetArea: row.target_area,
    targetAudience: row.target_audience,
    tone: row.tone,
    updatedAt: row.updated_at,
  };
}

function toCreativeRow(creative: AdCreative) {
  return {
    ab_test_ideas: creative.abTestIdeas,
    ai_model: creative.aiModel,
    ai_provider: creative.aiProvider,
    budget_memo: creative.budgetMemo,
    campaign_id: creative.campaignId || null,
    campaign_name: creative.campaignName,
    caution_expressions: creative.cautionExpressions,
    cta_suggestions: creative.ctaSuggestions,
    current_issue: creative.currentIssue,
    desired_cta: creative.desiredCta,
    facebook_copies: creative.facebookCopies,
    generated_content: creative.generatedContent,
    google_descriptions: creative.googleDescriptions,
    google_headlines: creative.googleHeadlines,
    input_keywords: creative.inputKeywords,
    instagram_copies: creative.instagramCopies,
    landing_page_url: creative.landingPageUrl,
    lp_suggestions: creative.lpSuggestions,
    main_appeal: creative.mainAppeal,
    memo: creative.memo,
    negative_keywords: creative.negativeKeywords,
    objective: creative.objective,
    platform: creative.platform,
    status: creative.status,
    target_area: creative.targetArea,
    target_audience: creative.targetAudience,
    tone: creative.tone,
    user_id: null,
  };
}

export async function fetchAdCreatives() {
  const supabase = getServerSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("ad_creatives")
    .select(adCreativeSelectFields)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  return ((data ?? []) as unknown as AdCreativeRow[]).map(toCreative);
}

export async function createAdCreative(creative: AdCreative) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("ad_creatives")
    .insert(toCreativeRow(creative))
    .select(adCreativeSelectFields)
    .single();

  if (error) throw error;
  return toCreative(data as unknown as AdCreativeRow);
}

export async function updateAdCreative({
  id,
  input,
}: {
  id: string;
  input: Partial<Pick<AdCreative, "memo" | "status"> & AdCreativeInput>;
}) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return null;

  const updateRow: Record<string, unknown> = {};
  if (input.memo !== undefined) updateRow.memo = input.memo;
  if (input.status !== undefined) updateRow.status = input.status;
  if (input.platform !== undefined) updateRow.platform = input.platform;
  if (input.campaignName !== undefined) updateRow.campaign_name = input.campaignName;
  if (input.objective !== undefined) updateRow.objective = input.objective;
  if (input.targetArea !== undefined) updateRow.target_area = input.targetArea;
  if (input.targetAudience !== undefined) updateRow.target_audience = input.targetAudience;
  if (input.mainAppeal !== undefined) updateRow.main_appeal = input.mainAppeal;
  if (input.inputKeywords !== undefined) updateRow.input_keywords = input.inputKeywords;
  if (input.landingPageUrl !== undefined) updateRow.landing_page_url = input.landingPageUrl;
  if (input.budgetMemo !== undefined) updateRow.budget_memo = input.budgetMemo;
  if (input.currentIssue !== undefined) updateRow.current_issue = input.currentIssue;
  if (input.desiredCta !== undefined) updateRow.desired_cta = input.desiredCta;
  if (input.tone !== undefined) updateRow.tone = input.tone;

  const { data, error } = await supabase
    .from("ad_creatives")
    .update(updateRow)
    .eq("id", id)
    .select(adCreativeSelectFields)
    .single();

  if (error) throw error;
  return toCreative(data as unknown as AdCreativeRow);
}

export async function deleteAdCreative(id: string) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase.from("ad_creatives").delete().eq("id", id);
  if (error) throw error;
  return true;
}
