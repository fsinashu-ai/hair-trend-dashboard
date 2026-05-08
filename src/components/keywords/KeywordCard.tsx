import { Badge } from "@/components/ui/Badge";
import type { Keyword } from "@/types/keyword";

type KeywordCardProps = {
  isDeleting?: boolean;
  keyword: Keyword;
  onDelete?: (id: string) => void;
};

const priorityTone = {
  高: "danger",
  中: "warning",
  低: "neutral",
} as const;

export function KeywordCard({
  isDeleting = false,
  keyword,
  onDelete,
}: KeywordCardProps) {
  return (
    <article className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm transition hover:border-teal-200 hover:shadow-md sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-950">
            {keyword.name}
          </h2>
          <p className="mt-1 text-sm text-stone-500">{keyword.category}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={priorityTone[keyword.priority]}>
            優先度 {keyword.priority}
          </Badge>
          {onDelete ? (
            <button
              className="min-h-9 rounded-md border border-stone-300 px-3 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
              disabled={isDeleting}
              onClick={() => onDelete(keyword.id)}
              type="button"
            >
              {isDeleting ? "削除中" : "削除"}
            </button>
          ) : null}
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-stone-600">{keyword.memo}</p>
      <p className="mt-4 text-sm font-medium text-stone-800">
        投稿利用回数: {keyword.useCount}
      </p>
    </article>
  );
}
