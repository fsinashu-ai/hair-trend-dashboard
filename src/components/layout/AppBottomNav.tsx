"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mobileNavigationItems } from "@/data/navigation";

function isActivePath(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => {
    if (prefix === "/") {
      return pathname === "/";
    }

    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

export function AppBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white px-2 pb-3 pt-2 shadow-sm lg:hidden"
    >
      <div className="mx-auto grid max-w-2xl grid-cols-5 gap-1 pb-1">
        {mobileNavigationItems.map((item) => {
          const isActive = isActivePath(pathname, item.matchPrefixes);

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-12 items-center justify-center rounded-md px-1 text-center text-[11px] font-semibold transition sm:text-xs ${
                isActive
                  ? "bg-teal-50 text-teal-800"
                  : "text-stone-600 hover:bg-teal-50 hover:text-teal-800"
              }`}
              href={item.href}
              key={item.href}
            >
              {item.shortLabel}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
