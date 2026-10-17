export const BASIC_AUTH_FAILURE_LIMIT = 10;
export const BASIC_AUTH_FAILURE_WINDOW_MS = 15 * 60 * 1000;
export const BASIC_AUTH_LOCKOUT_MS = 15 * 60 * 1000;

const maximumTrackedIps = 10_000;

export type LoginRateLimitEntry = {
  failures: number[];
  lockoutUntil: number;
  updatedAt: number;
};

export type LoginRateLimitStore = Map<string, LoginRateLimitEntry>;

export type BasicAuthCheckResult = {
  authorized: boolean;
  retryAfterSeconds: number;
};

function cleanExpiredEntries(store: LoginRateLimitStore, now: number) {
  for (const [clientIp, entry] of store) {
    const failures = entry.failures.filter(
      (failedAt) =>
        failedAt > now - BASIC_AUTH_FAILURE_WINDOW_MS && failedAt <= now,
    );

    if (entry.lockoutUntil <= now && failures.length === 0) {
      store.delete(clientIp);
      continue;
    }

    if (failures.length !== entry.failures.length) {
      store.set(clientIp, { ...entry, failures });
    }
  }
}

function trimStoreSize(store: LoginRateLimitStore) {
  while (store.size > maximumTrackedIps) {
    let oldestIp: string | undefined;
    let oldestUpdatedAt = Number.POSITIVE_INFINITY;

    for (const [clientIp, entry] of store) {
      if (entry.updatedAt < oldestUpdatedAt) {
        oldestIp = clientIp;
        oldestUpdatedAt = entry.updatedAt;
      }
    }

    if (oldestIp === undefined) {
      return;
    }

    store.delete(oldestIp);
  }
}

export function getBasicAuthLockoutSeconds(
  store: LoginRateLimitStore,
  clientIp: string,
  now = Date.now(),
) {
  cleanExpiredEntries(store, now);
  const entry = store.get(clientIp);

  if (!entry || entry.lockoutUntil <= now) {
    return 0;
  }

  return Math.max(1, Math.ceil((entry.lockoutUntil - now) / 1000));
}

export function checkBasicAuthRequest(
  store: LoginRateLimitStore,
  clientIp: string,
  hasValidCookie: boolean,
  verifyBasicAuth: () => boolean,
  now = Date.now(),
): BasicAuthCheckResult {
  const retryAfterSeconds = hasValidCookie
    ? 0
    : getBasicAuthLockoutSeconds(store, clientIp, now);

  if (retryAfterSeconds > 0) {
    return { authorized: false, retryAfterSeconds };
  }

  if (hasValidCookie) {
    return { authorized: true, retryAfterSeconds: 0 };
  }

  return { authorized: verifyBasicAuth(), retryAfterSeconds: 0 };
}

export function recordBasicAuthFailure(
  store: LoginRateLimitStore,
  clientIp: string,
  now = Date.now(),
) {
  cleanExpiredEntries(store, now);
  const existing = store.get(clientIp);

  if (existing && existing.lockoutUntil > now) {
    return Math.max(1, Math.ceil((existing.lockoutUntil - now) / 1000));
  }

  const failures = (existing?.failures ?? []).filter(
    (failedAt) =>
      failedAt > now - BASIC_AUTH_FAILURE_WINDOW_MS && failedAt <= now,
  );
  failures.push(now);

  const entry: LoginRateLimitEntry = {
    failures,
    lockoutUntil:
      failures.length >= BASIC_AUTH_FAILURE_LIMIT
        ? now + BASIC_AUTH_LOCKOUT_MS
        : 0,
    updatedAt: now,
  };

  store.set(clientIp, entry);
  trimStoreSize(store);

  return getBasicAuthLockoutSeconds(store, clientIp, now);
}

export function clearBasicAuthFailures(
  store: LoginRateLimitStore,
  clientIp: string,
) {
  store.delete(clientIp);
}
