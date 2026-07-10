import Link from "next/link";
import { navigationItems } from "@/data/navigation";

export function AppSidebar() {
  return (
    <aside className="hidden pt-6 lg:sticky lg:top-20 lg:block lg:h-[calc(100vh-5rem)] lg:overflow-y-auto lg:pr-1">
      <nav
        aria-label="Main navigation"
        className="grid gap-2 rounded-lg border border-stone-200 bg-white p-3 shadow-sm"
      >
        {navigationItems.map((item) => (
          <Link
            className="rounded-md px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-teal-50 hover:text-teal-800"
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
