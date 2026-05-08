import { HairImageAnalyzer } from "@/components/image-analysis/HairImageAnalyzer";
import { PageHeader } from "@/components/sections/PageHeader";

export default function ImageAnalysisPage() {
  return (
    <main className="py-6">
      <PageHeader
        eyebrow="Image Analysis"
        title="画像分析"
        description="ヘア画像をSupabase Storageへ保存し、AI APIでヘアスタイル特徴、推定カテゴリ、SNS投稿向け説明を生成します。SNSスクレイピングは行いません。"
      />
      <HairImageAnalyzer />
    </main>
  );
}
