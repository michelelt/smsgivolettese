import { defineConfig } from "@playwright/test";

// Playwright does not read .env files: load .env.local, then .env.example for the demo E2E_* defaults.
for (const f of [".env.local", ".env.example"]) {
  try {
    process.loadEnvFile(f); // never overrides vars already set
  } catch {}
}

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3000" },
  // Expects `make dev` (supabase + api + web) to be running.
});
