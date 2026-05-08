import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hair Trend Dashboard",
  description: "美容師向けのヘアトレンド収集ダッシュボード",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full bg-stone-50 text-stone-950">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
