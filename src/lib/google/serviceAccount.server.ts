import { createSign } from "node:crypto";

type ServiceAccountConfig = {
  clientEmail: string;
  privateKey: string;
};

type TokenCacheEntry = {
  accessToken: string;
  expiresAt: number;
};

const oauthTokenUrl = "https://oauth2.googleapis.com/token";
const tokenCache = new Map<string, TokenCacheEntry>();

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function normalizePrivateKey(value: string) {
  return value
    .trim()
    .replace(/^"|"$/g, "")
    .replace(/^'|'$/g, "")
    .replace(/\\n/g, "\n");
}

function readServiceAccountConfig(): ServiceAccountConfig | null {
  const jsonValue = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();

  if (jsonValue) {
    try {
      const parsed = JSON.parse(jsonValue) as Partial<{
        client_email: string;
        private_key: string;
      }>;
      if (parsed.client_email && parsed.private_key) {
        return {
          clientEmail: parsed.client_email.trim(),
          privateKey: normalizePrivateKey(parsed.private_key),
        };
      }
    } catch {
      return null;
    }
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || "";
  const privateKey = normalizePrivateKey(
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "",
  );

  if (!clientEmail || !privateKey) return null;
  return { clientEmail, privateKey };
}

export function isGoogleServiceAccountConfigured() {
  return Boolean(readServiceAccountConfig());
}

export async function getGoogleServiceAccountAccessToken(scope: string) {
  const config = readServiceAccountConfig();
  if (!config) {
    throw new Error(
      "Googleサービスアカウントの環境変数が未設定です。",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const cached = tokenCache.get(scope);
  if (cached && cached.expiresAt - 60 > now) return cached.accessToken;

  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claimSet = base64Url(
    JSON.stringify({
      aud: oauthTokenUrl,
      exp: now + 3600,
      iat: now,
      iss: config.clientEmail,
      scope,
    }),
  );
  const signingInput = `${header}.${claimSet}`;
  const signature = createSign("RSA-SHA256")
    .update(signingInput)
    .sign(config.privateKey);
  const assertion = `${signingInput}.${base64Url(signature)}`;

  const response = await fetch(oauthTokenUrl, {
    body: new URLSearchParams({
      assertion,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!response.ok || !json.access_token) {
    throw new Error("Google OAuthトークンの取得に失敗しました。");
  }

  const expiresAt = now + (json.expires_in ?? 3600);
  tokenCache.set(scope, { accessToken: json.access_token, expiresAt });
  return json.access_token;
}
