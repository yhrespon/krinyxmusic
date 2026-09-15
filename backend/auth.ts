import { Router } from "express";
import crypto from "node:crypto";
import pg from "pg";
import { emailConfigured, hashEmailToken, makeEmailToken, sendVerificationEmail } from "./email.ts";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL?.trim();
const normalizedDatabaseUrl = databaseUrl ? (/[?&]sslmode=/i.test(databaseUrl) ? databaseUrl.replace(/([?&]sslmode=)(prefer|require|verify-ca|verify-full)/i, "$1verify-full") : `${databaseUrl}${databaseUrl.includes("?") ? "&" : "?"}sslmode=verify-full`) : databaseUrl;
export const pool = normalizedDatabaseUrl ? new Pool({ connectionString: normalizedDatabaseUrl, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000, statement_timeout: 15_000, query_timeout: 20_000, ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false } }) : null;
pool?.on("error", error => console.error("[PostgreSQL pool] Connexion interrompue :", error.message));
const SESSION_COOKIE = "krinyx_session";
const loginAttempts = new Map<string, { count: number; started: number }>();

function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}
function cookieOptions(maxAge: number) { return `${SESSION_COOKIE}=TOKEN; HttpOnly; SameSite=${process.env.NODE_ENV === "production" ? "Strict" : "Lax"}; Path=/; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`; }
function sessionToken(req: any) { return String(req.headers.cookie || "").match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1]; }
function deviceId(req: any) { return String(req.headers.cookie || "").match(/(?:^|;\s*)krinyx_device=([^;]+)/)?.[1] || crypto.randomUUID(); }

export async function ensureAuthTables() {
  if (!pool) { console.warn("[Auth] DATABASE_URL absent: comptes désactivés."); return; }
  await pool.query(`CREATE TABLE IF NOT EXISTS krinyx_users (id UUID PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, email_verified BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()); ALTER TABLE krinyx_users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE; CREATE TABLE IF NOT EXISTS krinyx_email_verification_tokens (token_hash TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES krinyx_users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()); CREATE TABLE IF NOT EXISTS krinyx_sessions (token TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES krinyx_users(id) ON DELETE CASCADE, device_id TEXT NOT NULL DEFAULT 'legacy', expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()); CREATE INDEX IF NOT EXISTS krinyx_sessions_expiry_idx ON krinyx_sessions(expires_at); CREATE TABLE IF NOT EXISTS krinyx_spotify_accounts (id UUID PRIMARY KEY, user_id UUID NOT NULL UNIQUE REFERENCES krinyx_users(id) ON DELETE CASCADE, spotify_user_id TEXT, access_token TEXT NOT NULL, refresh_token TEXT, token_expires_at TIMESTAMPTZ NOT NULL, scope TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()); CREATE TABLE IF NOT EXISTS krinyx_favorites (user_id UUID NOT NULL REFERENCES krinyx_users(id) ON DELETE CASCADE, track_id TEXT NOT NULL, track JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (user_id, track_id)); CREATE TABLE IF NOT EXISTS krinyx_playlists (id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES krinyx_users(id) ON DELETE CASCADE, name TEXT NOT NULL, imported BOOLEAN NOT NULL DEFAULT FALSE, image TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()); CREATE TABLE IF NOT EXISTS krinyx_playlist_tracks (playlist_id UUID NOT NULL REFERENCES krinyx_playlists(id) ON DELETE CASCADE, track_id TEXT NOT NULL, track JSONB NOT NULL, position INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (playlist_id, track_id)); CREATE TABLE IF NOT EXISTS krinyx_downloads (id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES krinyx_users(id) ON DELETE CASCADE, query TEXT NOT NULL, status TEXT NOT NULL, filename TEXT, error TEXT, progress INTEGER NOT NULL DEFAULT 0, format TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()); CREATE TABLE IF NOT EXISTS krinyx_library (id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES krinyx_users(id) ON DELETE CASCADE, source_id TEXT NOT NULL, title TEXT NOT NULL, artist TEXT, thumbnail TEXT, duration TEXT, source_url TEXT NOT NULL, local_status TEXT NOT NULL DEFAULT 'absent', storage_key TEXT, last_played_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(user_id, source_id)); CREATE TABLE IF NOT EXISTS krinyx_stream_queue (id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES krinyx_users(id) ON DELETE CASCADE, source_id TEXT NOT NULL, track JSONB NOT NULL, position INTEGER NOT NULL DEFAULT 0, mode TEXT NOT NULL DEFAULT 'stream', status TEXT NOT NULL DEFAULT 'queued', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(user_id, source_id));`);
  await pool.query(`CREATE INDEX IF NOT EXISTS krinyx_downloads_user_idx ON krinyx_downloads(user_id, created_at DESC); CREATE INDEX IF NOT EXISTS krinyx_library_user_idx ON krinyx_library(user_id, updated_at DESC); CREATE INDEX IF NOT EXISTS krinyx_stream_queue_user_idx ON krinyx_stream_queue(user_id, position);`);
  await pool.query(`ALTER TABLE krinyx_sessions ADD COLUMN IF NOT EXISTS device_id TEXT NOT NULL DEFAULT 'legacy'; CREATE INDEX IF NOT EXISTS krinyx_sessions_device_idx ON krinyx_sessions(user_id, device_id);`);
  await pool.query(`DELETE FROM krinyx_sessions WHERE expires_at <= NOW()`);
}

