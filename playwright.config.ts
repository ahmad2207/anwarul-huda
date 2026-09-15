import { defineConfig, devices } from "@playwright/test";

// The critical flows named in Phase 7 (registration to approval, payment
// to receipt, disbursement approval, check-in), run against a real,
// disposable dev server and the real local database, the same one every
// integration test in lib/ already runs against. Not mocked: these are
// the flows where a real regression actually matters.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // tests within one file run in order, not that different files run in parallel
  // Different spec files sharing one worker, one browser, one dev server
  // process and one database is the point, the same reason
  // vitest.config.mts sets fileParallelism: false: fullyParallel alone
  // does not stop separate files running in separate workers at once,
  // which briefly caused all four specs to fail together against a
  // single dev server process buckling under four concurrent browsers.
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Reuses an already running `pnpm dev` if there is one (there usually
  // is, during development), otherwise starts one itself.
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
