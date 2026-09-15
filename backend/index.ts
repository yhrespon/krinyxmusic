import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createServer as createHttpsServer } from "https";
import { readFileSync } from "node:fs";
import net from "net";
import crypto from "node:crypto";
import { musicRouter } from "./music.ts";
import { spotifyRouter } from "./spotify.ts";
import { authRouter, ensureAuthTables, getCurrentUser, libraryRouter } from "./auth.ts";
import { serveStatic, setupVite } from "./server-vite.ts";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, () => server.close(() => resolve(true)));
  });
}

async function findAvailablePort(startPort: number) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const tlsCert = process.env.TLS_CERT_FILE?.trim();
  const tlsKey = process.env.TLS_KEY_FILE?.trim();
  const tlsEnabled = Boolean(tlsCert && tlsKey);
  const server = tlsEnabled ? createHttpsServer({ cert: readFileSync(tlsCert!), key: readFileSync(tlsKey!) }, app) : createServer(app);
  const isBundledProduction = import.meta.url.includes("/dist/") || import.meta.url.includes("\\dist\\");
  if (process.env.TRUST_PROXY === "true") app.set("trust proxy", 1);
  app.disable("x-powered-by");
  server.requestTimeout = 45_000;
  server.headersTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  server.maxRequestsPerSocket = 100;
  app.use((req, res, next) => { const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim(); const secureRequest = tlsEnabled || req.secure || forwardedProto === "https"; if (process.env.NODE_ENV === "production" && process.env.FORCE_HTTPS !== "false" && !secureRequest) { const host = req.get("host"); if (host) return res.redirect(308, `https://${host}${req.originalUrl}`); } res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("X-Frame-Options", "DENY"); res.setHeader("Referrer-Policy", "no-referrer"); res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()"); res.setHeader("Cross-Origin-Opener-Policy", "same-origin"); res.setHeader("Cross-Origin-Resource-Policy", "same-origin"); res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' https: data: blob:; media-src 'self' blob:; frame-src 'self' https://www.youtube-nocookie.com; connect-src 'self' https:; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests"); if (process.env.NODE_ENV === "production" && secureRequest) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains"); next(); });
  app.use((req, res, next) => { const cookies = String(req.headers.cookie || ""); const found = cookies.match(/(?:^|;\s*)krinyx_csrf=([^;]+)/)?.[1]; const csrf = found || crypto.randomBytes(24).toString("hex"); if (!found) res.append("Set-Cookie", `krinyx_csrf=${csrf}; SameSite=Lax; Path=/`); if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) { const origin = req.headers.origin; const host = `${req.protocol}://${req.get("host")}`; if ((origin && origin !== host) || req.headers["x-csrf-token"] !== csrf) return res.status(403).json({ error: "Protection CSRF : requête refusée." }); } next(); });
  const requestCounts = new Map<string, { count: number; started: number }>();
  app.use((req, res, next) => { const key = req.ip || "unknown"; const now = Date.now(); const item = requestCounts.get(key); if (!item || now - item.started > 60_000) requestCounts.set(key, { count: 1, started: now }); else { item.count += 1; if (item.count > 240) return res.status(429).json({ error: "Trop de requêtes. Réessayez dans une minute." }); } if (requestCounts.size > 20_000) for (const [ip, value] of requestCounts) if (now - value.started > 60_000) requestCounts.delete(ip); next(); });
  app.use((req, res, next) => { const suspicious = /\.\.(?:%2f|%5c|[\\/])|<script|union\s+select|\b(or|and)\s+1\s*=\s*1|\0/i.test(`${req.originalUrl} ${req.headers["user-agent"] || ""}`); if (suspicious) console.warn("[Security event] suspicious request", { method: req.method, path: req.path, ip: req.ip }); next(); });

  app.use(express.json({ limit: "256kb" }));
  app.use(express.urlencoded({ extended: false, limit: "32kb" }));
  app.use((req, res, next) => { res.on("finish", () => { if (res.statusCode >= 400) console.warn("[Security response]", { status: res.statusCode, method: req.method, path: req.path, ip: req.ip }); }); next(); });
  const privateApi = async (req: any, res: any, next: any) => { if (!await getCurrentUser(req)) return res.status(401).json({ error: "Connexion requise." }); next(); };
  app.use("/api/music", privateApi, musicRouter);
  app.use("/api/spotify", privateApi, spotifyRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/library", libraryRouter);
  app.use("/api", (_req, res) => res.status(404).json({ error: "Route API introuvable." }));
  app.use((error: any, _req: any, res: any, _next: any) => { console.error("[Server error]", error?.message || "unknown"); if (res.headersSent) return; res.status(Number(error?.statusCode) >= 400 && Number(error?.statusCode) < 500 ? Number(error.statusCode) : 500).json({ error: "Une erreur interne est survenue." }); });
  try { await ensureAuthTables(); } catch (error: any) { console.error("[PostgreSQL startup] Connexion impossible. Vérifiez DATABASE_URL, le réseau, le pare-feu et l’état de la base."); console.error(error); }

  if (process.env.NODE_ENV === "development" && !isBundledProduction) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = Number(process.env.PORT || 3000);
  const port = await findAvailablePort(preferredPort);
  server.listen(port, () => {
    console.log(`Krinyx Music running on ${tlsEnabled ? "https" : "http"}://localhost:${port}`);
  });
}

startServer().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
