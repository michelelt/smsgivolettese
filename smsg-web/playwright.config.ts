import { defineConfig } from "@playwright/test";

// Playwright does not read .env files: load .env.local, then .env.example for the demo E2E_* defaults.
for (const f of [".env.local", ".env.example"]) {
  try {
    process.loadEnvFile(f); // never overrides vars already set
  } catch {}
}

export default defineConfig({
  testDir: "./e2e",
  retries: 1, // dev-server recompiles (hot reload) cause one-off timeouts
  workers: 3, // `next dev` compiles on demand: more workers make timing-sensitive tests flaky
  globalSetup: "./e2e/global-setup.ts",
  use: { baseURL: "http://localhost:3000" },
  // Expects `make dev` (supabase + api + web) to be running.
});
