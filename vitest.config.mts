import { defineConfig } from "vitest/config";
import path from "node:path";
import fs from "node:fs";

// A couple of lib tests are integration tests against the real local
// Postgres database (member number generation and duplicate matching both
// need real rows and, for the number generator, a real transaction).
// Vitest does not load .env on its own the way Next.js does, so read it
// here rather than adding a dotenv dependency for one file.
function loadDotEnv(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(filePath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

export default defineConfig({
  test: {
    environment: "node",
    env: loadDotEnv(path.resolve(import.meta.dirname, ".env")),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
