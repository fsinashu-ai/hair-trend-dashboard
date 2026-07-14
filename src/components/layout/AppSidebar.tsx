"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationItems } from "@/data/navigation";
import { isNavigationPathActive } from "@/lib/navigation";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden pt-6 lg:sticky lg:top-20 lg:block lg:h-[calc(100vh-5rem)] lg:overflow-y-auto lg:pr-1">
      <nav
        aria-label="Main navigation"
        className="grid gap-2 rounded-lg border border-stone-200 bg-white p-3 shadow-sm"
      >
        {navigationItems.map((item) => {
          const isActive = isNavigationPathActive(pathname, [item.href]);

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={`border-l-2 px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? "border-teal-700 bg-teal-50 text-teal-800"
                  : "border-transparent text-stone-600 hover:bg-teal-50 hover:text-teal-800"
              }`}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
