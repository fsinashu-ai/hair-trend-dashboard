import { searchConsoleConfig } from "@/config/searchConsole";
import type {
  SearchConsoleDataset,
  SearchConsoleImport,
  SearchConsoleRow,
  SearchConsoleSeoAnalysis,
  SearchConsoleTaskSuggestion,
} from "@/types/searchConsole";
import type { SeoTaskStatus } from "@/types/seoAds";

const storageKey = "hair-trend-search-console-v1";
const taskStorageKey = `${storageKey}-tasks`;

type LocalSearchConsoleTask = {
  dueDate: string;
  id: string;
  importId: string;
  status: SeoTaskStatus;
  suggestion: SearchConsoleTaskSuggestion;
};

type StoredLocalSearchConsoleTask = Omit<
  LocalSearchConsoleTask,
  "id" | "status"
> & {
  id?: string;
  status?: SeoTaskStatus;
};

function legacyTaskId(item: StoredLocalSearchConsoleTask) {
  const source = [
    item.importId,
    item.suggestion.title,
    item.suggestion.keyword ?? "",
    item.suggestion.pageUrl ?? "",
  ].join("|");
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) | 0;
  }
  return `local-task-${Math.abs(hash).toString(36)}`;
}

function createTaskId() {
  if (typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function") {
    return `local-task-${window.crypto.randomUUID()}`;
  }
  return `local-task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readStoredLocalTasks(): LocalSearchConsoleTask[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(taskStorageKey) ?? "[]",
    ) as StoredLocalSearchConsoleTask[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      ...item,
      id: item.id || legacyTaskId(item),
      status:
        item.status === "doing" || item.status === "done" || item.status === "hold"
          ? item.status
          : "todo",
    }));
  } catch {
    return [];
  }
}

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
  const tasks = readStoredLocalTasks();
  const duplicate = tasks.some(
    (item) =>
      item.importId === importId &&
      item.suggestion.title === suggestion.title &&
      item.suggestion.keyword === suggestion.keyword &&
      item.suggestion.pageUrl === suggestion.pageUrl,
  );
  if (!duplicate) {
    window.localStorage.setItem(
      taskStorageKey,
      JSON.stringify(
        [
          { dueDate, id: createTaskId(), importId, status: "todo", suggestion },
          ...tasks,
        ].slice(0, 100),
      ),
    );
  }
  return { duplicate };
}

export function readLocalSearchConsoleTasks() {
  return readStoredLocalTasks();
}

export function updateLocalSearchConsoleTaskStatus(
  taskId: string,
  status: SeoTaskStatus,
) {
  if (typeof window === "undefined") return false;
  const tasks = readStoredLocalTasks();
  const nextTasks = tasks.map((task) =>
    task.id === taskId ? { ...task, status } : task,
  );
  if (!tasks.some((task) => task.id === taskId)) return false;
  window.localStorage.setItem(taskStorageKey, JSON.stringify(nextTasks));
  return true;
}
