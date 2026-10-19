import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { login } from "./session";

// Needs `make dev`; Turnstile uses Cloudflare's always-pass test keys (.env.example).
const env = (k: string) => process.env[k]!;

// The API allows 3 proposals per IP per hour: reset the local counter so reruns pass.
test.beforeAll(() =>
  execFileSync("docker", [
    "exec",
    "supabase_db_smsg",
    "psql",
    "-U",
    "postgres",
    "-c",
    "delete from public.rate_limit_hits where key like 'proposal%'",
  ]),
);

test("visitor proposes a news item, staff sees it and discards it", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const title = `Proposta E2E ${Date.now()}`;
  await page.goto("/proponi");
  // Fill inside the retry: input typed before hydration is wiped.
  await expect(async () => {
    await page.getByLabel("Il tuo nome").fill("Anna Prova");
    await page.getByLabel("Titolo").fill(title);
    await page
      .getByRole("textbox", { name: "Testo", exact: true })
      .fill("Una proposta scritta dal test.");
    // Test key: the widget resolves on its own; the submit may need a moment.
    await page.getByRole("button", { name: "Invia la proposta" }).click();
    await expect(page.getByText("Grazie! Abbiamo ricevuto")).toBeVisible({
      timeout: 4000,
    });
  }).toPass({ timeout: 40_000 });

  await login(page, env("E2E_STAFF_EMAIL"));
  await page.goto("/gestione/bacheca");
  await page.getByRole("button", { name: "Proposte" }).click();
  await page.getByRole("link", { name: `Apri la proposta: ${title}` }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  // Cleanup: discard it so the queue does not grow with reruns.
  await page.getByRole("button", { name: "Scarta" }).click();
  await page.getByRole("button", { name: "Sì, scarta" }).click();
  await expect(page.getByText("Proposta scartata")).toBeVisible();
});
