export type DashboardMetric = {
  label: string;
  value: string;
};

export type QuickAction = {
  label: string;
  href: string;
  variant: "primary" | "secondary";
};

export type TrendItem = {
  id: string;
  title: string;
  category: string;
  heat: "高" | "中" | "低";
  summary: string;
};

export type FolderGuideItem = {
  path: string;
  description: string;
};
