export type NavigationItem = {
  label: string;
  shortLabel: string;
  href: string;
};

export type MobileNavigationItem = NavigationItem & {
  matchPrefixes: string[];
};