export async function getCurrentUser(req: any) {
  if (!pool) return undefined;
  const token = sessionToken(req);
  if (!token) return undefined;
  try { const result = await pool.query(`SELECT u.id, u.email, u.name FROM krinyx_sessions s JOIN krinyx_users u ON u.id = s.user_id WHERE s.token = $1 AND s.expires_at > NOW()`, [token]); return result.rows[0]; } catch (error: any) { console.error("[Auth status] PostgreSQL indisponible :", error?.message || error); return undefined; }
}

export const authRouter = Router();
authRouter.get("/status", async (req, res) => { res.json({ configured: Boolean(pool), user: await getCurrentUser(req) || null }); });
authRouter.post("/register", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "La base de données n'est pas configurée. Ajoutez DATABASE_URL." });
  const email = String(req.body?.email || "").trim().toLowerCase();
  const name = String(req.body?.name || "").trim().slice(0, 80);
  const password = String(req.body?.password || "");
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254 || !name || name.length > 80 || password.length < 12 || password.length > 256 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) return res.status(400).json({ error: "Nom, email valide et mot de passe robuste requis." });
  try {
    const id = crypto.randomUUID();
    await pool.query(`INSERT INTO krinyx_users (id, email, name, password_hash, email_verified) VALUES ($1, $2, $3, $4, $5)`, [id, email, name, hashPassword(password), !emailConfigured()]);
    if (!emailConfigured()) return res.status(201).json({ verificationRequired: false, user: { id, email, name } });
    const rawToken = makeEmailToken();
    await pool.query(`INSERT INTO krinyx_email_verification_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '24 hours')`, [hashEmailToken(rawToken), id]);
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
    await sendVerificationEmail(email, name, `${baseUrl}/api/auth/verify-email?token=${rawToken}`);
    res.status(201).json({ verificationRequired: true, message: "Un email de vérification vient d'être envoyé." });
  } catch (error: any) { res.status(error?.code === "23505" ? 409 : 500).json({ error: error?.code === "23505" ? "Cet email est déjà utilisé." : "Impossible de créer le compte." }); }
});
authRouter.post("/login", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "La base de données n'est pas configurée. Ajoutez DATABASE_URL." });
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const attemptKey = `${req.ip || "unknown"}:${email}`;
  const current = loginAttempts.get(attemptKey); const now = Date.now();
  if (current && now - current.started < 15 * 60_000 && current.count >= 8) return res.status(429).json({ error: "Trop de tentatives. Réessayez plus tard." });
  const result = await pool.query(`SELECT id, email, name, password_hash, email_verified FROM krinyx_users WHERE email = $1`, [email]);
  if (!result.rows[0] || !verifyPassword(password, result.rows[0].password_hash)) { const item = current && now - current.started < 15 * 60_000 ? current : { count: 0, started: now }; item.count += 1; loginAttempts.set(attemptKey, item); return res.status(401).json({ error: "Email ou mot de passe incorrect." });
  }
  loginAttempts.delete(attemptKey);
  if (!result.rows[0].email_verified) return res.status(403).json({ error: "Vérifiez votre adresse email avant de vous connecter." });
  const token = crypto.randomBytes(32).toString("hex");
  const currentDevice = deviceId(req); const devices = await pool.query(`SELECT DISTINCT device_id FROM krinyx_sessions WHERE user_id=$1 AND expires_at>NOW()`, [result.rows[0].id]); if (!devices.rows.some(row => row.device_id === currentDevice) && devices.rows.length >= 3) { await pool.query(`DELETE FROM krinyx_sessions WHERE user_id=$1 AND device_id=(SELECT device_id FROM krinyx_sessions WHERE user_id=$1 ORDER BY created_at ASC LIMIT 1)`, [result.rows[0].id]); }
  await pool.query(`INSERT INTO krinyx_sessions (token, user_id, device_id, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '30 days')`, [token, result.rows[0].id, currentDevice]);
  res.setHeader("Set-Cookie", [cookieOptions(60 * 60 * 24 * 30).replace("TOKEN", token), `krinyx_device=${currentDevice}; SameSite=Lax; Path=/`]);
  res.json({ user: { id: result.rows[0].id, email, name: result.rows[0].name } });
});
authRouter.post("/logout", async (req, res) => { if (pool) { const token = sessionToken(req); if (token) await pool.query(`DELETE FROM krinyx_sessions WHERE token = $1`, [token]); } res.setHeader("Set-Cookie", cookieOptions(0).replace("TOKEN", "")); res.json({ ok: true }); });
authRouter.post("/logout-all", async (req, res) => { if (!pool) return res.status(503).json({ error: "Base de données non configurée." }); const user = await getCurrentUser(req); if (!user) return res.status(401).json({ error: "Connexion requise." }); await pool.query(`DELETE FROM krinyx_sessions WHERE user_id=$1`, [user.id]); res.setHeader("Set-Cookie", cookieOptions(0).replace("TOKEN", "")); res.json({ ok: true }); });
authRouter.get("/verify-email", async (req, res) => { if (!pool) return res.status(503).send("Base de données non configurée."); const rawToken = String(req.query.token || ""); if (!rawToken) return res.status(400).send("Lien de vérification invalide."); const result = await pool.query(`SELECT user_id FROM krinyx_email_verification_tokens WHERE token_hash = $1 AND expires_at > NOW()`, [hashEmailToken(rawToken)]); if (!result.rows[0]) return res.status(400).send("Ce lien est invalide ou expiré."); await pool.query(`UPDATE krinyx_users SET email_verified = TRUE WHERE id = $1`, [result.rows[0].user_id]); await pool.query(`DELETE FROM krinyx_email_verification_tokens WHERE token_hash = $1`, [hashEmailToken(rawToken)]); res.redirect("/?email=verified"); });

