import { KeywordManager } from "@/components/keywords/KeywordManager";
import { PageHeader } from "@/components/sections/PageHeader";

export default function KeywordsPage() {
  return (
    <main className="py-6">
      <PageHeader
        eyebrow="Keywords"
        title="キーワード管理"
        description="投稿生成やトレンド整理で使うキーワードを管理します。環境変数が設定されている場合はSupabaseに保存し、未設定の場合はダミーデータで動作します。"
      />

      <KeywordManager />
    </main>
  );
}
