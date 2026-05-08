import { Suspense } from "react";
import { PageHeader } from "@/components/sections/PageHeader";
import { TrendManager } from "@/components/trends/TrendManager";

export default function TrendsPage() {
  return (
    <main className="py-6">
      <PageHeader
        eyebrow="Trends"
        title="トレンド一覧"
        description="URL、タイトル、カテゴリ、メモを手動登録して、サロン提案や投稿ネタの材料として管理します。環境変数が設定されている場合はSupabaseに保存し、未設定の場合はダミーデータで動作します。"
      />

      <Suspense fallback={<p className="text-sm text-stone-500">読み込み中です。</p>}>
        <TrendManager />
      </Suspense>
    </main>
  );
}
