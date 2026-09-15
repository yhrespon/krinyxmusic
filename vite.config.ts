import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(rootDir, "frontend");
const pagesDir = path.resolve(rootDir, "pages");

export default defineConfig({
  root: pagesDir,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": frontendDir,
      "@shared": path.resolve(rootDir, "backend"),
    },
  },
  build: {
    outDir: path.resolve(rootDir, "dist/public"),
    emptyOutDir: true,
  },
});
