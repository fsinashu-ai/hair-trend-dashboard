import { PageHeader } from "@/components/sections/PageHeader";
import { SocialInbox } from "@/components/social/SocialInbox";

export default function SocialInboxPage() {
  return (
    <main className="py-6">
      <PageHeader
        description="取り込んだSNS投稿を確認し、採用・保留・不要に整理します。採用した投稿だけをトレンド一覧へ保存できます。"
        eyebrow="Inbox"
        title="SNS受信箱"
      />
      <SocialInbox />
    </main>
  );
}
