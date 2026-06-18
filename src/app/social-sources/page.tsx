import { PageHeader } from "@/components/sections/PageHeader";
import { SocialCrawlerPanel } from "@/components/social/SocialCrawlerPanel";
import { SocialSourceManager } from "@/components/social/SocialSourceManager";

export default function SocialSourcesPage() {
  return (
    <main className="py-6">
      <PageHeader
        description="公式APIまたは確認済みの公開投稿URLから、必要最小限のメタデータだけを取り込みます。取得できない場合は手動入力へ戻ります。"
        eyebrow="Social"
        title="SNS情報取得"
      />
      <SocialCrawlerPanel />
      <SocialSourceManager />
    </main>
  );
}
