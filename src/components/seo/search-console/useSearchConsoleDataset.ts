"use client";

import { useCallback, useEffect, useState } from "react";
import { dummySearchConsoleDataset } from "@/data/searchConsole";
import { readLocalSearchConsoleDataset } from "@/lib/searchConsole/localStorage";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { SearchConsoleDataset } from "@/types/searchConsole";

type StorageMode = "supabase" | "local" | "demo";

export function useSearchConsoleDataset(initialImportId?: string) {
  const supabaseEnabled = isSupabaseConfigured();
  const [dataset, setDataset] = useState<SearchConsoleDataset>(() =>
    supabaseEnabled ? { analysesByImport: {}, imports: [], rowsByImport: {} } : dummySearchConsoleDataset,
  );
  const [storageMode, setStorageMode] = useState<StorageMode>("demo");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("Search Consoleデータを読み込んでいます。");

  const load = useCallback(async (importId?: string) => {
    setIsLoading(true);
    try {
      const query = importId ? `?importId=${encodeURIComponent(importId)}` : "";
      const response = await fetch(`/api/seo/search-console/import${query}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as SearchConsoleDataset & {
        storageMode?: "supabase" | "local";
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "読み込めませんでした。");

      if (data.storageMode === "supabase" && data.imports.length > 0) {
        setDataset(data);
        setStorageMode("supabase");
        setMessage("Supabaseに保存されたSearch Consoleデータを表示しています。");
        return;
      }

      const local = readLocalSearchConsoleDataset();
      if (!supabaseEnabled && local.imports.length > 0) {
        setDataset(local);
        setStorageMode("local");
        setMessage("この端末に保存したSearch Consoleデータを表示しています。");
      } else {
        setDataset(supabaseEnabled ? { analysesByImport: {}, imports: [], rowsByImport: {} } : dummySearchConsoleDataset);
        setStorageMode(supabaseEnabled ? "supabase" : "demo");
        setMessage(supabaseEnabled ? "データ待ちです。Search Console CSVを取り込んでください。" : "確認用サンプルデータを表示しています。");
      }
    } catch {
      const local = readLocalSearchConsoleDataset();
      setDataset(!supabaseEnabled && local.imports.length > 0 ? local : supabaseEnabled ? { analysesByImport: {}, imports: [], rowsByImport: {} } : dummySearchConsoleDataset);
      setStorageMode(!supabaseEnabled && local.imports.length > 0 ? "local" : supabaseEnabled ? "supabase" : "demo");
      setMessage(supabaseEnabled ? "取得に失敗しました。再読み込みしても直らない場合はSupabase設定を確認してください。" : "Search Consoleデータを読み込めませんでした。確認用サンプルデータを表示しています。");
    } finally {
      setIsLoading(false);
    }
  }, [supabaseEnabled]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(initialImportId), 0);
    return () => window.clearTimeout(timeoutId);
  }, [initialImportId, load]);

  useEffect(() => {
    const handleUpdate = () => void load();
    window.addEventListener("search-console-updated", handleUpdate);
    return () => window.removeEventListener("search-console-updated", handleUpdate);
  }, [load]);

  return { dataset, isLoading, load, message, storageMode };
}
