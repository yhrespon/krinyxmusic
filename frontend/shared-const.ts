export const COOKIE_NAME = "manus_session";
export const OAUTH_STATE_COOKIE = "oauth_state";
export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
export function encodeOAuthState(value: unknown) { return btoa(JSON.stringify(value)); }
export function decodeOAuthState(value: string) { return JSON.parse(atob(value)) as { redirectUri: string; nonce: string }; }
