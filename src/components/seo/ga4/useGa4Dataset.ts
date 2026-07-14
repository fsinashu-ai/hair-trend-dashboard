"use client";

import { useCallback, useEffect, useState } from "react";
import { dummyGa4Dataset } from "@/data/ga4";
import { readLocalGa4Dataset } from "@/lib/ga4/localStorage";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { Ga4Dataset } from "@/types/ga4";

export function useGa4Dataset(initialImportId?: string) {
  const supabaseEnabled = isSupabaseConfigured();
  const [dataset, setDataset] = useState<Ga4Dataset>(() =>
    supabaseEnabled ? { analysesByImport: {}, imports: [], rowsByImport: {} } : dummyGa4Dataset,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("GA4データを読み込み中です。");
  const [storageMode, setStorageMode] = useState<"supabase" | "local" | "demo">("demo");

  const load = useCallback(async (importId?: string) => {
    setIsLoading(true);
    try {
      const query = importId ? `?importId=${encodeURIComponent(importId)}` : "";
      const response = await fetch(`/api/seo/ga4/import${query}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as Ga4Dataset & {
        error?: string;
        storageMode?: "supabase" | "local";
      };
      if (!response.ok) throw new Error(data.error || "GA4データを読み込めませんでした。");
      if (data.storageMode === "supabase" && data.imports.length > 0) {
        setDataset({
          analysesByImport: data.analysesByImport ?? {},
          imports: data.imports,
          rowsByImport: data.rowsByImport ?? {},
        });
        setStorageMode("supabase");
        setMessage("SupabaseのGA4データを表示しています。");
        return;
      }

      const local = readLocalGa4Dataset();
      if (!supabaseEnabled && local.imports.length > 0) {
        setDataset(local);
        setStorageMode("local");
        setMessage("この端末に保存したGA4データを表示しています。");
        return;
      }

      setDataset(supabaseEnabled ? { analysesByImport: {}, imports: [], rowsByImport: {} } : dummyGa4Dataset);
      setStorageMode(supabaseEnabled ? "supabase" : "demo");
      setMessage(supabaseEnabled ? "データ待ちです。GA4 CSVを取り込むか、API取得を実行してください。" : "確認用サンプルデータを表示しています。");
    } catch (error) {
      const local = readLocalGa4Dataset();
      setDataset(!supabaseEnabled && local.imports.length > 0 ? local : supabaseEnabled ? { analysesByImport: {}, imports: [], rowsByImport: {} } : dummyGa4Dataset);
      setStorageMode(!supabaseEnabled && local.imports.length > 0 ? "local" : supabaseEnabled ? "supabase" : "demo");
      setMessage(supabaseEnabled ? "取得に失敗しました。再読み込みしても直らない場合はSupabase設定を確認してください。" : error instanceof Error ? error.message : "GA4データを読み込めませんでした。");
    } finally {
      setIsLoading(false);
    }
  }, [supabaseEnabled]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(initialImportId), 0);
    return () => window.clearTimeout(timeoutId);
  }, [initialImportId, load]);

  useEffect(() => {
    const handleUpdate = () => void load(initialImportId);
    window.addEventListener("ga4-updated", handleUpdate);
    return () => window.removeEventListener("ga4-updated", handleUpdate);
  }, [initialImportId, load]);

  return { dataset, isLoading, load, message, storageMode };
}
