import { searchConsoleConfig } from "@/config/searchConsole";
import type {
  SearchConsoleDataset,
  SearchConsoleImport,
  SearchConsoleRow,
  SearchConsoleSeoAnalysis,
  SearchConsoleTaskSuggestion,
} from "@/types/searchConsole";

const storageKey = "hair-trend-search-console-v1";

const emptyDataset: SearchConsoleDataset = {
  analysesByImport: {},
  imports: [],
  rowsByImport: {},
};

export function readLocalSearchConsoleDataset(): SearchConsoleDataset {
  if (typeof window === "undefined") return emptyDataset;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as Partial<SearchConsoleDataset> | null;
    if (!parsed || !Array.isArray(parsed.imports)) return emptyDataset;
    return {
      analysesByImport: parsed.analysesByImport ?? {},
      imports: parsed.imports,
      rowsByImport: parsed.rowsByImport ?? {},
    };
  } catch {
    return emptyDataset;
  }
}

function saveDataset(dataset: SearchConsoleDataset) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(dataset));
}

export function addLocalSearchConsoleImport(
  item: SearchConsoleImport,
  rows: SearchConsoleRow[],
) {
  const current = readLocalSearchConsoleDataset();
  const imports = [item, ...current.imports.filter((entry) => entry.id !== item.id)].slice(0, 10);
  const allowedIds = new Set(imports.map((entry) => entry.id));
  const rowsByImport = Object.fromEntries(
    Object.entries({
      ...current.rowsByImport,
      [item.id]: rows.slice(0, searchConsoleConfig.localStorageRowLimit),
    }).filter(([id]) => allowedIds.has(id)),
  );
  saveDataset({ analysesByImport: current.analysesByImport, imports, rowsByImport });
}

export function saveLocalSearchConsoleAnalysis(
  importId: string,
  analysis: SearchConsoleSeoAnalysis,
) {
  const current = readLocalSearchConsoleDataset();
  saveDataset({
    ...current,
    analysesByImport: { ...current.analysesByImport, [importId]: analysis },
    imports: current.imports.map((item) =>
      item.id === importId
        ? { ...item, status: "analyzed", updatedAt: analysis.analyzedAt }
        : item,
    ),
  });
}

export function saveLocalSearchConsoleTask(
  importId: string,
  suggestion: SearchConsoleTaskSuggestion,
  dueDate: string,
) {
  if (typeof window === "undefined") return { duplicate: false };
  const taskKey = `${storageKey}-tasks`;
  const tasks = JSON.parse(window.localStorage.getItem(taskKey) ?? "[]") as Array<{
    importId: string;
    suggestion: SearchConsoleTaskSuggestion;
    dueDate: string;
  }>;
  const duplicate = tasks.some(
    (item) =>
      item.importId === importId &&
      item.suggestion.title === suggestion.title &&
      item.suggestion.keyword === suggestion.keyword &&
      item.suggestion.pageUrl === suggestion.pageUrl,
  );
  if (!duplicate) {
    window.localStorage.setItem(
      taskKey,
      JSON.stringify([{ dueDate, importId, suggestion }, ...tasks].slice(0, 100)),
    );
  }
  return { duplicate };
}

export function readLocalSearchConsoleTasks() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(
      window.localStorage.getItem(`${storageKey}-tasks`) ?? "[]",
    ) as Array<{
      importId: string;
      suggestion: SearchConsoleTaskSuggestion;
      dueDate: string;
    }>;
  } catch {
    return [];
  }
}
