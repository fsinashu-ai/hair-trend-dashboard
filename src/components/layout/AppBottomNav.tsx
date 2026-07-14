"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CircleEllipsis, House, Newspaper, PenLine } from "lucide-react";
import { mobileNavigationItems } from "@/data/navigation";
import { isNavigationPathActive } from "@/lib/navigation";

const navigationIcons = {
  analysis: BarChart3,
  collect: Newspaper,
  content: PenLine,
  home: House,
  more: CircleEllipsis,
};

export function AppBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 shadow-sm lg:hidden"
    >
      <div className="mx-auto grid max-w-2xl grid-cols-5 gap-1 pb-1">
        {mobileNavigationItems.map((item) => {
          const isActive = isNavigationPathActive(pathname, item.matchPrefixes);
          const Icon = navigationIcons[item.icon];

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-center text-[11px] font-semibold transition sm:text-xs ${
                isActive
                  ? "bg-teal-50 text-teal-800"
                  : "text-stone-600 hover:bg-teal-50 hover:text-teal-800"
              }`}
              href={item.href}
              key={item.href}
            >
              <Icon aria-hidden="true" className="size-4" strokeWidth={2.2} />
              {item.shortLabel}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
