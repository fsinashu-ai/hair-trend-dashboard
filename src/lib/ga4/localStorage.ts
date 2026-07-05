import type { Ga4Analysis, Ga4Dataset, Ga4Import, Ga4Row } from "@/types/ga4";

const storageKey = "hair-trend-ga4-v1";

const emptyDataset: Ga4Dataset = {
  analysesByImport: {},
  imports: [],
  rowsByImport: {},
};

export function readLocalGa4Dataset(): Ga4Dataset {
  if (typeof window === "undefined") return emptyDataset;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(storageKey) ?? "null",
    ) as Partial<Ga4Dataset> | null;
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

function saveDataset(dataset: Ga4Dataset) {
  window.localStorage.setItem(storageKey, JSON.stringify(dataset));
}

export function addLocalGa4Import(item: Ga4Import, rows: Ga4Row[]) {
  const current = readLocalGa4Dataset();
  saveDataset({
    analysesByImport: current.analysesByImport,
    imports: [item, ...current.imports],
    rowsByImport: {
      ...current.rowsByImport,
      [item.id]: rows,
    },
  });
}

export function saveLocalGa4Analysis(importId: string, analysis: Ga4Analysis) {
  const current = readLocalGa4Dataset();
  saveDataset({
    analysesByImport: {
      ...current.analysesByImport,
      [importId]: analysis,
    },
    imports: current.imports.map((item) =>
      item.id === importId
        ? { ...item, status: "analyzed", updatedAt: analysis.analyzedAt }
        : item,
    ),
    rowsByImport: current.rowsByImport,
  });
}
