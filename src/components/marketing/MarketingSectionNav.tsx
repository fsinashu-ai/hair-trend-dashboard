import Link from "next/link";

const links = [
  { href: "/seo", label: "SEO概要" },
  { href: "/seo/keywords", label: "キーワード" },
  { href: "/seo/pages", label: "ページ改善" },
  { href: "/seo/reports", label: "SEOレポート" },
  { href: "/seo/tasks", label: "SEOタスク" },
  { href: "/seo/search-console", label: "Search Console" },
  { href: "/seo/search-console/import", label: "CSV取込" },
  { href: "/seo/search-console/history", label: "取込履歴" },
  { href: "/seo/ga4", label: "GA4" },
  { href: "/seo/ga4/import", label: "GA4取込" },
  { href: "/seo/conversions", label: "CV分析" },
  { href: "/ads", label: "広告メモ" },
  { href: "/ads/reports", label: "広告レポート" },
];

export function MarketingSectionNav({ activeHref }: { activeHref: string }) {
  return (
    <nav aria-label="SEO・広告管理" className="mb-6 overflow-x-auto pb-1">
      <div className="flex min-w-max gap-2">
        {links.map((link) => (
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
    </nav>
  );
}
