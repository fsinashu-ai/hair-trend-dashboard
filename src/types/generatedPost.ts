export type GeneratedPost = {
  id: string;
  theme: string;
  postType: string;
  tone: string;
  content: string;
  usedKeywords: string[];
  hashtags?: string[];
  createdAt: string;
};
