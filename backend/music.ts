import { Router } from "express";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import youtubedl from "yt-dlp-exec";
import yts, { type Video } from "yt-search";
import ffmpegPath from "ffmpeg-static";
import { getCurrentUser, pool } from "./auth.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOWNLOAD_DIR = path.resolve(__dirname, "..", "downloads");
const DOWNLOAD_TTL_MS = 24 * 60 * 60 * 1000;
const SUPPORTED_BROWSER_NAMES = new Set(["chrome", "chromium", "edge", "firefox", "opera", "safari", "brave", "vivaldi", "whale"]);

type DownloadJob = {
  id: string;
  userId: string;
  query: string;
  status: "queued" | "downloading" | "complete" | "error";
  filename?: string;
  error?: string;
  progress: number;
  format: string;
  createdAt: string;
};

const jobs = new Map<string, DownloadJob>();
const activeDownloadsByUser = new Map<string, number>();
let activeDownloads = 0;
const searchCache = new Map<string, { expiresAt: number; tracks: ReturnType<typeof asTrack>[] }>();

function dbJob(row: any): DownloadJob { return { id: row.id, userId: row.user_id, query: row.query, status: row.status, filename: row.filename || undefined, error: row.error || undefined, progress: row.progress, format: row.format, createdAt: new Date(row.created_at).toISOString() }; }
async function persistJob(job: DownloadJob) { if (pool) await pool.query(`UPDATE krinyx_downloads SET status=$1, filename=$2, error=$3, progress=$4 WHERE id=$5 AND user_id=$6`, [job.status, job.filename || null, job.error || null, job.progress, job.id, job.userId]); }

function cleanTitle(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "").replace(/[. ]+$/g, "").trim().slice(0, 120) || "krinyx-track";
}

async function purgeExpiredDownloads() {
  try {
    await mkdir(DOWNLOAD_DIR, { recursive: true });
    const now = Date.now();
    const files = await readdir(DOWNLOAD_DIR);
    await Promise.all(files.map(async file => {
      const filePath = path.join(DOWNLOAD_DIR, file);
      try { if (now - (await stat(filePath)).mtimeMs >= DOWNLOAD_TTL_MS) await rm(filePath, { force: true }); } catch {}
    }));
  } catch (error) { console.error("[Music cleanup]", error); }
}
void purgeExpiredDownloads();
setInterval(() => { void purgeExpiredDownloads(); }, 60 * 60 * 1000).unref();

function asTrack(video: Video) {
  return {
    id: video.videoId,
    title: video.title,
    artist: video.author?.name || "Artiste inconnu",
    album: "Résultat musical",
    duration: video.timestamp || "—",
    seconds: video.seconds,
    thumbnail: video.thumbnail,
    url: video.url,
    views: video.views,
  };
}

function configuredBrowser() {
  const value = process.env.YTDLP_COOKIES_FROM_BROWSER?.trim().toLowerCase();
  return value && SUPPORTED_BROWSER_NAMES.has(value) ? value : undefined;
}

function getDownloadError(error: unknown) {
  const details = error && typeof error === "object" && "stderr" in error ? String(error.stderr || "") : "";
  const raw = `${details}\n${error instanceof Error ? error.message : ""}`.trim();
  if (/429|too many requests|not a bot|sign in to confirm/i.test(raw)) {
    return "YouTube a bloqué cette requête (HTTP 429). Configurez YTDLP_COOKIES_FILE ou YTDLP_COOKIES_FROM_BROWSER sur la machine qui exécute le serveur, puis redémarrez-le.";
  }
  if (/no supported javascript runtime|javascript runtime/i.test(raw)) {
    return "yt-dlp ne trouve aucun runtime JavaScript. Installez Deno, Node.js ou Bun sur la machine serveur et définissez YTDLP_JS_RUNTIME dans .env.";
  }
  if (/cookie|authentication|sign in/i.test(raw)) {
    return "YouTube demande une authentification. Utilisez un fichier cookies Netscape ou un navigateur configuré sur la machine serveur.";
  }
  if (/ffmpeg|postprocessor/i.test(raw)) {
    return "La conversion FFmpeg a échoué. Vérifiez YTDLP_FFMPEG_LOCATION ou l'installation de FFmpeg.";
  }
  return "Le téléchargement n’a pas pu être terminé. Vérifiez la source, le format choisi et réessayez.";
}

