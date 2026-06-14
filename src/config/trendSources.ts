import type {
  TrendSourcePriority,
  TrendSourceRssStatus,
  TrendSourceType,
} from "@/types/trendSource";

export type TrendSource = {
  id?: string;
  name: string;
  categoryHint: string;
  sourceType: TrendSourceType;
  priority: TrendSourcePriority;
  type: "rss" | "manual-url";
  url: string;
  rssUrl?: string;
  rssStatus?: TrendSourceRssStatus;
  failureCount?: number;
  enabled: boolean;
  note: string;
};

type InitialTrendSource = Omit<
  TrendSource,
  "enabled" | "type" | "rssStatus" | "failureCount"
>;

const source = (value: InitialTrendSource): TrendSource => ({
  ...value,
  enabled: value.priority === "high",
  failureCount: 0,
  rssStatus: value.rssUrl ? "available" : "unchecked",
  type: value.rssUrl ? "rss" : "manual-url",
});

export const trendSourceTypes: TrendSourceType[] = [
  "RSS",
  "公式サイト",
  "自社サイト",
  "メーカー",
  "美容ディーラー",
  "美容メディア",
];

export const trendSourcePriorities: TrendSourcePriority[] = [
  "high",
  "medium",
  "low",
];

export const trendSourceCategories = [
  "自社サイト",
  "美容業界ニュース",
  "ヘアスタイル・トレンド",
  "サロン経営・市場データ",
  "メーカー",
  "海外トレンド",
] as const;

