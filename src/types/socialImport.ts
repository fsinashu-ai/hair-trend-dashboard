export type SocialImportRunStatus =
  | "running"
  | "success"
  | "partial"
  | "failed"
  | "no_items"
  | "preview";

export type SocialImportRun = {
  id: string;
  provider: string;
  sourceName: string;
  actorId?: string;
  actorRunId?: string;
  datasetId?: string;
  requestId?: string;
  idempotencyKey?: string;
  status: SocialImportRunStatus;
  receivedCount: number;
  normalizedCount: number;
  savedCount: number;
  duplicateCount: number;
  skippedCount: number;
  errorCount: number;
  aiClassifiedCount: number;
  sourceMatchedCount: number;
  startedAt: string;
  finishedAt?: string;
  errorSummary?: string;
};

export type NewSocialImportRun = Omit<
  SocialImportRun,
  "id" | "finishedAt"
> & {
  finishedAt?: string;
};

export type SocialImportRunUpdate = Partial<
  Omit<SocialImportRun, "id" | "startedAt">
>;
