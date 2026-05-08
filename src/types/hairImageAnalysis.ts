export type HairImageAnalysisResult = {
  estimatedCategory: string;
  styleClassification?: string;
  bobShortLayerJudgement?: string;
  grayBlendingJudgement?: string;
  confidence: string;
  features: string[];
  glossDescription?: string;
  tags: string[];
  snsDescription: string;
  reelDescription?: string;
  menuSuggestion: string;
  customerExplanation: string;
  caution: string;
};

export type UploadedHairImage = {
  bucket: string;
  path: string;
  publicUrl: string;
};