async function requireUser(req: any, res: any) { const user = await getCurrentUser(req); if (!user) { res.status(401).json({ error: "Connectez-vous pour accéder à votre bibliothèque." }); return undefined; } return user; }
export const libraryRouter = Router();
libraryRouter.get("/", async (req, res) => { if (!pool) return res.status(503).json({ error: "Base de données non configurée." }); const user = await requireUser(req, res); if (!user) return; const favorites = await pool.query(`SELECT track FROM krinyx_favorites WHERE user_id = $1 ORDER BY created_at DESC`, [user.id]); const playlists = await pool.query(`SELECT p.id, p.name, p.imported, p.image, COALESCE(json_agg(pt.track ORDER BY pt.position) FILTER (WHERE pt.track IS NOT NULL), '[]') AS tracks FROM krinyx_playlists p LEFT JOIN krinyx_playlist_tracks pt ON pt.playlist_id = p.id WHERE p.user_id = $1 GROUP BY p.id ORDER BY p.updated_at DESC`, [user.id]); res.json({ favorites: favorites.rows.map(row => row.track), playlists: playlists.rows }); });
libraryRouter.post("/favorites", async (req, res) => { if (!pool) return res.status(503).json({ error: "Base de données non configurée." }); const user = await requireUser(req, res); if (!user) return; const track = req.body?.track; if (!track?.id) return res.status(400).json({ error: "Titre invalide." }); const exists = await pool.query(`SELECT 1 FROM krinyx_favorites WHERE user_id = $1 AND track_id = $2`, [user.id, track.id]); if (exists.rowCount) await pool.query(`DELETE FROM krinyx_favorites WHERE user_id = $1 AND track_id = $2`, [user.id, track.id]); else await pool.query(`INSERT INTO krinyx_favorites (user_id, track_id, track) VALUES ($1, $2, $3)`, [user.id, track.id, JSON.stringify(track)]); res.json({ favorite: !exists.rowCount }); });
libraryRouter.post("/playlists", async (req, res) => { if (!pool) return res.status(503).json({ error: "Base de données non configurée." }); const user = await requireUser(req, res); if (!user) return; const playlist = req.body; const id = playlist.id || crypto.randomUUID(); await pool.query(`INSERT INTO krinyx_playlists (id, user_id, name, imported, image) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, imported = EXCLUDED.imported, image = EXCLUDED.image, updated_at = NOW()`, [id, user.id, String(playlist.name || "Ma playlist").slice(0, 120), Boolean(playlist.imported), playlist.image || null]); for (const [position, track] of (playlist.tracks || []).entries()) if (track?.id) await pool.query(`INSERT INTO krinyx_playlist_tracks (playlist_id, track_id, track, position) VALUES ($1, $2, $3, $4) ON CONFLICT (playlist_id, track_id) DO UPDATE SET track = EXCLUDED.track, position = EXCLUDED.position`, [id, track.id, JSON.stringify(track), position]); res.status(201).json({ id }); });
libraryRouter.post("/migrate", async (req, res) => { if (!pool) return res.status(503).json({ error: "Base de données non configurée." }); const user = await requireUser(req, res); if (!user) return; const favorites = Array.isArray(req.body?.favorites) ? req.body.favorites : []; for (const track of favorites) if (track?.id) await pool.query(`INSERT INTO krinyx_favorites (user_id, track_id, track) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [user.id, track.id, JSON.stringify(track)]); for (const playlist of Array.isArray(req.body?.playlists) ? req.body.playlists : []) { const id = playlist.id || crypto.randomUUID(); await pool.query(`INSERT INTO krinyx_playlists (id, user_id, name, imported, image) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`, [id, user.id, String(playlist.name || "Ma playlist").slice(0, 120), Boolean(playlist.imported), playlist.image || null]); for (const [position, track] of (playlist.tracks || []).entries()) if (track?.id) await pool.query(`INSERT INTO krinyx_playlist_tracks (playlist_id, track_id, track, position) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, [id, track.id, JSON.stringify(track), position]); } res.json({ ok: true }); });

