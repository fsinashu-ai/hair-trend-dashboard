import type {
  DashboardMetric,
  FolderGuideItem,
  QuickAction,
} from "@/types/dashboard";
import { dummyGeneratedPosts } from "@/data/dummyGeneratedPosts";
import { dummyKeywords } from "@/data/dummyKeywords";
import { dummyTrends } from "@/data/dummyTrends";

export const dashboardMetrics: DashboardMetric[] = [
  { label: "登録トレンド", value: String(dummyTrends.length) },
  { label: "管理キーワード", value: String(dummyKeywords.length) },
  { label: "生成済み投稿案", value: String(dummyGeneratedPosts.length) },
];

export const quickActions: QuickAction[] = [
  { label: "トレンドを見る", href: "/trends", variant: "primary" },
  { label: "投稿ネタを作る", href: "/post-generator", variant: "secondary" },
];

export const folderGuide: FolderGuideItem[] = [
  {
    path: "src/app",
    description: "ページを置く場所です。URLごとにフォルダを作り、page.tsxを編集します。",
  },
  {
    path: "src/components",
    description: "ヘッダー、サイドバー、ボタンなどの再利用する見た目の部品を置きます。",
  },
  {
    path: "src/data",
    description: "MVP用のダミーデータを置きます。最初はここを書き換えるだけで表示を変えられます。",
  },
  {
    path: "src/types",
    description: "TypeScriptの型を置きます。データの形を先に決めて、編集ミスを減らします。",
  },
];
