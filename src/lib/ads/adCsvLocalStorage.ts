import { adCsvConfig } from "@/config/adCsv";
import type { AdCsvDataset, AdCsvImport, AdCsvRow } from "@/types/adCsv";

const storageKey = "hair-trend-ad-csv-v1";
export const adCsvStorageEventName = "hair-trend-ad-csv-change";

const emptyDataset: AdCsvDataset = {
  imports: [],
  rowsByImport: {},
};

const googleAdsApiFileNamePattern = /^google-ads-api-v1-[a-f0-9]{64}-(?:campaign|ad_group|ad|keyword|search_term|daily)-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}$/;

function readStoredDataset(): AdCsvDataset {
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

export function readLocalAdCsvDataset(): AdCsvDataset {
  const dataset = readStoredDataset();
  const latestApiImports = new Map<string, AdCsvImport>();

  for (const item of dataset.imports) {
    if (!googleAdsApiFileNamePattern.test(item.fileName) || item.status !== "imported") continue;
    const latest = latestApiImports.get(item.fileName);
    if (!latest || item.createdAt > latest.createdAt) latestApiImports.set(item.fileName, item);
  }

  return {
    ...dataset,
    imports: dataset.imports.filter((item) =>
      !googleAdsApiFileNamePattern.test(item.fileName) || latestApiImports.get(item.fileName) === item,
    ),
  };
}

function saveDataset(dataset: AdCsvDataset) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(dataset));
  window.dispatchEvent(new Event(adCsvStorageEventName));
}

export function addLocalAdCsvImport(item: AdCsvImport, rows: AdCsvRow[]) {
  const current = readStoredDataset();
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
