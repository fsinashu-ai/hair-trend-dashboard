export type NavigationItem = {
  label: string;
  shortLabel: string;
  href: string;
};

export type MobileNavigationItem = NavigationItem & {
  icon: "home" | "collect" | "content" | "analysis" | "more";
  matchPrefixes: string[];
};
