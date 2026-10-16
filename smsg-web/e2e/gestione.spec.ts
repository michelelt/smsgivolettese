import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Needs `make dev` with the seeded local database (services, members, clients).
const env = (k: string) => process.env[k]!;

test.beforeEach(async ({ page }) => {
  await page.goto("/accedi");
  const form = page.getByRole("form", { name: "Entra con la password" });
  await form.getByLabel("Email").fill(env("E2E_STAFF_EMAIL"));
  await form.getByLabel("Password").fill(env("E2E_PASSWORD"));
  await form.getByRole("button", { name: "Entra" }).click();
  await page.waitForURL("**/gestione");
});

const card = (page: Page, text: string) =>
  page.getByRole("listitem").filter({ hasText: text });

test("invoice issuance end to end", async ({ page }) => {
  test.setTimeout(90_000); // long flow, slower when workers run in parallel
  const last = `Prova${Date.now()}`;
  const name = `E2E ${last}`;

  // Phone booking for a brand new user.
  await page.goto("/gestione/prenotazioni?nuova=1");
  const dlg = page.getByRole("dialog", { name: "Nuova prenotazione" });
  await dlg.getByRole("button", { name: "Nuovo utente" }).click();
  await dlg.getByLabel("Nome", { exact: true }).fill("E2E");
  await dlg.getByLabel("Cognome").fill(last);
  await dlg.getByLabel("Telefono").fill("3331112222");
  await dlg
    .getByLabel("Servizio")
    .selectOption(
      (await dlg
        .locator("option", { hasText: /Prelievi/ })
        .getAttribute("value"))!,
    );
  await dlg.getByRole("button", { name: "Registra prenotazione" }).click();
  await expect(page.getByText("Prenotazione registrata.")).toBeVisible();

  // Executed, then invoiced.
  await page.getByLabel("Cerca per nome, telefono o servizio").fill(last);
  const row = card(page, name);
  await row.getByRole("button", { name: "Eseguita" }).click();
  // It leaves "Aperte"; find it under "Eseguite da fatturare".
  await page.getByRole("button", { name: "Eseguite da fatturare" }).click();
  await row.getByRole("button", { name: "Fattura" }).click();
  await page
    .getByRole("dialog", { name: "Emetti fattura" })
    .getByRole("button", { name: "Emetti fattura" })
    .click();
  await expect(page.getByText(/Fattura n\. \d+\/\d{4} emessa/)).toBeVisible();

  // PDF, paid, void.
  await page.goto("/gestione/fatture");
  await page.getByLabel("Cerca per cliente o numero").fill(last);
  const inv = card(page, name);
  const [dl] = await Promise.all([
    page.waitForEvent("download"),
    inv.getByRole("button", { name: "Scarica PDF" }).click(),
  ]);
  expect(dl.suggestedFilename()).toMatch(/\.pdf$/);
  await inv.getByRole("button", { name: "Segna pagata" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Segna pagata" })
    .click();
  await expect(inv.getByText("Pagata", { exact: true })).toBeVisible();
  await inv.getByRole("button", { name: "Annulla" }).click();
  const v = page.getByRole("dialog");
  await expect(v.getByText(/nota di credito/)).toBeVisible();
  await v.getByLabel("Motivo dell'annullamento").fill("Prova automatica");
  await v.getByRole("button", { name: "Annulla fattura" }).click();
  await expect(inv.getByText("Annullata", { exact: true })).toBeVisible();

  // The booking can be invoiced again.
  await page.goto("/gestione/prenotazioni");
  await page.getByRole("button", { name: "Eseguite da fatturare" }).click();
  await page.getByLabel("Cerca per nome, telefono o servizio").fill(last);
  await expect(
    card(page, name).getByRole("button", { name: "Fattura" }),
  ).toBeVisible();
});

test("a doubtful tax code can be saved anyway", async ({ page }) => {
  await page.goto("/gestione/utenti");
  await page.getByRole("button", { name: "Nuovo utente" }).click();
  const dlg = page.getByRole("dialog", { name: "Nuovo utente" });
  await dlg.getByLabel("Nome", { exact: true }).fill("E2E");
  await dlg.getByLabel("Cognome").fill(`Codice${Date.now()}`);
  await dlg.getByLabel("Telefono").fill("3330001111");
  await dlg.getByLabel("Codice fiscale (facoltativo)").fill("AAAAAA00A00A000A");
  await dlg.getByRole("button", { name: "Salva" }).click();
  await expect(dlg.getByRole("alert")).toContainText("codice fiscale");
  await dlg.getByRole("button", { name: "Salva comunque" }).click();
  await expect(page.getByText("Utente registrato")).toBeVisible();
});

async function axe(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Caricamento…")).toHaveCount(0);
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(r.violations, path).toEqual([]);
}

for (const p of [
  "/gestione",
  "/gestione/prenotazioni",
  "/gestione/prenotazioni?nuova=1",
  "/gestione/utenti",
  "/gestione/soci",
  "/gestione/soci/nuovo",
  "/gestione/fatture",
  "/gestione/servizi",
  "/gestione/sito",
])
  test(`axe: ${p}`, async ({ page }) => axe(page, p));

test("axe: user and member detail pages", async ({ page }) => {
  const firstLink = async (list: string, name: RegExp) => {
    await page.goto(list);
    return page.getByRole("link", { name }).first().getAttribute("href");
  };
  await axe(page, (await firstLink("/gestione/utenti", /Rossi/))!);
  const socio = (await firstLink("/gestione/soci", /Esposito/))!;
  await axe(page, socio);
  await axe(page, `${socio}/modifica`);
});

test("site info saves, https-only links", async ({ page }) => {
  await page.goto("/gestione/sito");
  await page.getByLabel("Slogan").fill("Insieme, da sempre");
  await page.getByRole("button", { name: "Aggiungi link: Link utili" }).click();
  await page.getByLabel("Testo del link").last().fill("Prova");
  await page
    .getByLabel("Indirizzo web", { exact: true })
    .last()
    .fill("http://x.it");
  await page.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(page.getByText("https://").first()).toBeVisible();
  await page
    .getByLabel("Indirizzo web", { exact: true })
    .last()
    .fill("https://x.it");
  await page
    .getByRole("button", { name: /Togli link \d+ \(Link utili\)/ })
    .last()
    .click();
  await page.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(page.getByText("Info del sito salvate")).toBeVisible();
});
