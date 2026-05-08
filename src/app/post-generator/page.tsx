import { PostIdeaGenerator } from "@/components/post-generator/PostIdeaGenerator";
import { PageHeader } from "@/components/sections/PageHeader";

export default function PostGeneratorPage() {
  return (
    <main className="py-6">
      <PageHeader
        eyebrow="Post Generator"
        title="投稿ネタ生成"
        description="美容トレンドをもとに、投稿文やお客様向けの説明文、サロンメニュー提案の下書きを作ります。AI未設定時はモックレスポンスで動作します。"
      />

      <PostIdeaGenerator />
    </main>
  );
}
