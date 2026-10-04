"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { StatusMessage } from "@/components/ui/StatusMessage";
import {
  readLocalSearchConsoleTasks,
  updateLocalSearchConsoleTaskStatus,
} from "@/lib/searchConsole/localStorage";
import type { SeoTask, SeoTaskStatus } from "@/types/seoAds";

const statusOptions: Array<{ label: string; value: SeoTaskStatus }> = [
  { label: "未着手", value: "todo" },
  { label: "対応中", value: "doing" },
  { label: "保留", value: "hold" },
  { label: "完了", value: "done" },
];

function normalizeStatus(status: SeoTask["status"]): SeoTaskStatus {
  if (status === "doing" || status === "対応中") return "doing";
  if (status === "done") return "done";
  if (status === "hold") return "hold";
  return "todo";
}

function statusLabel(status: SeoTask["status"]) {
  return statusOptions.find((item) => item.value === normalizeStatus(status))?.label ?? "未着手";
}

export function SeoTaskList({ importId }: { importId?: string }) {
  const [items, setItems] = useState<SeoTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("SEOタスクを読み込んでいます。");
  const [storageMode, setStorageMode] = useState<"local" | "supabase">("local");
  const [updatingTaskId, setUpdatingTaskId] = useState("");

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
          setStorageMode("supabase");
          setMessage("Supabaseに保存されたSEOタスクを表示しています。");
        } else {
          const local = readLocalSearchConsoleTasks()
            .filter((item) => !importId || item.importId === importId)
            .map((item): SeoTask => ({
              dueDate: item.dueDate,
              id: item.id,
              memo: item.suggestion.reason,
              priority: item.suggestion.priority,
              reason: item.suggestion.reason,
              relatedKeyword: item.suggestion.keyword ?? "",
              relatedPageUrl: item.suggestion.pageUrl ?? "",
              sourceSearchConsoleImportId: item.importId,
              status: item.status,
              taskType: item.suggestion.taskType,
              title: item.suggestion.title,
            }));
          setItems(local);
          setStorageMode("local");
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

  async function updateTaskStatus(task: SeoTask, status: SeoTaskStatus) {
    const previousStatus = task.status;
    setUpdatingTaskId(task.id);
    setItems((current) =>
      current.map((item) => (item.id === task.id ? { ...item, status } : item)),
    );

    try {
      if (storageMode === "supabase") {
        const response = await fetch("/api/seo/tasks", {
          body: JSON.stringify({ status, taskId: task.id }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error || "SEOタスクの状態を更新できませんでした。");
        }
      } else if (!updateLocalSearchConsoleTaskStatus(task.id, status)) {
        throw new Error("この端末のSEOタスクを更新できませんでした。");
      }

      setMessage(
        status === "done"
          ? "完了にしました。ホームのやる事リストにも反映されます。"
          : `状態を「${statusLabel(status)}」に更新しました。`,
      );
    } catch (error) {
      setItems((current) =>
        current.map((item) =>
          item.id === task.id ? { ...item, status: previousStatus } : item,
        ),
      );
      setMessage(
        error instanceof Error
          ? error.message
          : "SEOタスクの状態を更新できませんでした。",
      );
    } finally {
      setUpdatingTaskId("");
    }
  }

  return (
    <div className="space-y-4 pb-10">
      <StatusMessage isLoading={isLoading} tone={items.length ? "info" : "warning"}>{message}</StatusMessage>
      {items.map((task) => (
        <article className={`rounded-lg border p-4 shadow-sm sm:p-5 ${normalizeStatus(task.status) === "done" ? "border-teal-200 bg-teal-50/60" : "border-stone-200 bg-white"}`} key={task.id}>
          <div className="flex flex-wrap items-center gap-2"><Badge tone={task.priority === "high" ? "danger" : task.priority === "medium" ? "warning" : "neutral"}>{task.priority}</Badge><Badge tone="info">{task.taskType}</Badge><Badge tone={normalizeStatus(task.status) === "done" ? "success" : "neutral"}>{statusLabel(task.status)}</Badge></div>
          <h2 className="mt-3 font-semibold text-stone-950">{task.title}</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">{task.reason || task.memo}</p>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-xs text-stone-500">キーワード</dt><dd className="mt-1">{task.relatedKeyword || "未設定"}</dd></div><div><dt className="text-xs text-stone-500">期限</dt><dd className="mt-1">{task.dueDate || "未設定"}</dd></div></dl>
          <label className="mt-4 flex max-w-xs flex-col gap-1 text-sm font-semibold text-stone-700">
            状態を変更
            <select
              aria-label={`${task.title}の状態`}
              className="min-h-11 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-800"
              disabled={updatingTaskId === task.id}
              onChange={(event) => void updateTaskStatus(task, event.target.value as SeoTaskStatus)}
              value={normalizeStatus(task.status)}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </article>
      ))}
      {!isLoading && items.length === 0 ? <p className="rounded-md bg-stone-50 p-5 text-sm text-stone-500">登録済みのSEOタスクはありません。</p> : null}
    </div>
  );
}
