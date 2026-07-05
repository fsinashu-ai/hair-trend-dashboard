import type { ConversionAnalysis } from "@/types/conversions";

export const conversionMockAnalysis: ConversionAnalysis = {
  analyzedAt: new Date().toISOString(),
  bottlenecks: [
    "アクセスがあるページでも、LINE相談や予約への行動が見えにくいページがあります。",
    "キーイベント名が分からないCSVだけだと、LINE・予約・電話などの内訳が判別しにくい状態です。",
  ],
  ctaSuggestions: [
    "髪のうねり・広がりが気になる方は、今の髪の状態をLINEでご相談ください。",
    "本気で髪を綺麗にしたい方は、まずはLINEからご相談ください。",
    "縮毛矯正や髪質改善で迷っている方へ。写真を送っていただくと、必要なケアを一緒に考えます。",
  ],
  goodSignals: [
    "GA4のキーイベントから、成果につながった流入元を確認できる状態になっています。",
    "Search Consoleと合わせることで、検索されているページと実際の行動を見比べられます。",
  ],
  model: "mock",
  monthlyTasks: [
    {
      pageUrl: "/",
      priority: "high",
      reason: "公式サイトは入口になりやすいため、LINE相談ボタンの位置と文言を確認します。",
      taskType: "cta_update",
      title: "公式サイトのLINE相談導線を見直す",
    },
  ],
  nextActions: [
    "GA4のイベントレポートCSVも取り込み、LINE・予約・電話クリックのイベント名を確認する",
    "成果の多い流入元と、成果がない流入元を見比べて投稿やブログの導線を調整する",
  ],
  priorityFixes: [
    {
      conversionRate: 0,
      key: "/",
      label: "公式サイト",
      pageUrl: "/",
      priority: "high",
      reason: "入口ページとして重要なため、LINE相談への導線を最優先で確認します。",
      recommendedAction: "ファーストビュー下、メニュー説明下、FAQ下にLINE相談CTAを置きます。",
      sessions: 0,
      target: "page",
      totalActions: 0,
      users: 0,
      views: 0,
    },
  ],
  provider: "mock",
  providerLabel: "モック分析",
  summary:
    "現在のGA4データでは、LINE相談・予約につながる入口を見つけることが優先です。まずは成果が出ている流入元を残しつつ、アクセスがあるのに行動が少ないページのCTAを改善しましょう。",
  trackingSuggestions: [
    "GA4でline_click、reservation_click、tel_clickをキーイベントに設定すると、分類精度が上がります。",
    "イベントCSVを月1回取り込むと、LINE・予約・電話の内訳を見やすくできます。",
  ],
};