// Bibliothèque hybride et file de streaming : toutes les requêtes sont filtrées par l'utilisateur de session.
libraryRouter.get("/hybrid/library", async (req, res) => { if (!pool) return res.status(503).json({ error: "Base de données non configurée." }); const user = await requireUser(req, res); if (!user) return; const result = await pool.query(`SELECT source_id, title, artist, thumbnail, duration, source_url, local_status, storage_key, last_played_at FROM krinyx_library WHERE user_id=$1 ORDER BY updated_at DESC`, [user.id]); res.json({ items: result.rows }); });
libraryRouter.post("/hybrid/library", async (req, res) => { if (!pool) return res.status(503).json({ error: "Base de données non configurée." }); const user = await requireUser(req, res); if (!user) return; const item = req.body || {}; if (!item.sourceId || !item.title || !item.sourceUrl) return res.status(400).json({ error: "Métadonnées du titre incomplètes." }); const id = crypto.randomUUID(); await pool.query(`INSERT INTO krinyx_library (id,user_id,source_id,title,artist,thumbnail,duration,source_url,local_status,storage_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (user_id,source_id) DO UPDATE SET title=EXCLUDED.title, artist=EXCLUDED.artist, thumbnail=EXCLUDED.thumbnail, duration=EXCLUDED.duration, source_url=EXCLUDED.source_url, updated_at=NOW()`, [id,user.id,String(item.sourceId),String(item.title),item.artist || null,item.thumbnail || null,item.duration || null,String(item.sourceUrl),item.localStatus || "absent",item.storageKey || null]); res.status(201).json({ ok: true }); });
libraryRouter.get("/hybrid/queue", async (req, res) => { if (!pool) return res.status(503).json({ error: "Base de données non configurée." }); const user = await requireUser(req, res); if (!user) return; const result = await pool.query(`SELECT id, source_id, track, position, mode, status FROM krinyx_stream_queue WHERE user_id=$1 ORDER BY position ASC`, [user.id]); res.json({ queue: result.rows }); });
libraryRouter.post("/hybrid/queue", async (req, res) => { if (!pool) return res.status(503).json({ error: "Base de données non configurée." }); const user = await requireUser(req, res); if (!user) return; const track = req.body?.track; if (!track?.id || !track?.title) return res.status(400).json({ error: "Titre invalide." }); const position = Number(req.body?.position || 0); await pool.query(`INSERT INTO krinyx_stream_queue (id,user_id,source_id,track,position,mode,status) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (user_id,source_id) DO UPDATE SET position=EXCLUDED.position, mode=EXCLUDED.mode, status=EXCLUDED.status`, [crypto.randomUUID(),user.id,track.id,JSON.stringify(track),position,req.body?.mode === "download" ? "download" : "stream","queued"]); res.status(201).json({ ok: true }); });
libraryRouter.delete("/hybrid/queue/:sourceId", async (req, res) => { if (!pool) return res.status(503).json({ error: "Base de données non configurée." }); const user = await requireUser(req, res); if (!user) return; await pool.query(`DELETE FROM krinyx_stream_queue WHERE user_id=$1 AND source_id=$2`, [user.id,req.params.sourceId]); res.json({ ok: true }); });
