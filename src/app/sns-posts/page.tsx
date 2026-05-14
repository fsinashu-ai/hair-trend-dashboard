import { PageHeader } from "@/components/sections/PageHeader";
import { SnsPostManager } from "@/components/sns-posts/SnsPostManager";

export default function SnsPostsPage() {
  return (
    <main className="py-6">
      <PageHeader
        eyebrow="SNS"
        title="SNS投稿登録"
        description="Instagram、YouTube、Pinterest、TikTok、Xなどの投稿URLを手動登録し、美容師向けにAI分類します。非公式スクレイピングは行いません。"
      />
      <SnsPostManager />
    </main>
  );
}
