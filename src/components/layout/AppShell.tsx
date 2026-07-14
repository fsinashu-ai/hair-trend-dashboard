import type { ReactNode } from "react";
import { AppBottomNav } from "@/components/layout/AppBottomNav";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppSidebar } from "@/components/layout/AppSidebar";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
      <AppHeader />
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-5 sm:px-8 lg:grid-cols-[220px_1fr] lg:px-10">
        <AppSidebar />
        <div className="min-w-0">{children}</div>
      </div>
      <AppBottomNav />
    </div>
  );
}
