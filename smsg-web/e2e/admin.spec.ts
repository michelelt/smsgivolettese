import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { login } from "./session";
import { invoicedTransport } from "./transport";

// Super admin flows (ADR-068). Local SUPERADMIN_MFA=off; MFA is not covered here.
const env = (k: string) => process.env[k]!;
const run = Date.now().toString(36);

test.beforeEach(({ page }) => login(page, env("E2E_ADMIN_EMAIL")));

async function axe(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Caricamento…")).toHaveCount(0);
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(r.violations, path).toEqual([]);
}

test("axe: super admin pages", async ({ page }) => {
  test.setTimeout(90_000);
  for (const p of [
    "/gestione/utenti-e-ruoli",
    "/gestione/impostazioni",
    "/gestione/registro-attivita",
    "/gestione/account/sicurezza",
  ])
    await axe(page, p);
});

test("axe: /accedi/verifica", async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: "http://localhost:3000" });
  const page = await ctx.newPage();
  await axe(page, "/accedi/verifica");
  await ctx.close();
});

test("invite staff, change role, deactivate and reactivate", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const email = `e2e-staff-${run}@example.test`;
  const name = `E2E ${run}`;
  await page.goto("/gestione/utenti-e-ruoli");
  await expect(page.getByText("Caricamento…")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Invita staff o super admin" })
    .click();
  const dlg = page.getByRole("dialog", { name: "Invita staff o super admin" });
  await expect(async () => {
    await dlg.getByLabel("Nome", { exact: true }).fill("E2E");
    await dlg.getByLabel("Cognome").fill(run);
    await dlg.getByLabel("Email").fill(email);
    await expect(dlg.getByLabel("Email")).toHaveValue(email);
  }).toPass();
  await dlg.getByRole("button", { name: "Invia l'invito" }).click();
  await expect(page.getByText(`Invito inviato a ${email}`)).toBeVisible();

  await page.getByLabel("Cerca per nome o email").fill(email);
  const row = page.getByRole("listitem").filter({ hasText: email });
  await expect(row.getByText("Staff", { exact: true })).toBeVisible();

  await row.getByRole("button", { name: `Cambia ruolo di ${name}` }).click();
  await page.getByLabel("Nuovo ruolo").selectOption("volontario");
  await page.getByRole("button", { name: "Salva il ruolo" }).click();
  await expect(page.getByText(/Ruolo cambiato/)).toBeVisible();
  await expect(row.getByText("Volontario", { exact: true })).toBeVisible();

  await row.getByRole("button", { name: `Disattiva ${name}` }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Disattiva", exact: true })
    .click();
  await expect(page.getByText("Utente disattivato")).toBeVisible();
  // It leaves the "Attivi" filter; find it under "Disattivati".
  await page.getByRole("button", { name: "Disattivati" }).click();
  await expect(row.getByText("Disattivato", { exact: true })).toBeVisible();
  await row.getByRole("button", { name: `Riattiva ${name}` }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Riattiva", exact: true })
    .click();
  await expect(page.getByText("Utente riattivato")).toBeVisible();
});

test("the only active super admin cannot be demoted, deactivated or anonymised", async ({
  page,
}) => {
  await page.goto("/gestione/utenti-e-ruoli");
  await expect(page.getByText("Caricamento…")).toHaveCount(0);
  const row = page
    .getByRole("listitem")
    .filter({ hasText: "È l'unico super admin attivo" });
  // Other super admins may exist on a dirty DB: then no row is locked.
  test.skip((await row.count()) === 0, "more than one active super admin");
  await expect(
    row.getByRole("button", { name: /^Cambia ruolo/ }),
  ).toBeDisabled();
  await expect(row.getByRole("button", { name: /^Disattiva/ })).toBeDisabled();
  await expect(row.getByRole("button", { name: /^Anonimizza/ })).toHaveCount(0); // self: hidden
});

test("org settings save, lower counter refused, audit row visible", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/gestione/impostazioni");
  const org = page.getByRole("form", { name: "Dati dell'associazione" });
  const name = org.getByLabel("Denominazione");
  await expect(name).not.toHaveValue("");
  const original = await name.inputValue();
  const changed = `${original.replace(/ E2E.*$/, "")} E2E${run}`;
  const save = async (v: string) => {
    await expect(async () => {
      await org.getByLabel("Denominazione").fill(v);
      // A fresh seed has no tax code or address, and the form requires both.
      const tax = org.getByLabel("Codice fiscale");
      if (!(await tax.inputValue())) await tax.fill("12345678901");
      await org.getByLabel("Indirizzo").fill("Via Roma 1, Givoletto");
      await org.getByRole("button", { name: "Salva le impostazioni" }).click();
      await expect(page.getByText("Impostazioni salvate").first()).toBeVisible({
        timeout: 4000,
      });
    }).toPass({ timeout: 30_000 });
  };
  await save(changed);

  // A counter below its current value is refused.
  const counters = page.getByRole("form", { name: "Numerazioni" });
  const card = counters.getByLabel("Ultimo numero di tessera usato");
  const cur = Number(await card.inputValue());
  await card.fill(cur > 0 ? String(cur - 1) : "abc");
  await counters.getByRole("button", { name: "Salva le numerazioni" }).click();
  await expect(counters.getByText(/scrivi un numero intero tra/)).toBeVisible();

  // Audit log shows the change through the filters.
  await page.goto("/gestione/registro-attivita");
  await page.getByLabel("Tabella").selectOption("org_settings");
  await page.getByLabel("Azione").selectOption("update");
  await expect(
    page
      .getByRole("button", { name: /^Dettagli: Modifica Impostazioni/ })
      .first(),
  ).toBeVisible();

  await page.goto("/gestione/impostazioni"); // restore
  await save(original);
});

test("GDPR: export a member, anonymise a ceased one with invoices", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const last = `Gdpr${run}`;
  const full = `E2E ${last}`;
  await page.goto("/gestione/soci/nuovo");
  await expect(async () => {
    await page.getByLabel("Nome", { exact: true }).fill("E2E");
    await page.getByLabel("Cognome").fill(last);
    await page.getByLabel("Telefono").fill("3330002222");
    await expect(page.getByLabel("Cognome")).toHaveValue(last);
  }).toPass();
  await page.getByRole("button", { name: "Registra socio" }).click();
  await page.waitForURL(/\/gestione\/soci\/[0-9a-f-]{36}$/);
  const memberUrl = page.url();

  // Export.
  const [dl] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: `Esporta dati di ${full}` }).click(),
  ]);
  expect(dl.suggestedFilename()).toMatch(/\.json$/);

  // Anonymise is blocked until the member is ceased.
  await expect(
    page.getByRole("button", { name: `Anonimizza ${full}` }),
  ).toBeDisabled();

  // A closed, invoiced transport, so there is an invoice to retain.
  await invoicedTransport(page, last, true);
  await page.goto(memberUrl);

  // Cease, then anonymise.
  await page.getByRole("button", { name: "Cessa iscrizione" }).first().click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cessa iscrizione" })
    .click();
  await expect(page.getByText("Socio cessato")).toBeVisible();
  await page.getByRole("button", { name: `Anonimizza ${full}` }).click();
  // The title changes once the member is anonymised, so do not match it by name.
  const dlg = page.getByRole("dialog");
  const go = dlg.getByRole("button", { name: "Anonimizza per sempre" });
  await expect(go).toBeDisabled();
  await dlg.getByLabel(/Per confermare scrivi ANONIMIZZA/).fill("anonimizza");
  await expect(go).toBeDisabled(); // case matters
  await dlg.getByLabel(/Per confermare scrivi ANONIMIZZA/).fill("ANONIMIZZA");
  await go.click();
  await expect(dlg.getByText("Anonimizzazione completata.")).toBeVisible();
  await expect(dlg.getByText(/Fattura \d+\/\d{4}/)).toBeVisible();
});