export const musicRouter = Router();

musicRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    ffmpeg: Boolean(process.env.YTDLP_FFMPEG_LOCATION?.trim() || ffmpegPath),
    cookiesConfigured: Boolean(process.env.YTDLP_COOKIES_FILE?.trim() || configuredBrowser()),
    cookiesSource: process.env.YTDLP_COOKIES_FILE?.trim() ? "file" : configuredBrowser() ? "browser" : "none",
    jsRuntimeConfigured: Boolean(process.env.YTDLP_JS_RUNTIME?.trim()),
    mediaStorage: "server-temporary-24h-and-local-client",
  });
});

musicRouter.get("/search", async (req, res) => {
  const query = String(req.query.q || "").trim();
  if (!query) return res.status(400).json({ error: "Une recherche est requise." });
  if (query.length > 120) return res.status(400).json({ error: "Recherche trop longue." });
  const cached = searchCache.get(query.toLowerCase()); if (cached && cached.expiresAt > Date.now()) return res.json({ query, tracks: cached.tracks });
  try {
    const result = await yts(query);
    const tracks = result.videos.slice(0, 20).map(asTrack); searchCache.set(query.toLowerCase(), { expiresAt: Date.now() + 60_000, tracks }); res.json({ query, tracks });
  } catch (error) {
    console.error("[Music search]", error);
    res.status(502).json({ error: "La recherche musicale a échoué." });
  }
});

