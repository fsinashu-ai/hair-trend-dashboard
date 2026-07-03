"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { readLocalSearchConsoleTasks } from "@/lib/searchConsole/localStorage";
import type { SeoTask } from "@/types/seoAds";

export function SeoTaskList({ importId }: { importId?: string }) {
  const [items, setItems] = useState<SeoTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("SEOタスクを読み込んでいます。");

  useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      try {
        const query = importId ? `?importId=${encodeURIComponent(importId)}` : "";
        const response = await fetch(`/api/seo/tasks${query}`, { cache: "no-store" });
        const data = (await response.json()) as {
          items?: SeoTask[];
          storageMode?: "local" | "supabase";
        };
        if (data.storageMode === "supabase") {
          setItems(data.items ?? []);
          setMessage("Supabaseに保存されたSEOタスクを表示しています。");
        } else {
          const local = readLocalSearchConsoleTasks()
            .filter((item) => !importId || item.importId === importId)
            .map((item, index): SeoTask => ({
              dueDate: item.dueDate,
              id: `local-task-${index}-${item.importId}`,
              memo: item.suggestion.reason,
              priority: item.suggestion.priority,
              reason: item.suggestion.reason,
              relatedKeyword: item.suggestion.keyword ?? "",
              relatedPageUrl: item.suggestion.pageUrl ?? "",
              sourceSearchConsoleImportId: item.importId,
              status: "todo",
              taskType: item.suggestion.taskType,
              title: item.suggestion.title,
            }));
          setItems(local);
          setMessage("この端末に保存したSEOタスクを表示しています。");
        }
      } catch {
        setMessage("SEOタスクを読み込めませんでした。");
      } finally {
        setIsLoading(false);
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [importId]);

  return (
    <div className="space-y-4 pb-10">
      <StatusMessage isLoading={isLoading} tone={items.length ? "info" : "warning"}>{message}</StatusMessage>
      {items.map((task) => (
        <article className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5" key={task.id}>
          <div className="flex flex-wrap gap-2"><Badge tone={task.priority === "high" ? "danger" : task.priority === "medium" ? "warning" : "neutral"}>{task.priority}</Badge><Badge tone="info">{task.taskType}</Badge><Badge>{task.status}</Badge></div>
          <h2 className="mt-3 font-semibold text-stone-950">{task.title}</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">{task.reason || task.memo}</p>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-xs text-stone-500">キーワード</dt><dd className="mt-1">{task.relatedKeyword || "未設定"}</dd></div><div><dt className="text-xs text-stone-500">期限</dt><dd className="mt-1">{task.dueDate || "未設定"}</dd></div></dl>
        </article>
      ))}
      {!isLoading && items.length === 0 ? <p className="rounded-md bg-stone-50 p-5 text-sm text-stone-500">登録済みのSEOタスクはありません。</p> : null}
    </div>
  );
}

