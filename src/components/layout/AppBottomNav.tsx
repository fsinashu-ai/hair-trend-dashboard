import Link from "next/link";
import { navigationItems } from "@/data/navigation";

export function AppBottomNav() {
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white px-2 pb-3 pt-2 shadow-sm lg:hidden"
    >
      <div className="mx-auto grid max-w-2xl auto-cols-[76px] grid-flow-col gap-1 overflow-x-auto pb-1">
        {navigationItems.map((item) => (
          <Link
            className="flex min-h-12 items-center justify-center rounded-md px-1 text-center text-[11px] font-semibold text-stone-600 hover:bg-teal-50 hover:text-teal-800 sm:text-xs"
            href={item.href}
            key={item.href}
          >
            {item.shortLabel}
          </Link>
        ))}
      </div>
    </nav>
  );
}
