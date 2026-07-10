import { createClient } from "@supabase/supabase-js";

function normalizeSupabaseUrl(url: string | undefined) {
  if (!url) {
    return undefined;
  }

  return url.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
}

const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const browserProxyKey = "hair-trend-dashboard-browser-proxy";

function getServerServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
}

function getBrowserProxyUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  return new URL("/api/supabase", window.location.origin).toString();
}

function browserProxyFetch(input: RequestInfo | URL, init?: RequestInit) {
  const request = new Request(input, init);
  const headers = new Headers(request.headers);

  // Supabase JS adds a Bearer header for its client key. Removing that header
  // lets the browser attach the already-verified Basic Auth credentials for our
  // same-origin proxy instead. The proxy supplies the service role key itself.
  headers.delete("authorization");

  return fetch(
    new Request(request, {
      credentials: "same-origin",
      headers,
    }),
  );
}

export function isSupabaseConfigured() {
  return Boolean(
    supabaseUrl &&
      (typeof window === "undefined" || getBrowserProxyUrl() || getServerServiceRoleKey()),
  );
}

export function getSupabaseClient() {
  if (!supabaseUrl) {
    return null;
  }

  if (typeof window === "undefined") {
    const serviceRoleKey = getServerServiceRoleKey();

    if (!serviceRoleKey) {
      return null;
    }

    return createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  const proxyUrl = getBrowserProxyUrl();

  if (!proxyUrl) {
    return null;
  }

  // The browser never receives a usable Supabase key. The same-origin API route
  // checks the app password and substitutes the server-only service role key.
  return createClient(proxyUrl, browserProxyKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: browserProxyFetch },
  });
}
