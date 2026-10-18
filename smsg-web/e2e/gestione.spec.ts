import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { login } from "./session";
import { invoicedTransport } from "./transport";

// Needs `make dev` with the seeded local database (services, members).
const env = (k: string) => process.env[k]!;

test.beforeEach(({ page }) => login(page, env("E2E_STAFF_EMAIL")));

const card = (page: Page, text: string) =>
  page.getByRole("listitem").filter({ hasText: text });

test("invoice issuance end to end", async ({ page }) => {
  test.setTimeout(90_000); // long flow, slower when workers run in parallel
  const last = `Prova${Date.now()}`;
  const name = `E2E ${last}`;

  // Transport for a brand new member created inline, closed and invoiced.
  const url = await invoicedTransport(page, last);

  // PDF, paid, void.
  await page.goto("/gestione/fatture");
  // Data rendered = hydrated; filling earlier is wiped by hydration and the
  // new invoice then sits beyond page 1 of the unfiltered list.
  await expect(page.getByText(/^Fattura n\. \d+\//).first()).toBeVisible();
  const filtered = page.waitForResponse(
    (r) => r.url().includes("/invoices?") && r.url().includes(last),
  );
  await page.getByLabel("Cerca per socio o numero").fill(last);
  await filtered;
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

  // The transport can be invoiced again.
  await page.goto(url);
  await expect(
    page.getByRole("button", { name: "Emetti fattura" }),
  ).toBeVisible();
});

test("a doubtful tax code can be saved anyway", async ({ page }) => {
  await page.goto("/gestione/trasporti/nuovo");
  await page.getByRole("button", { name: "Nuovo socio" }).click();
  const dlg = page.getByRole("dialog", { name: "Nuovo socio" });
  await dlg.getByLabel("Nome", { exact: true }).fill("E2E");
  const last = `Codice${Date.now()}`;
  await dlg.getByLabel("Cognome").fill(last);
  await dlg.getByLabel("Telefono").fill("3330001111");
  await dlg
    .getByLabel("Codice fiscale (facoltativo)")
    .fill(`AAAAAA00A00A${String(Date.now()).slice(-3)}A`);
  const saved = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().includes("/members"),
  );
  await dlg.getByRole("button", { name: "Registra socio" }).click();
  await saved; // the warning comes from the API; it can be slow under load
  await expect(dlg.getByRole("alert")).toContainText("codice fiscale");
  await dlg.getByRole("button", { name: "Salva comunque" }).click();
  await expect(page.getByText(`Socio scelto: E2E ${last}`)).toBeVisible();
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
  "/gestione/trasporti",
  "/gestione/trasporti/nuovo",
  "/gestione/soci",
  "/gestione/soci/nuovo",
  "/gestione/fatture",
  "/gestione/servizi",
  "/gestione/sito",
])
  test(`axe: ${p}`, async ({ page }) => axe(page, p));

test("axe: member detail pages", async ({ page }) => {
  const firstLink = async (list: string, name: RegExp) => {
    await page.goto(list);
    return page.getByRole("link", { name }).first().getAttribute("href");
  };
  const socio = (await firstLink("/gestione/soci", /Esposito/))!;
  await axe(page, socio);
  await axe(page, `${socio}/modifica`);
});

test("site info saves, https-only links", async ({ page }) => {
  await page.goto("/gestione/sito");
  await page.getByRole("button", { name: "Aggiungi link: Link utili" }).click();
  const dlg = page.getByRole("dialog", { name: "Nuovo link" });
  await dlg.getByLabel("Testo del link").fill("Prova");
  await dlg.getByLabel("Indirizzo web").fill("http://x.it");
  await dlg.getByRole("button", { name: "Conferma" }).click();
  await expect(dlg.getByText("https://").first()).toBeVisible();
  await dlg.getByLabel("Indirizzo web").fill("https://x.it");
  await dlg.getByRole("button", { name: "Conferma" }).click();
  await expect(page.getByText("Modifiche non salvate (1)")).toBeVisible();
  // Remove it again: net change is zero, and saving stays possible with the other edit below.
  await page.getByRole("button", { name: "Modifica link Prova" }).click();
  await page.getByRole("button", { name: "Togli link" }).click();
  await expect(page.getByText("Nessuna modifica")).toBeVisible();
  await page.getByRole("button", { name: "Modifica partita IVA" }).click();
  await page.getByLabel("partita IVA").fill("123");
  await page.keyboard.press("Enter");
  await expect(page.getByText("la partita IVA ha 11 cifre")).toBeVisible();
  await page.getByRole("button", { name: "Annulla modifiche" }).click();
  await expect(page.getByText("Nessuna modifica")).toBeVisible();
});

test("slogan edited in place shows on the public home", async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  const slogan = `Insieme ${Date.now()}`;
  await page.goto("/gestione/sito");
  const original = (
    await page.getByRole("button", { name: "Modifica slogan" }).innerText()
  ).trim();
  await page.getByRole("button", { name: "Modifica slogan" }).click();
  await page.getByLabel("slogan", { exact: true }).fill("sbagliato");
  await page.keyboard.press("Escape"); // cancels
  await expect(
    page.getByRole("button", { name: "Modifica slogan" }),
  ).not.toHaveText("sbagliato");
  await page.getByRole("button", { name: "Modifica slogan" }).click();
  await page.getByLabel("slogan", { exact: true }).fill(slogan);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Modifiche non salvate (1)")).toBeVisible();
  await page.getByRole("button", { name: "Salva e pubblica" }).click();
  await expect(page.getByText("Modifiche salvate").first()).toBeVisible();
  const pub = await context.newPage();
  await expect(async () => {
    await pub.goto("/");
    await expect(pub.getByRole("heading", { level: 1 })).toHaveText(slogan, {
      timeout: 1000,
    });
  }).toPass({ timeout: 40_000 });

  // Put the demo slogan back so local data stays clean.
  await page.getByRole("button", { name: "Modifica slogan" }).click();
  await page.getByLabel("slogan", { exact: true }).fill(original);
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Salva e pubblica" }).click();
  await expect(page.getByText("Modifiche salvate").first()).toBeVisible();
});

test("Chi siamo paragraph edited in place shows on the public page", async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  const marker = `Modifica ${Date.now()}`;
  await page.goto("/gestione/sito?pagina=chi-siamo");
  const btn = page.getByRole("button", {
    name: "Modifica testo della sezione 1",
  });
  const original = (await btn.innerText()).trim();
  const edit = async (text: string) => {
    await btn.click();
    await page.getByLabel("testo della sezione 1", { exact: true }).fill(text);
    await page.getByLabel("testo della sezione 1", { exact: true }).blur();
    await page.getByRole("button", { name: "Salva e pubblica" }).click();
    await expect(page.getByText("Modifiche salvate").first()).toBeVisible();
  };
  await edit(`${original}\n\n${marker}`);
  const pub = await context.newPage();
  await expect(async () => {
    await pub.goto("/chi-siamo");
    await expect(pub.getByText(marker)).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 40_000 });
  // The edit link is shown to staff on the public page.
  await expect(
    pub.getByRole("link", { name: "Modifica questa pagina" }),
  ).toHaveAttribute("href", "/gestione/sito?pagina=chi-siamo");
  await edit(original); // restore local data
});
