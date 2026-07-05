import type { ConversionDefinition } from "@/types/conversions";

export const conversionDefinitions: ConversionDefinition[] = [
  {
    description: "LINE相談、LINE予約、LINEリンクのクリックを成果として見ます。",
    examples: ["line_click", "LINE相談", "LINE予約"],
    id: "line",
    label: "LINEクリック",
    priority: "high",
  },
  {
    description: "予約ページ、予約ボタン、Web予約への遷移を成果として見ます。",
    examples: ["reservation_click", "予約ボタン", "booking"],
    id: "reservation",
    label: "予約クリック",
    priority: "high",
  },
  {
    description: "電話ボタンやtelリンクのクリックを成果として見ます。",
    examples: ["tel_click", "電話クリック", "phone"],
    id: "phone",
    label: "電話クリック",
    priority: "medium",
  },
  {
    description: "Instagramプロフィールや投稿への遷移を補助成果として見ます。",
    examples: ["instagram_click", "インスタ遷移", "sns_click"],
    id: "instagram",
    label: "Instagram遷移",
    priority: "medium",
  },
  {
    description: "Googleマップやアクセスページへの遷移を来店検討の行動として見ます。",
    examples: ["map_click", "Googleマップ", "地図"],
    id: "map",
    label: "地図・マップ遷移",
    priority: "medium",
  },
  {
    description: "問い合わせフォーム、相談フォームなどを成果として見ます。",
    examples: ["contact", "inquiry", "問い合わせ"],
    id: "inquiry",
    label: "問い合わせ",
    priority: "medium",
  },
  {
    description: "GA4でキーイベントに設定されている成果です。イベント名が分かるCSVを入れると分類精度が上がります。",
    examples: ["キーイベント", "コンバージョン"],
    id: "key_event",
    label: "キーイベント",
    priority: "low",
  },
];

export const conversionThresholds = {
  highTrafficNoActionSessions: 20,
  lowConversionRate: 0.02,
  lowConversionSessions: 30,
  topLimit: 12,
};
