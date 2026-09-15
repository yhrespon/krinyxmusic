import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const music = readFileSync(path.join(root, "backend", "music.ts"), "utf8");
const index = readFileSync(path.join(root, "backend", "index.ts"), "utf8");
const auth = readFileSync(path.join(root, "backend", "auth.ts"), "utf8");
const worker = readFileSync(path.join(root, "pages", "sw.js"), "utf8");

describe("security invariants", () => {
  it("requires CSRF on mutating requests", () => expect(index).toContain("x-csrf-token"));
  it("limits active account devices", () => expect(auth).toContain("devices.rows.length >= 3"));
  it("blocks private URL targets", () => { expect(music).toContain("localhost"); expect(music).toMatch(/169\\?\.254/); });
  it("does not expose a server file route", () => expect(music).not.toContain('musicRouter.get("/files/:name"'));
  it("does not cache private APIs", () => expect(worker).toContain('url.pathname.startsWith("/api/")'));
  it("hardens HTTP timeouts and headers", () => { expect(index).toContain("headersTimeout"); expect(index).toContain("Strict-Transport-Security"); expect(index).toContain("Cross-Origin-Opener-Policy"); });
  it("limits database resources", () => { const auth = readFileSync(path.join(root, "backend", "auth.ts"), "utf8"); expect(auth).toContain("statement_timeout"); expect(auth).toContain("connectionTimeoutMillis"); });
});
