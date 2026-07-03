import type { NavigationItem } from "@/types/navigation";

export const navigationItems: NavigationItem[] = [
  { label: "ホーム", shortLabel: "ホーム", href: "/" },
  { label: "トレンド一覧", shortLabel: "トレンド", href: "/trends" },
  { label: "取得元管理", shortLabel: "取得元", href: "/trend-sources" },
  { label: "SNS情報取得", shortLabel: "SNS", href: "/social-sources" },
  { label: "SNS受信箱", shortLabel: "受信箱", href: "/social-inbox" },
  { label: "ブログ管理", shortLabel: "ブログ", href: "/blog" },
  { label: "既存ブログ", shortLabel: "既存ブログ", href: "/blog/articles" },
  { label: "SEO管理", shortLabel: "SEO", href: "/seo" },
  { label: "広告管理", shortLabel: "広告", href: "/ads" },
  { label: "キーワード管理", shortLabel: "キーワード", href: "/keywords" },
  { label: "投稿ネタ生成", shortLabel: "投稿生成", href: "/post-generator" },
  { label: "画像分析", shortLabel: "画像", href: "/image-analysis" },
  { label: "設定", shortLabel: "設定", href: "/settings" },
];
