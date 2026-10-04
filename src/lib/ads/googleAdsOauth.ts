const oauthErrorCodePattern = /^[a-z][a-z0-9_]{0,63}$/;

export class GoogleAdsOAuthError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "GoogleAdsOAuthError";
    this.code = code;
  }
}

export function readGoogleOAuthErrorCode(payload: unknown) {
  if (!payload || typeof payload !== "object") return "unknown_error";

  const value = (payload as { error?: unknown }).error;
  if (typeof value !== "string") return "unknown_error";

  const normalized = value.trim().toLowerCase();
  return oauthErrorCodePattern.test(normalized) ? normalized : "unknown_error";
}

export function googleAdsOAuthErrorMessage(code: string, httpStatus: number) {
  if (code === "invalid_grant") {
    return "Google広告APIのRefresh Tokenが失効または取り消されています。Google CloudのOAuth公開ステータスを「本番環境」にした後、Google Ads権限でRefresh Tokenを再発行し、VercelのGOOGLE_ADS_REFRESH_TOKENを更新してください。";
  }

  if (code === "invalid_client") {
    return "Google広告APIのClient IDまたはClient Secretが一致していません。同じOAuthクライアントから発行した認証情報をVercelへ設定してください。";
  }

  if (code === "unauthorized_client") {
    return "Google広告APIのOAuthクライアントではRefresh Token認証が許可されていません。OAuthクライアント種別とGoogle Ads APIの設定を確認してください。";
  }

  if (code === "access_denied") {
    return "Google広告APIへのアクセス許可が取り消されています。Google広告アカウントへアクセスできるGoogleアカウントで再認証してください。";
  }

  return `Google広告APIのOAuth認証に失敗しました（${code} / HTTP ${httpStatus}）。Google CloudとVercelのOAuth設定を確認してください。`;
}
