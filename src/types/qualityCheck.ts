export type QualityContentType = "blog" | "ad" | "report" | "other";

export type QualityIssueCategory =
  | "nonexistent_menu"
  | "nonexistent_price"
  | "fake_review"
  | "exaggerated_effect"
  | "medical_expression"
  | "absolute_claim"
  | "mixed_content"
  | "salon_mismatch";

export type QualityIssueSeverity = "high" | "medium" | "low";

export type QualityVerdict = "ok" | "needs_review" | "blocked";

export type QualityIssue = {
  category: QualityIssueCategory;
  label: string;
  severity: QualityIssueSeverity;
  excerpt: string;
  reason: string;
  suggestion: string;
};

export type QualityCheckRequest = {
  contentType: QualityContentType;
  title: string;
  content: string;
  sourceLabel: string;
};

export type QualityCheckResult = {
  checkedBy: "gemini" | "rule";
  contentType: QualityContentType;
  issues: QualityIssue[];
  safePoints: string[];
  summary: string;
  verdict: QualityVerdict;
};
