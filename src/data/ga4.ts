import type { Ga4Analysis, Ga4Dataset, Ga4Import, Ga4Row } from "@/types/ga4";

const now = new Date().toISOString();

export const dummyGa4Rows: Ga4Row[] = [
  {
    averageEngagementSeconds: 58,
    channelGroup: "Organic Search",
    conversions: 3,
    deviceCategory: "mobile",
    engagementRate: 0.62,
    eventName: "",
    landingPage: "/",
    lineClicks: 5,
    pageTitle: "ef.mayke`s 公式サイト",
    recordDate: "",
    reservationClicks: 2,
    sessions: 94,
    sourceMedium: "google / organic",
    users: 81,
    views: 188,
  },
  {
    averageEngagementSeconds: 42,
    channelGroup: "Organic Search",
    conversions: 0,
    deviceCategory: "mobile",
    engagementRate: 0.38,
    eventName: "",
    landingPage: "/single-post/tiritukibibiri-care/",
    lineClicks: 0,
    pageTitle: "縮毛矯正で傷んだ髪・ビビリ毛のケア解説",
    recordDate: "",
    reservationClicks: 0,
    sessions: 31,
    sourceMedium: "google / organic",
    users: 27,
    views: 76,
  },
  {
    averageEngagementSeconds: 49,
    channelGroup: "Organic Search",
    conversions: 1,
    deviceCategory: "mobile",
    engagementRate: 0.51,
    eventName: "",
    landingPage: "/single-post/siragazome-osharezome/",
    lineClicks: 1,
    pageTitle: "白髪染めとダメージ記事",
    recordDate: "",
    reservationClicks: 0,
    sessions: 24,
    sourceMedium: "google / organic",
    users: 21,
    views: 58,
  },
];

export const ga4MockAnalysis: Ga4Analysis = {
  analyzedAt: now,
  contentIdeas: [
    {
      reason:
        "検索流入後にLINE相談へつなげるため、悩み別に入口記事を増やします。",
      targetKeyword: "松江 縮毛矯正 ダメージ",
      title: "縮毛矯正で傷みが気になる方へ｜松江市で相談できる髪質改善",
    },
  ],
  conversionIdeas: [
    "ビビリ毛・縮毛矯正の記事の上部とFAQ下にLINE相談ボタンを追加します。",
    "髪質改善の入口ページから公式サイトのカウンセリング説明へ内部リンクします。",
  ],
  lineCtaSuggestions: [
    "本気で髪を綺麗にしたい方は、まずはLINEからご相談ください。",
    "現在の髪の状態が不安な方は、写真を添えてLINEでご相談ください。",
  ],
  model: "mock",
  monthlyTasks: [
    {
      pageUrl: "/single-post/tiritukibibiri-care/",
      priority: "high",
      reason:
        "閲覧はあるのにLINEクリックがないため、相談導線と導入文を見直します。",
      taskType: "conversion_improvement",
      title: "ビビリ毛記事のLINE相談導線を改善する",
    },
  ],
  negativePoints: [
    "閲覧がある記事でもLINEクリックや予約導線につながっていないページがあります。",
    "スマホ流入が多いため、記事上部のCTAが弱いと離脱しやすい状態です。",
  ],
  nextActions: [
    "上位閲覧ページのファーストビュー下にLINE相談導線を追加する",
    "Search Consoleで表示されているページとGA4の行動データを照合する",
  ],
  positivePoints: [
    "公式サイトは検索流入からLINE相談につながる入口として機能しています。",
    "髪質改善・縮毛矯正系の記事に改善余地のあるアクセスがあります。",
  ],
  priorityPages: [
    {
      pageUrl: "/single-post/tiritukibibiri-care/",
      priority: "high",
      reason: "閲覧はある一方でLINEクリックがないため、改善の優先度が高いです。",
      recommendedAction:
        "導入文、FAQ、記事末尾にLINE相談CTAを追加し、悩み別の相談文を入れます。",
    },
  ],
  provider: "mock",
  providerLabel: "モック分析",
  summary:
    "GA4データを見ると、髪質改善・縮毛矯正の記事からLINE相談へつなげる導線改善が優先です。特にスマホ閲覧を前提に、記事上部、FAQ下、記事末尾のCTAを見直すとよさそうです。",
};

const dummyImport: Ga4Import = {
  comparisonLabel: "前月",
  contentHash: "dummy-ga4",
  createdAt: now,
  errorMessage: "",
  excludedRowCount: 0,
  fileName: "ga4-demo.csv",
  id: "ga4-demo",
  memo: "動作確認用のGA4ダミーデータです。",
  metrics: {
    averageEngagementSeconds: 51.9,
    conversions: 4,
    engagementRate: 0.55,
    landingPageCount: 3,
    lineClicks: 6,
    reservationClicks: 2,
    sessions: 149,
    sourceCount: 1,
    users: 129,
    views: 322,
  },
  periodEnd: "2026-07-04",
  periodStart: "2026-06-01",
  propertyName: "ef-mayke-s.com",
  reportMonth: "2026-07-01",
  rowCount: dummyGa4Rows.length,
  status: "analyzed",
  updatedAt: now,
  warningCount: 0,
};

export const dummyGa4Dataset: Ga4Dataset = {
  analysesByImport: {
    [dummyImport.id]: ga4MockAnalysis,
  },
  imports: [dummyImport],
  rowsByImport: {
    [dummyImport.id]: dummyGa4Rows,
  },
};
