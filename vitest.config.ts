import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: rootDir,
  test: {
    include: ["tests/**/*.test.ts", "backend/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
    environment: "node",
    passWithNoTests: false,
  },
});
