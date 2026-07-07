export type AdCreativeStatus =
  | "draft"
  | "reviewing"
  | "approved"
  | "used"
  | "archived";

export type AdCreativeInput = {
  platform: string;
  campaignId?: string;
  campaignName: string;
  objective: string;
  targetArea: string;
  targetAudience: string;
  mainAppeal: string;
  inputKeywords: string[];
  landingPageUrl: string;
  budgetMemo: string;
  currentIssue: string;
  desiredCta: string;
  tone: string;
  memo: string;
};

export type GoogleSearchAds = {
  headlines: string[];
  descriptions: string[];
  keywords: string[];
  negativeKeywords: string[];
};

export type InstagramAds = {
  shortCopies: string[];
  bodyCopies: string[];
  storyCopies: string[];
  reelIdeas: string[];
  imageIdeas: string[];
};

export type FacebookAds = {
  headlines: string[];
  bodyCopies: string[];
  descriptions: string[];
};

export type AdCreativeContent = {
  platform: string;
  campaignName: string;
  objective: string;
  targetArea: string;
  targetAudience: string;
  mainAppeal: string;
  googleSearchAds: GoogleSearchAds;
  instagramAds: InstagramAds;
  facebookAds: FacebookAds;
  ctaSuggestions: string[];
  lpImprovementSuggestions: string[];
  abTestIdeas: string[];
  cautionExpressions: string[];
  recommendedMetrics: string[];
  summary: string;
};

export type AdCreative = AdCreativeInput & {
  id: string;
  generatedContent: AdCreativeContent;
  googleHeadlines: string[];
  googleDescriptions: string[];
  instagramCopies: string[];
  facebookCopies: string[];
  ctaSuggestions: string[];
  lpSuggestions: string[];
  negativeKeywords: string[];
  abTestIdeas: string[];
  cautionExpressions: string[];
  aiProvider: "gemini" | "mock" | "manual";
  aiModel: string;
  status: AdCreativeStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdCreativeGenerateResponse = {
  creative: AdCreative;
  generationMode: "gemini" | "mock";
  providerLabel: string;
  notice: string;
};
