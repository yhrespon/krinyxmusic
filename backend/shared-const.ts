export const COOKIE_NAME = "manus_session";
export const OAUTH_STATE_COOKIE = "oauth_state";
export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
export const AXIOS_TIMEOUT_MS = 10_000;
export const UNAUTHED_ERR_MSG = "UNAUTHORIZED";
export const NOT_ADMIN_ERR_MSG = "FORBIDDEN";

export function encodeOAuthState(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeOAuthState(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
    redirectUri: string;
    nonce: string;
  };
}
