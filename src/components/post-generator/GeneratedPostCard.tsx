import { Badge } from "@/components/ui/Badge";
import type { GeneratedPost } from "@/types/generatedPost";

type GeneratedPostCardProps = {
  post: GeneratedPost;
};

export function GeneratedPostCard({ post }: GeneratedPostCardProps) {
  return (
    <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info">{post.postType}</Badge>
        <Badge tone="neutral">{post.tone}</Badge>
      </div>
      <h2 className="mt-4 text-lg font-semibold text-stone-950">
        {post.theme}
      </h2>
      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-stone-700">
        {post.content}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {post.usedKeywords.map((keyword) => (
          <Badge key={keyword} tone="success">
            {keyword}
          </Badge>
        ))}
      </div>
      {post.hashtags && post.hashtags.length > 0 ? (
        <div className="mt-5 rounded-md bg-stone-50 p-4">
          <p className="text-xs font-semibold text-stone-500">
            自動生成ハッシュタグ
          </p>
          <p className="mt-2 break-words text-sm leading-6 text-stone-700">
            {post.hashtags.join(" ")}
          </p>
        </div>
      ) : null}
    </article>
  );
}
