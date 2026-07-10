import Link from "next/link";

type MarketingNavLink = {
  href: string;
  label: string;
};

type MarketingNavGroup = {
  description: string;
  label: string;
  links: MarketingNavLink[];
};

const navigationGroups: MarketingNavGroup[] = [
  {
    description: "キーワード、ページ、広告方針、作業を整える",
    label: "計画・管理",
    links: [
      { href: "/seo", label: "SEO概要" },
      { href: "/seo/keywords", label: "キーワード" },
      { href: "/seo/pages", label: "ページ改善" },
      { href: "/seo/reports", label: "SEOレポート" },
      { href: "/seo/tasks", label: "SEOタスク" },
      { href: "/ads", label: "広告メモ" },
      { href: "/ads/reports", label: "広告レポート" },
      { href: "/ads/creatives", label: "広告案生成" },
    ],
  },
  {
    description: "公式APIまたは手動CSVで、判断に使う数字を保存する",
    label: "データを取り込む",
    links: [
      { href: "/seo/search-console/import", label: "SC CSV取込" },
      { href: "/seo/search-console/history", label: "SC取込履歴" },
      { href: "/seo/ga4/import", label: "GA4取込" },
      { href: "/ads/google", label: "Google広告API" },
      { href: "/ads/import", label: "広告CSV取込" },
    ],
  },
  {
    description: "期間・データ元を確認してから、成果と改善候補を見る",
    label: "実績を分析する",
    links: [
      { href: "/seo/search-console", label: "Search Console分析" },
      { href: "/seo/ga4", label: "GA4分析" },
      { href: "/seo/conversions", label: "CV分析" },
      { href: "/ads/imports", label: "広告実績集計" },
      { href: "/seo/integrated", label: "ページ統合分析" },
    ],
  },
  {
    description: "作成した記事・広告文を公開前に確認する",
    label: "公開前確認",
    links: [{ href: "/quality-check", label: "AI品質チェック" }],
  },
];

export function MarketingSectionNav({ activeHref }: { activeHref: string }) {
  return (
    <nav aria-label="SEO・広告管理" className="mb-6 space-y-4">
      {navigationGroups.map((group) => (
        <section key={group.label}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-sm font-semibold text-stone-950">{group.label}</h2>
            <p className="text-xs leading-5 text-stone-500">{group.description}</p>
          </div>
          <div className="mt-2 overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2">
              {group.links.map((link) => (
                <Link
                  className={`inline-flex min-h-10 items-center rounded-md px-3 text-sm font-semibold transition ${
                    activeHref === link.href
                      ? "bg-teal-700 text-white"
                      : "border border-stone-200 bg-white text-stone-700 hover:bg-teal-50 hover:text-teal-800"
                  }`}
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      ))}
    </nav>
  );
}
