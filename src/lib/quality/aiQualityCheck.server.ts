import {
  GeminiServiceError,
  generateGeminiJson,
  isGeminiConfigured,
} from "@/lib/ai/server";
import { getSalonPromptContext, salonProfile } from "@/lib/salonProfile";
import type {
  QualityCheckRequest,
  QualityCheckResult,
  QualityContentType,
  QualityIssue,
  QualityIssueCategory,
  QualityIssueSeverity,
  QualityVerdict,
} from "@/types/qualityCheck";

const maxContentCharacters = 16_000;

const categoryLabels: Record<QualityIssueCategory, string> = {
  absolute_claim: "断定表現",
  exaggerated_effect: "過剰な効果表現",
  fake_review: "実在確認が必要な口コミ・事例",
  medical_expression: "医療っぽい表現",
  mixed_content: "他記事・他業種との内容混在",
  nonexistent_menu: "実在しない可能性があるメニュー",
  nonexistent_price: "実在確認が必要な価格",
  salon_mismatch: "店舗情報とのズレ",
};

const qualitySchema = {
  type: "object",
  properties: {
    verdict: { type: "string" },
    summary: { type: "string" },
    safePoints: { type: "array", items: { type: "string" } },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string" },
          label: { type: "string" },
          severity: { type: "string" },
          excerpt: { type: "string" },
          reason: { type: "string" },
          suggestion: { type: "string" },
        },
        required: [
          "category",
          "label",
          "severity",
          "excerpt",
          "reason",
          "suggestion",
        ],
      },
    },
  },
  required: ["verdict", "summary", "safePoints", "issues"],
};

const rulePatterns: Array<{
  category: QualityIssueCategory;
  patterns: RegExp[];
  reason: string;
  severity: QualityIssueSeverity;
  suggestion: string;
}> = [
  {
    category: "absolute_claim",
    patterns: [
      /必ず(?:改善|綺麗|きれい|治る|変わる)/g,
      /絶対(?:に)?(?:改善|綺麗|きれい|治る|失敗しない)/g,
      /100\s?％(?:改善|効果|満足)/g,
      /一度で(?:完全に)?(?:改善|綺麗|きれい)/g,
      /完全(?:改善|解決|保証)/g,
    ],
    reason: "効果を保証するように読める断定表現です。",
    severity: "high",
    suggestion:
      "「髪の状態に合わせて提案します」「個人差があります」など、確認と提案の表現に直してください。",
  },
  {
    category: "exaggerated_effect",
    patterns: [
      /地域No\.?1/g,
      /松江(?:市)?No\.?1/g,
      /業界(?:最高|最強)/g,
      /劇的(?:に)?(?:改善|変化)/g,
      /誰でも(?:必ず)?/g,
      /失敗しない/g,
    ],
    reason: "根拠の提示が難しい強い優位性・効果表現です。",
    severity: "high",
    suggestion:
      "根拠がない順位表現や強すぎる効果表現を避け、施術前の確認やカウンセリングを中心にしてください。",
  },
  {
    category: "medical_expression",
    patterns: [
      /治療/g,
      /治癒/g,
      /治る/g,
      /診断/g,
      /処方/g,
      /医療/g,
      /病気/g,
      /症状/g,
      /薬/g,
      /クリニック/g,
    ],
    reason: "美容室の発信として医療行為のように見える可能性があります。",
    severity: "high",
    suggestion:
      "「髪の状態を見る」「扱いやすさを目指す」「美容室でできるケア」などの美容室表現に直してください。",
  },
  {
    category: "nonexistent_price",
    patterns: [
      /(?:¥|￥)\s?[0-9,]+/g,
      /[0-9,]+\s?円/g,
      /税込\s?[0-9,]+/g,
      /初回限定/g,
      /キャンペーン価格/g,
      /無料相談/g,
    ],
    reason: "価格やキャンペーンは実在確認が必要です。",
    severity: "medium",
    suggestion:
      "実際の価格表・キャンペーンと一致するか確認し、不明な場合は価格を削除してください。",
  },
  {
    category: "fake_review",
    patterns: [
      /お客様の声/g,
      /口コミ/g,
      /実際のお客様/g,
      /喜びの声/g,
      /「[^」]{8,}」(?:と|という)(?:声|口コミ|感想)/g,
    ],
    reason: "口コミや体験談は実在確認が必要です。",
    severity: "medium",
    suggestion:
      "本人許可のある実在口コミだけを使い、AIが作った口コミや施術事例は削除してください。",
  },
  {
    category: "nonexistent_menu",
    patterns: [
      /脱毛/g,
      /まつげ/g,
      /マツエク/g,
      /ネイル/g,
      /ホワイトニング/g,
      /美容皮膚科/g,
      /育毛治療/g,
      /薄毛治療/g,
    ],
    reason: "ef.mayke`sの主要メニュー・得意分野から外れる可能性があります。",
    severity: "medium",
    suggestion:
      "実際に提供していないメニューは削除し、髪質改善・縮毛矯正・ストレート施術に寄せてください。",
  },
  {
    category: "salon_mismatch",
    patterns: [
      /予約なし/g,
      /飛び込み(?:来店)?歓迎/g,
      /年中無休/g,
      /24時間営業/g,
      /大型サロン/g,
      /全国展開/g,
      /カラー専門/g,
      /メンズ専門/g,
    ],
    reason: "1日3組限定・完全予約制という店舗情報とズレる可能性があります。",
    severity: "medium",
    suggestion:
      "完全予約制、丁寧なカウンセリング、1日3組限定の方針と矛盾しない表現に直してください。",
  },
  {
    category: "mixed_content",
    patterns: [
      /美容クリニック/g,
      /エステサロン/g,
      /整体/g,
      /歯科/g,
      /表参道/g,
      /銀座/g,
      /大阪/g,
      /名古屋/g,
      /福岡/g,
    ],
    reason: "他業種・他地域の記事内容が混ざっている可能性があります。",
    severity: "low",
    suggestion:
      "松江市周辺の美容室として自然な内容か、他記事から混ざった文章がないか確認してください。",
  },
];

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeContentType(value: unknown): QualityContentType {
  return value === "blog" ||
    value === "ad" ||
    value === "report" ||
    value === "other"
    ? value
    : "other";
}

