export type TrendSource = {
  id?: string;
  name: string;
  categoryHint: string;
  type: "rss" | "manual-url";
  url: string;
  enabled: boolean;
  note: string;
};

export const trendSources: TrendSource[] = [
  {
    name: "ef.mayke`s 自社ブログ",
    categoryHint: "髪質改善",
    enabled: true,
    note: "RSSが取得できる場合だけ読み込みます。HTMLスクレイピングはしません。",
    type: "rss",
    url: "https://www.ef-mayke-s.com/blog-feed.xml",
  },
  {
    name: "ef.mayke`s ブログトップ",
    categoryHint: "自社サイト",
    enabled: true,
    note: "RSSがない場合の手動登録URLです。本文HTMLの自動取得はしません。",
    type: "manual-url",
    url: "https://www.ef-mayke-s.com/blog_toppage/",
  },
  {
    name: "美的 ヘア",
    categoryHint: "店販",
    enabled: true,
    note: "公開RSSが取得できる場合だけ読み込みます。",
    type: "rss",
    url: "https://www.biteki.com/feed",
  },
  {
    name: "hoyu 公式ニュース",
    categoryHint: "ヘアカラー",
    enabled: true,
    note: "メーカー公式ニュースのRSS候補です。失敗時はスキップします。",
    type: "rss",
    url: "https://www.hoyu.co.jp/news/rss.xml",
  },
  {
    name: "美容ディーラー新着情報",
    categoryHint: "美容ディーラー",
    enabled: false,
    note: "利用許可されたRSS URLが分かったら、urlを差し替えてenabledをtrueにします。",
    type: "rss",
    url: "https://example.com/feed.xml",
  },
];
