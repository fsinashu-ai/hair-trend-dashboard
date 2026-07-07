import { adCsvConfig } from "@/config/adCsv";
import type { AdCsvDataset, AdCsvImport, AdCsvRow } from "@/types/adCsv";

const storageKey = "hair-trend-ad-csv-v1";
export const adCsvStorageEventName = "hair-trend-ad-csv-change";

const emptyDataset: AdCsvDataset = {
  imports: [],
  rowsByImport: {},
};

export function readLocalAdCsvDataset(): AdCsvDataset {
  if (typeof window === "undefined") return emptyDataset;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as Partial<AdCsvDataset> | null;
    if (!parsed || !Array.isArray(parsed.imports)) return emptyDataset;
    return {
      imports: parsed.imports,
      rowsByImport: parsed.rowsByImport ?? {},
    };
  } catch {
    return emptyDataset;
  }
}

function saveDataset(dataset: AdCsvDataset) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(dataset));
  window.dispatchEvent(new Event(adCsvStorageEventName));
}

export function addLocalAdCsvImport(item: AdCsvImport, rows: AdCsvRow[]) {
  const current = readLocalAdCsvDataset();
  const imports = [item, ...current.imports.filter((entry) => entry.id !== item.id)].slice(0, 10);
  const allowedIds = new Set(imports.map((entry) => entry.id));
  const rowsByImport = Object.fromEntries(
    Object.entries({
      ...current.rowsByImport,
      [item.id]: rows.slice(0, adCsvConfig.localStorageRowLimit),
    }).filter(([id]) => allowedIds.has(id)),
  );
  saveDataset({ imports, rowsByImport });
}