export function sanitizeQualityCheckRequest(
  value: unknown,
): QualityCheckRequest {
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    content: safeString(record.content).slice(0, maxContentCharacters),
    contentType: normalizeContentType(record.contentType),
    sourceLabel: safeString(record.sourceLabel, "手動チェック").slice(0, 120),
    title: safeString(record.title).slice(0, 160),
  };
}

function createExcerpt(content: string, index: number, length: number) {
  const start = Math.max(0, index - 24);
  const end = Math.min(content.length, index + length + 24);
  return content.slice(start, end).replace(/\s+/g, " ").trim();
}

function uniqueIssueKey(issue: QualityIssue) {
  return `${issue.category}:${issue.excerpt}:${issue.reason}`;
}

function addUniqueIssue(issues: QualityIssue[], issue: QualityIssue) {
  const key = uniqueIssueKey(issue);
  if (!issues.some((current) => uniqueIssueKey(current) === key)) {
    issues.push(issue);
  }
}

function detectRuleIssues(request: QualityCheckRequest) {
  const issues: QualityIssue[] = [];
  const content = [request.title, request.content].filter(Boolean).join("\n\n");

  for (const rule of rulePatterns) {
    for (const pattern of rule.patterns) {
      for (const match of content.matchAll(pattern)) {
        const matchedText = match[0] ?? "";
        const index = match.index ?? 0;

        addUniqueIssue(issues, {
          category: rule.category,
          excerpt: createExcerpt(content, index, matchedText.length),
          label: categoryLabels[rule.category],
          reason: rule.reason,
          severity: rule.severity,
          suggestion: rule.suggestion,
        });
      }
    }
  }

  return issues.slice(0, 24);
}

function normalizeSeverity(value: unknown): QualityIssueSeverity {
  return value === "high" || value === "medium" || value === "low"
    ? value
    : "medium";
}

function normalizeCategory(value: unknown): QualityIssueCategory {
  return typeof value === "string" && value in categoryLabels
    ? (value as QualityIssueCategory)
    : "salon_mismatch";
}

function normalizeVerdict(value: unknown, issues: QualityIssue[]): QualityVerdict {
  if (value === "ok" || value === "needs_review" || value === "blocked") {
    return value;
  }
  if (issues.some((issue) => issue.severity === "high")) return "blocked";
  return issues.length > 0 ? "needs_review" : "ok";
}

