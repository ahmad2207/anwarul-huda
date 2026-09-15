import { configDefaults, defineConfig } from "vitest/config";
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
    // Many test files are integration tests sharing one real Postgres
    // database rather than a mock. Running test files in parallel means
    // separate processes each with their own Prisma connection pool
    // racing the same live database. Advisory locks (lib/advisory-lock.ts)
    // correctly serialise this in production, where every request goes
    // through one Prisma client in one Next.js server process, but
    // proved genuinely flaky here across truly separate processes
    // contending for the same global sequence (a receipt number for the
    // current real year) at once. Running files sequentially removes
    // that cross-process race, which is a test methodology artifact, not
    // a bug in the app.
    fileParallelism: false,
    // e2e/*.spec.ts also matches vitest's own default *.spec.ts pattern,
    // but those files use Playwright's test runner, not vitest's, and
    // are run separately with `pnpm test:e2e`.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
