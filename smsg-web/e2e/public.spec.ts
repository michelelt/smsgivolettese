import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
import { bookingDays } from "../lib/public/booking";
import { textSizeHash } from "../lib/csp";

// Bookings share one rate-limit bucket locally (ADR-040): run serially and reset it.
test.describe.configure({ mode: "serial" });
const clearRateLimit = () =>
  execSync(
    'docker exec supabase_db_smsg psql -U postgres -c "delete from public.rate_limit_hits"',
    { stdio: "ignore" },
  );

async function fillWizard(page: Page) {
  await page.goto("/prenota");
  await page.getByRole("button", { name: /^Misurazione pressione/ }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await page
    .getByRole("group", { name: "Giorni disponibili" })
    .getByRole("button")
    .first()
    .click();
  await page.getByRole("button", { name: "Avanti" }).click();
  const form = page.getByRole("form", { name: "I suoi dati" });
  await form.getByLabel("Nome", { exact: true }).fill("Maria");
  await form.getByLabel("Cognome").fill("Rossi");
  await form.getByLabel("Telefono").fill("333 1234567");
  await form.getByRole("button", { name: "Avanti" }).click();
  await expect(
    page.getByRole("heading", { name: "Controlli e confermi" }),
  ).toBeFocused();
}

const confirm = (page: Page) =>
  page.getByRole("button", { name: "Conferma la prenotazione" });
const tokenReady = (page: Page) =>
  expect(page.locator('[name="cf-turnstile-response"]')).not.toHaveValue("", {
    timeout: 20_000,
  });

test("phone is visible on every page and text size persists", async ({
  page,
}) => {
  await page.goto("/servizi");
  await expect(page.getByRole("link", { name: /Ci telefoni/ })).toBeVisible();
  await page.getByRole("button", { name: "Testo grande" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-text-size", "l");
  await expect(
    page.getByRole("button", { name: "Testo grande" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("public booking happy path", async ({ page }) => {
  clearRateLimit();
  await fillWizard(page);
  await expect(
    page.getByRole("link", { name: /^Leggi l.informativa/ }),
  ).toBeVisible();
  await tokenReady(page);
  await confirm(page).click();
  await expect(
    page.getByRole("heading", { name: "Richiesta inviata" }),
  ).toBeVisible();
  await expect(page.getByText("La richiameremo al 333 1234567")).toBeVisible();
});

test("failed Turnstile shows an Italian error", async ({ page }) => {
  clearRateLimit();
  await page.route("**/api/public/bookings", (route) =>
    route.continue({
      postData: JSON.stringify({
        ...route.request().postDataJSON(),
        turnstileToken: "",
      }),
    }),
  );
  await fillWizard(page);
  await tokenReady(page);
  await confirm(page).click();
  await expect(page.getByText(/^Attenzione:/)).toContainText(
    "verifica di sicurezza",
  );
});

test("rate limit shows an Italian error", async ({ page, request }) => {
  clearRateLimit();
  const { items } = await (await request.get("/api/public/services")).json();
  const body = {
    serviceId: items.find((s: { bookable: boolean }) => s.bookable).id,
    day: bookingDays()[0],
    slot: "mattina",
    firstName: "A",
    lastName: "B",
    phone: "3331234567",
    declaredMember: true,
    turnstileToken: "",
  };
  for (let i = 0; i < 5; i++)
    await request.post("/api/public/bookings", { data: body });
  await fillWizard(page);
  await tokenReady(page);
  await confirm(page).click();
  await expect(page.getByText(/^Attenzione:/)).toContainText(
    "troppe richieste",
  );
  clearRateLimit();
});

for (const path of [
  "/",
  "/servizi",
  "/prenota",
  "/chi-siamo",
  "/contatti",
  "/privacy",
]) {
  test(`axe: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.locator("h1").waitFor();
    const r = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(r.violations).toEqual([]);
  });
}

test("axe: wizard data step", async ({ page }) => {
  await page.goto(
    "/prenota?servizio=" +
      (await (await page.request.get("/api/public/services")).json()).items[0]
        .id,
  );
  await page.getByRole("button", { name: "Avanti" }).waitFor();
  await page
    .getByRole("group", { name: "Giorni disponibili" })
    .getByRole("button")
    .first()
    .click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("form", { name: "I suoi dati" }).waitFor();
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(r.violations).toEqual([]);
});

test("CSP: public pages use unsafe-inline, login uses nonce + text-size hash", async ({
  request,
}) => {
  const csp = async (path: string) =>
    (await request.get(path)).headers()["content-security-policy"];
  const pub = await csp("/");
  expect(pub).toContain("'unsafe-inline'");
  expect(pub).not.toContain("nonce-");
  const priv = await csp("/accedi");
  expect(priv).toContain("'nonce-");
  expect(priv).toContain(textSizeHash);
});