function normalizeStringList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeGeminiResult(
  value: unknown,
  request: QualityCheckRequest,
  fallbackIssues: QualityIssue[],
): QualityCheckResult {
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const geminiIssues = Array.isArray(record.issues) ? record.issues : [];
  const issues = [...fallbackIssues];

  for (const item of geminiIssues) {
    const issue =
      item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const category = normalizeCategory(issue.category);
    addUniqueIssue(issues, {
      category,
      excerpt: safeString(issue.excerpt).slice(0, 220),
      label: safeString(issue.label, categoryLabels[category]).slice(0, 80),
      reason: safeString(issue.reason, "人の確認が必要です。").slice(0, 240),
      severity: normalizeSeverity(issue.severity),
      suggestion: safeString(
        issue.suggestion,
        "表現を弱め、実在確認できる内容だけにしてください。",
      ).slice(0, 260),
    });
  }

  const verdict = normalizeVerdict(record.verdict, issues);

  return {
    checkedBy: "gemini",
    contentType: request.contentType,
    issues: issues.slice(0, 24),
    safePoints: normalizeStringList(record.safePoints, [
      "公開前に人が確認する前提でチェックしました。",
    ]),
    summary: safeString(
      record.summary,
      issues.length > 0
        ? "公開前に修正・確認したい表現があります。"
        : "大きな注意点は見つかりませんでした。",
    ).slice(0, 500),
    verdict,
  };
}

function createRuleResult(request: QualityCheckRequest): QualityCheckResult {
  const issues = detectRuleIssues(request);
  const verdict = normalizeVerdict(undefined, issues);

  return {
    checkedBy: "rule",
    contentType: request.contentType,
    issues,
    safePoints:
      issues.length === 0
        ? [
            "断定表現、医療っぽい表現、価格、口コミ、店舗情報のズレをルールで確認しました。",
          ]
        : ["検出された表現を修正すれば、公開前チェックを進めやすくなります。"],
    summary:
      issues.length === 0
        ? "ルールベースでは大きな注意表現は見つかりませんでした。最終公開前は人が内容を確認してください。"
        : "ルールベースで注意したい表現が見つかりました。該当箇所を確認してください。",
    verdict,
  };
}

export async function checkAiQuality(
  request: QualityCheckRequest,
): Promise<QualityCheckResult> {
  const ruleResult = createRuleResult(request);

  if (!request.content.trim()) {
    return {
      ...ruleResult,
      summary: "チェックする本文を入力してください。",
      verdict: "needs_review",
    };
  }

  if (!isGeminiConfigured()) {
    return ruleResult;
  }

  try {
    const result = await generateGeminiJson<Record<string, unknown>>({
      feature: "ai-quality-check",
      maxOutputTokens: 2800,
      responseJsonSchema: qualitySchema,
      systemInstruction: [
        "あなたは美容室ef.mayke`sのAI生成物を公開前チェックする品質管理担当者です。",
        getSalonPromptContext(),
        "ブログ、広告文、レポートに、実在しないメニュー、実在しない価格、実在しない口コミ、過剰な効果表現、医療行為のような表現、断定表現、他記事との内容混在、店舗情報とのズレがないか確認してください。",
        "問題がない場合も、断定せず「大きな注意点は見つかりません」のように返してください。",
        "広告やブログの公開、WordPress投稿、広告出稿、予算変更は行わず、確認結果だけを返してください。",
      ].join("\n\n"),
      prompt: [
        `チェック対象: ${request.contentType}`,
        `タイトル: ${request.title || "未入力"}`,
        `出典メモ: ${request.sourceLabel || "未入力"}`,
        `店舗名: ${salonProfile.name}`,
        `得意分野: ${salonProfile.specialties.join("、")}`,
        "本文:",
        request.content,
        "必ずJSONのみで返してください。categoryは nonexistent_menu / nonexistent_price / fake_review / exaggerated_effect / medical_expression / absolute_claim / mixed_content / salon_mismatch のいずれかです。",
        "severityは high / medium / low、verdictは ok / needs_review / blocked のいずれかです。",
      ].join("\n\n"),
    });

    return normalizeGeminiResult(result.value, request, ruleResult.issues);
  } catch (error) {
    console.warn("[quality-check] Gemini fallback", {
      errorType: error instanceof GeminiServiceError ? error.code : "unknown",
    });
    return ruleResult;
  }
}