export const trendSources: TrendSource[] = [
  source({
    name: "ef.mayke`s 自社ブログ",
    categoryHint: "自社サイト",
    sourceType: "自社サイト",
    priority: "high",
    note:
      "髪質改善・縮毛矯正・くせ毛・パサつき改善の自社発信を最優先で確認します。",
    url: "https://www.ef-mayke-s.com/blog_toppage/",
    rssUrl: "https://www.ef-mayke-s.com/blog-feed.xml",
  }),
  source({
    name: "Beautopia",
    categoryHint: "美容業界ニュース",
    sourceType: "美容メディア",
    priority: "high",
    note: "美容業界のニュース、サロン動向、メーカー情報の確認に使います。",
    url: "https://www.beautopia.jp/",
    rssUrl: "https://www.beautopia.jp/feed/",
  }),
  source({
    name: "KAMIU",
    categoryHint: "美容業界ニュース",
    sourceType: "美容メディア",
    priority: "high",
    note: "美容師・美容室向けの業界ニュースや経営情報を確認します。",
    url: "https://kamiu.jp/",
    rssUrl: "https://kamiu.jp/feed/",
  }),
  source({
    name: "BeautyTech.jp",
    categoryHint: "美容業界ニュース",
    sourceType: "美容メディア",
    priority: "medium",
    note: "美容業界のテクノロジー、DX、顧客体験の動向を確認します。",
    url: "https://beautytech.jp/",
  }),
  source({
    name: "WWDJAPAN BEAUTY",
    categoryHint: "美容業界ニュース",
    sourceType: "美容メディア",
    priority: "high",
    note: "ビューティー市場、ブランド、商品トレンドの確認に使います。",
    url: "https://www.wwdjapan.com/category/beauty",
    rssUrl: "https://www.wwdjapan.com/category/beauty/feed",
  }),
  source({
    name: "FASHIONSNAP BEAUTY",
    categoryHint: "美容業界ニュース",
    sourceType: "美容メディア",
    priority: "medium",
    note: "美容・ファッション業界の新商品や市場ニュースを確認します。",
    url: "https://www.fashionsnap.com/beauty/",
    rssUrl: "https://www.fashionsnap.com/rss.xml",
  }),
  source({
    name: "PR TIMES 美容サロン",
    categoryHint: "美容業界ニュース",
    sourceType: "美容メディア",
    priority: "low",
    note:
      "美容サロン関連の公式発表を確認します。RSSが見つからない場合は手動参照のみです。",
    url: "https://prtimes.jp/topics/keywords/美容サロン",
  }),
  source({
    name: "HOT PEPPER Beauty Magazine",
    categoryHint: "ヘアスタイル・トレンド",
    sourceType: "美容メディア",
    priority: "high",
    note: "一般のお客様が検索している髪型やヘアケア特集を確認します。",
    url: "https://beauty.hotpepper.jp/magazine/",
  }),
  source({
    name: "HOT PEPPER Beauty ヘアカタログ",
    categoryHint: "ヘアスタイル・トレンド",
    sourceType: "美容メディア",
    priority: "high",
    note: "ショート、ボブ、レイヤーなど国内の人気スタイルを確認します。",
    url: "https://beauty.hotpepper.jp/catalog/",
  }),
  source({
    name: "MAQUIA ヘアカタログ",
    categoryHint: "ヘアスタイル・トレンド",
    sourceType: "美容メディア",
    priority: "medium",
    note: "大人女性向けのヘアスタイル、カラー、ケア提案を確認します。",
    url: "https://maquia.hpplus.jp/catalog/hair/",
  }),
  source({
    name: "minimo room",
    categoryHint: "ヘアスタイル・トレンド",
    sourceType: "美容メディア",
    priority: "medium",
    note: "若年層を含むヘアデザインや美容師発信の傾向を確認します。",
    url: "https://minimodel.jp/room/hair",
  }),
  source({
    name: "美的 ヘア",
    categoryHint: "ヘアスタイル・トレンド",
    sourceType: "美容メディア",
    priority: "high",
    note: "大人女性向けヘア、髪悩み、ホームケア、店販提案に活用します。",
    url: "https://www.biteki.com/hair",
    rssUrl: "https://www.biteki.com/feed/",
  }),
  source({
    name: "FASHIONSNAP ヘアカタログ",
    categoryHint: "ヘアスタイル・トレンド",
    sourceType: "美容メディア",
    priority: "medium",
    note: "感度の高いヘアデザインやビューティービジュアルを確認します。",
    url: "https://www.fashionsnap.com/beauty/inside/hair-catalogue/",
    rssUrl: "https://www.fashionsnap.com/rss.xml",
  }),
  source({
    name: "HOT PEPPER Beauty Academy",
    categoryHint: "サロン経営・市場データ",
    sourceType: "公式サイト",
    priority: "high",
    note: "美容室経営、集客、顧客動向、スタッフ教育の参考にします。",
    url: "https://hba.beauty.hotpepper.jp/",
    rssUrl: "https://hba.beauty.hotpepper.jp/feed/",
  }),
  source({
    name: "美容センサス",
    categoryHint: "サロン経営・市場データ",
    sourceType: "公式サイト",
    priority: "high",
    note: "年代別の美容行動や市場データを松江市の集客提案に活用します。",
    url: "https://hba.beauty.hotpepper.jp/search/search_cat/census/",
    rssUrl: "https://hba.beauty.hotpepper.jp/search/search_cat/census/feed/",
  }),
  source({
    name: "アリミノ",
    categoryHint: "メーカー",
    sourceType: "メーカー",
    priority: "medium",
    note: "カラー、パーマ、スタイリング、サロン向け新商品の情報を確認します。",
    url: "https://www.arimino.co.jp/",
    rssUrl: "https://www.arimino.co.jp/feed/",
  }),
  source({
    name: "ナプラ",
    categoryHint: "メーカー",
    sourceType: "メーカー",
    priority: "medium",
    note: "ヘアカラー、ケア、スタイリング商品の提案材料を確認します。",
    url: "https://www.napla.co.jp/",
    rssUrl: "https://www.napla.co.jp/feed/",
  }),
  source({
    name: "フィヨーレ",
    categoryHint: "メーカー",
    sourceType: "メーカー",
    priority: "medium",
    note: "カラー、ヘアケア、サロン専売品の新着情報を確認します。",
    url: "https://www.fiole.jp/",
  }),
  source({
    name: "ミルボン",
    categoryHint: "メーカー",
    sourceType: "メーカー",
    priority: "high",
    note: "髪質改善、ホームケア、店販、サロン市場情報を確認します。",
    url: "https://www.milbon.co.jp/",
  }),
  source({
    name: "デミ コスメティクス",
    categoryHint: "メーカー",
    sourceType: "メーカー",
    priority: "medium",
    note: "ヘアケア、頭皮ケア、カラー、店販提案の情報を確認します。",
    url: "https://www.demi.nicca.co.jp/",
  }),
  source({
    name: "ルベル",
    categoryHint: "メーカー",
    sourceType: "メーカー",
    priority: "medium",
    note: "サロン向けヘアケア、カラー、教育情報を確認します。",
    url: "https://www.lebel.co.jp/",
    rssUrl: "https://www.lebel.co.jp/feed/",
  }),
  source({
    name: "資生堂プロフェッショナル",
    categoryHint: "メーカー",
    sourceType: "メーカー",
    priority: "high",
    note: "大人女性向けケア、カラー、サロン専売商品の情報を確認します。",
    url: "https://www.shiseido-professional.com/ja",
  }),
  source({
    name: "hoyu 公式ニュース",
    categoryHint: "メーカー",
    sourceType: "メーカー",
    priority: "medium",
    note: "ヘアカラーの新色、商品、研究情報を確認します。",
    url: "https://www.hoyu.co.jp/",
    rssUrl: "https://www.hoyu.co.jp/news/rss.xml",
  }),
  source({
    name: "Allure Hair",
    categoryHint: "海外トレンド",
    sourceType: "美容メディア",
    priority: "high",
    note: "海外のヘアスタイル、カラー、ヘアケアのトレンドを確認します。",
    url: "https://www.allure.com/hair-ideas",
    rssUrl: "https://www.allure.com/feed/rss",
  }),
  source({
    name: "Vogue Beauty",
    categoryHint: "海外トレンド",
    sourceType: "美容メディア",
    priority: "high",
    note: "海外の上品なビューティー、ヘア、カラー傾向を確認します。",
    url: "https://www.vogue.com/beauty",
    rssUrl: "https://www.vogue.com/feed/rss",
  }),
  source({
    name: "Harper's Bazaar Hair",
    categoryHint: "海外トレンド",
    sourceType: "美容メディア",
    priority: "medium",
    note: "大人女性向けの海外ヘアスタイルやケア情報を確認します。",
    url: "https://www.harpersbazaar.com/beauty/hair/",
    rssUrl: "https://www.harpersbazaar.com/rss/beauty.xml",
  }),
  source({
    name: "Behindthechair.com",
    categoryHint: "海外トレンド",
    sourceType: "美容メディア",
    priority: "medium",
    note:
      "海外美容師の技術、カラー、サロンワーク事例を確認します。RSS未確認時は手動参照のみです。",
    url: "https://behindthechair.com/",
  }),
];
