import { Router } from "express";
import crypto from "node:crypto";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const tokenStore = new Map<string, { email?: string; name?: string; expiresAt: number }>();
const states = new Set<string>();
const COOKIE = "krinyx_google_session";

function redirectUri(req: any) {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const proto = String(req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http")).split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "127.0.0.1:3000").split(",")[0].trim();
  return `${proto}://${host}/api/google/callback`;
}

function session(req: any) {
  const token = String(req.headers.cookie || "").match(new RegExp(`${COOKIE}=([^;]+)`))?.[1];
  const value = token ? tokenStore.get(token) : undefined;
  return value && value.expiresAt > Date.now() ? value : undefined;
}

export const googleRouter = Router();
googleRouter.get("/status", (req, res) => res.json({ configured: Boolean(CLIENT_ID && CLIENT_SECRET), connected: Boolean(session(req)) }));
googleRouter.get("/login", (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET) return res.redirect("/?google=setup");
  const state = crypto.randomBytes(24).toString("hex");
  states.add(state);
  const params = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: redirectUri(req), response_type: "code", scope: "openid email profile", access_type: "offline", prompt: "select_account", state });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});
googleRouter.get("/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string | undefined>;
  if (error) return res.redirect("/?google=cancelled");
  if (!code || !state || !states.has(state)) return res.status(400).send("Callback Google invalide ou expiré.");
  states.delete(state);
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: redirectUri(req), grant_type: "authorization_code" }) });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(tokenData.error_description || "La connexion Google a échoué.");
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
    const profile = await profileResponse.json();
    const token = crypto.randomBytes(32).toString("hex");
    tokenStore.set(token, { email: profile.email, name: profile.name, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
    res.setHeader("Set-Cookie", `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`);
    res.redirect("/?google=connected");
  } catch (error) { console.error("[Google callback]", error); res.redirect("/?google=error"); }
});
googleRouter.post("/logout", (req, res) => {
  const token = String(req.headers.cookie || "").match(new RegExp(`${COOKIE}=([^;]+)`))?.[1];
  if (token) tokenStore.delete(token);
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  res.json({ ok: true });
});
