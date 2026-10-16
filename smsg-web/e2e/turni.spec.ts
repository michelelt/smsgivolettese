import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { addDays, dayLabel, mondayOf, today } from "../lib/dates";

// Needs `make dev` with the seeded local database (shift types, demo volunteer).
const env = (k: string) => process.env[k]!;

async function login(page: Page, email: string) {
  await page.goto("/accedi");
  const form = page.getByRole("form", { name: "Entra con la password" });
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(env("E2E_PASSWORD"));
  await form.getByRole("button", { name: "Entra" }).click();
  await page.waitForURL("**/gestione");
}

// Far-away random week and Monday: reruns do not collide with earlier commitments.
const shiftDay = addDays(
  mondayOf(today()),
  7 * (2 + Math.floor(Math.random() * 50)),
);

test.describe.configure({ mode: "serial" });

test("volunteer enters weekly availability", async ({ page }) => {
  await login(page, env("E2E_VOLUNTEER_EMAIL"));
  await page.goto("/gestione/disponibilita");
  const mon = page
    .getByRole("group", { name: "Lunedì" })
    .getByRole("button", { name: "Mattina" });
  await expect(page.getByText("Caricamento…")).toHaveCount(0);
  // Off then on: the save button needs a change even on reruns.
  if ((await mon.getAttribute("aria-pressed")) === "true") await mon.click();
  await mon.click();
  await expect(mon).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Salva le disponibilità" }).click();
  await expect(page.getByText("Disponibilità salvate")).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole("group", { name: "Lunedì" })
      .getByRole("button", { name: "Mattina" }),
  ).toHaveAttribute("aria-pressed", "true");

  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(r.violations).toEqual([]);
});

test("staff creates a shift and assigns the volunteer", async ({ page }) => {
  await login(page, env("E2E_STAFF_EMAIL"));
  await page.goto(`/gestione/turni?week=${shiftDay}`);
  await page.getByRole("button", { name: "Nuovo turno" }).click();
  const dlg = page.getByRole("dialog", { name: "Nuovo turno" });
  await dlg.getByLabel("Tipo di turno").selectOption({ index: 1 });
  await dlg.getByLabel("Giorno").fill(shiftDay);
  await dlg.getByLabel("Dalle", { exact: true }).fill("09:00");
  await dlg.getByLabel("Alle", { exact: true }).fill("11:00");
  await dlg.getByRole("button", { name: "Salva" }).click();
  await expect(page.getByText("Turno creato")).toBeVisible();
  await expect(page.getByText("✗ Scoperto")).toBeVisible();

  await page.getByRole("button", { name: /^Assegna volontari/ }).click();
  const assign = page.getByRole("dialog", { name: /^Assegna:/ });
  await assign.getByRole("button", { name: /^Assegna Mario/ }).click();
  await expect(page.getByText(/Volontario assegnato/)).toBeVisible();
  await assign.getByRole("button", { name: "Chiudi" }).click();
  await expect(page.getByText("✓ Coperto")).toBeVisible();
});

test("volunteer confirms the commitment", async ({ page }) => {
  await login(page, env("E2E_VOLUNTEER_EMAIL"));
  const card = page
    .getByRole("listitem")
    .filter({ hasText: dayLabel(shiftDay) })
    .filter({ hasText: "dalle 09:00 alle 11:00" });
  await card.getByRole("button", { name: "Confermo" }).click();
  await expect(page.getByText("Grazie, impegno confermato")).toBeVisible();
  await expect(card.getByText("Confermato", { exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Confermo" })).toHaveCount(0);
});

// One login for all pages: many logins in a row hit the local auth rate limit.
test("axe (staff): phase 5 pages", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, env("E2E_STAFF_EMAIL"));
  for (const p of [
    "/gestione",
    "/gestione/turni",
    "/gestione/trasporti",
    "/gestione/trasporti?week=" + today(),
    "/gestione/trasporti/nuovo",
    "/gestione/volontari",
    "/gestione/mezzi",
    "/gestione/disponibilita",
  ]) {
    await page.goto(p);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Caricamento…")).toHaveCount(0);
    const r = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(r.violations, p).toEqual([]);
  }
});

test("turni never scrolls horizontally", async ({ page }) => {
  await login(page, env("E2E_STAFF_EMAIL"));
  for (const width of [320, 390, 768, 1024, 1280, 1440, 1536, 1920, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/gestione/turni");
    await expect(page.getByText("Caricamento…")).toHaveCount(0);
    const w = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      innerWidth,
    ]);
    expect.soft(w[0], `width ${width}`).toBeLessThanOrEqual(w[1]);
    for (const fs of [19, 25]) {
      await page.evaluate(
        (f) => (document.documentElement.style.fontSize = f + "px"),
        fs,
      );
      const out = await page.evaluate(() =>
        [...document.querySelectorAll("ol > li li button, ol > li li li")]
          .filter((e) => {
            const card = e
              .parentElement!.closest("li")!
              .getBoundingClientRect();
            const r = e.getBoundingClientRect();
            return r.right > card.right + 0.5 || r.left < card.left - 0.5;
          })
          .map((e) => e.textContent),
      );
      expect(out, `card overflow ${width}/${fs}`).toEqual([]);
    }
  }
});

test("staff registers a transport and opens its page", async ({ page }) => {
  await login(page, env("E2E_STAFF_EMAIL"));
  await page.goto("/gestione/trasporti/nuovo");
  await page
    .getByLabel("Cerca per nome, tessera, codice fiscale o telefono")
    .fill("Rossi");
  await page.getByRole("radio").first().check();
  await page.getByLabel("Data").fill(shiftDay);
  await page.getByLabel("Ora di partenza").fill("08:30");
  await page.getByLabel("Indirizzo di partenza").fill("Via Roma 1, Givoletto");
  await page.getByLabel("Destinazione").fill("Ospedale di Rivoli");
  await page.getByRole("button", { name: "Registra trasporto" }).click();
  await page.waitForURL(/\/gestione\/trasporti\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Da assegnare").first()).toBeVisible();
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(r.violations).toEqual([]);
  await page.getByRole("button", { name: "Assegna autista" }).click();
  await expect(
    page.getByRole("dialog", { name: "Assegna autista" }),
  ).toBeVisible();
});
