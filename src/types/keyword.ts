export type KeywordPriority = "高" | "中" | "低";

export type Keyword = {
  id: string;
  name: string;
  category: string;
  memo: string;
  useCount: number;
  priority: KeywordPriority;
};