musicRouter.get("/jobs", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Connexion requise." });
  if (pool) { const result = await pool.query(`SELECT id, user_id, query, status, filename, error, progress, format, created_at FROM krinyx_downloads WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`, [user.id]); return res.json({ jobs: result.rows.map(dbJob) }); }
  res.json({ jobs: Array.from(jobs.values()).filter(job => job.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
});

musicRouter.get("/jobs/:id", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(404).json({ error: "Téléchargement introuvable." });
  const job = pool ? ((await pool.query(`SELECT id, user_id, query, status, filename, error, progress, format, created_at FROM krinyx_downloads WHERE id=$1 AND user_id=$2`, [req.params.id, user.id])).rows[0] ? dbJob((await pool.query(`SELECT id, user_id, query, status, filename, error, progress, format, created_at FROM krinyx_downloads WHERE id=$1 AND user_id=$2`, [req.params.id, user.id])).rows[0]) : undefined) : jobs.get(req.params.id);
  if (!job || job.userId !== user.id) return res.status(404).json({ error: "Téléchargement introuvable." });
  res.json(job);
});

musicRouter.get("/files/:name", async (req, res) => {
  const filename = path.basename(req.params.name);
  const filePath = path.join(DOWNLOAD_DIR, filename);
  try {
    await stat(filePath);
    res.download(filePath, filename);
  } catch {
    res.status(404).json({ error: "Fichier non disponible." });
  }
});

musicRouter.get("/stream", async (req, res) => {
  const user = await getCurrentUser(req); if (!user) return res.status(401).json({ error: "Connexion requise." });
  const url = String(req.query.url || ""); if (!url || !/^https?:\/\//.test(url)) return res.status(400).json({ error: "URL de source invalide." });
  try { const parsed = new URL(url); if (parsed.username || parsed.password) return res.status(400).json({ error: "URL de source invalide." }); } catch { return res.status(400).json({ error: "URL de source invalide." }); }
  const child: any = youtubedl(url, ({ format: "bestaudio/best", output: "-", noPlaylist: true, quiet: true, retries: 2, socketTimeout: 30, forceIpv4: true }) as any);
  res.setHeader("Content-Type", "audio/webm"); res.setHeader("Cache-Control", "private, no-store"); res.setHeader("Content-Disposition", "inline");
  child.stdout.pipe(res); child.stderr.on("data", (data: Buffer) => console.error("[Music stream]", String(data).slice(0, 300))); req.on("close", () => { if (!child.killed) child.kill("SIGTERM"); });
});

musicRouter.post("/download", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Connexion requise." });
  const { url, title, format = "mp3", quality = "192", allowCookieAccess = false } = req.body || {};
  if (!url || typeof url !== "string") return res.status(400).json({ error: "URL ou titre requis." });
  if (!/^https?:\/\//.test(url)) return res.status(400).json({ error: "La source doit être une URL." });
  try { const parsed = new URL(url); const host = parsed.hostname.toLowerCase(); const blocked = host === "localhost" || host === "::1" || host === "0.0.0.0" || /^(10|127)\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host); if (!parsed.hostname || parsed.username || parsed.password || blocked) return res.status(400).json({ error: "URL de source invalide." }); } catch { return res.status(400).json({ error: "URL de source invalide." }); }
  if (!["mp3", "m4a", "opus", "mp4", "webm"].includes(format)) return res.status(400).json({ error: "Format audio ou vidéo invalide." });
  if (!["128", "192", "256", "320"].includes(String(quality))) return res.status(400).json({ error: "Qualité audio invalide." });

  const id = crypto.randomUUID();
  const job: DownloadJob = { id, userId: user.id, query: title || url, status: "queued", progress: 0, format, createdAt: new Date().toISOString() };
  const active = activeDownloadsByUser.get(user.id) || 0;
  if (active >= 2 || activeDownloads >= 8) return res.status(429).json({ error: "La file de téléchargement est temporairement pleine. Réessayez dans un instant." });
  jobs.set(id, job);
  activeDownloadsByUser.set(user.id, active + 1);
  activeDownloads += 1;
  if (pool) await pool.query(`INSERT INTO krinyx_downloads (id, user_id, query, status, progress, format, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [id, user.id, job.query, job.status, job.progress, job.format, job.createdAt]);
  res.status(202).json(job);

  void (async () => {
    try {
      await mkdir(DOWNLOAD_DIR, { recursive: true });
      job.status = "downloading";
      job.progress = 8;
      await persistJob(job);
      const isVideo = format === "mp4" || format === "webm";
      const cookiesFile = allowCookieAccess ? process.env.YTDLP_COOKIES_FILE?.trim() : undefined;
      const browser = allowCookieAccess ? configuredBrowser() : undefined;
      const jsRuntime = process.env.YTDLP_JS_RUNTIME?.trim();
      const configuredFfmpeg = process.env.YTDLP_FFMPEG_LOCATION?.trim() || ffmpegPath || undefined;
      const output = path.join(DOWNLOAD_DIR, `${cleanTitle(title || "krinyx-track")} [${id}].%(ext)s`);

      await youtubedl(url, ({
        ...(isVideo ? { format: "bestvideo*+bestaudio/best", mergeOutputFormat: format } : { extractAudio: true, audioFormat: format, audioQuality: quality }),
        output,
        noPlaylist: true,
        addMetadata: true,
        retries: 3,
        fragmentRetries: 3,
        retrySleep: "linear=1::3",
        socketTimeout: 30,
        maxFilesize: "100M",
        concurrentFragments: 1,
        forceIpv4: true,
        postprocessorArgs: { FFmpegMetadata: ["-metadata", "comment=", "-metadata", "purl=", "-metadata", "description="] } as any,
        ...(!isVideo ? { embedThumbnail: true } : {}),
        ...(cookiesFile ? { cookies: cookiesFile } : {}),
        ...(browser ? { cookiesFromBrowser: [browser] } : {}),
        ...(jsRuntime ? { jsRuntimes: jsRuntime } : {}),
        ...(configuredFfmpeg ? { ffmpegLocation: configuredFfmpeg } : {}),
      }) as any);
      job.progress = 96;
      job.filename = path.basename(output).replace("%(ext)s", format);
      job.status = "complete";
      job.progress = 100;
      await persistJob(job);
    } catch (error) {
      job.status = "error";
      job.error = getDownloadError(error);
      await persistJob(job);
      console.error("[Music download]", error);
    } finally {
      activeDownloadsByUser.set(user.id, Math.max(0, (activeDownloadsByUser.get(user.id) || 1) - 1));
      activeDownloads = Math.max(0, activeDownloads - 1);
    }
  })();
});
