import { expect, type Page } from "@playwright/test";

/**
 * Creates a transport on a random past day (so runs never share a driver slot), assigns the first selectable driver, closes it with
 * odometer readings and issues its invoice. Returns the transport page URL.
 * `existing`: the member already exists (found by surname); otherwise it is enrolled inline.
 */
export async function invoicedTransport(
  page: Page,
  last: string,
  existing = false,
) {
  await page.goto("/gestione/trasporti/nuovo");
  if (existing) {
    await page.getByLabel(/^Cerca per nome/).fill(last);
    await page.getByRole("radio", { name: new RegExp(last) }).check();
  } else {
    await page.getByRole("button", { name: "Nuovo socio" }).click();
    const nm = page.getByRole("dialog", { name: "Nuovo socio" });
    await nm.getByLabel("Nome", { exact: true }).fill("E2E");
    await nm.getByLabel("Cognome").fill(last);
    await nm.getByLabel("Telefono").fill("3331112222");
    await nm.getByRole("button", { name: "Registra socio" }).click();
    await expect(page.getByText(`Socio scelto: E2E ${last}`)).toBeVisible();
  }
  // Phone is prefilled from the member and editable.
  await expect(
    page.getByLabel("Telefono per contattare il socio"),
  ).not.toHaveValue("");
  const day = new Date(
    Date.now() - (1 + Math.floor(Math.random() * 1500)) * 864e5,
  );
  await page.getByLabel("Data").fill(day.toISOString().slice(0, 10));
  await page.getByLabel("Ora di partenza da casa").fill("09:00");
  // Assignment needs both addresses; an inline-enrolled member has none.
  await page.getByLabel("Indirizzo di partenza").fill("Via Roma 1, Givoletto");
  await page.getByLabel("Destinazione").fill("Ospedale");
  await page.getByRole("button", { name: "Registra trasporto" }).click();
  await page.waitForURL(/\/gestione\/trasporti\/[0-9a-f-]{36}$/);
  const url = page.url();

  await page.getByRole("button", { name: "Assegna autista" }).click();
  const as = page.getByRole("dialog", { name: "Assegna autista" });
  await as.getByRole("radio").and(page.locator(":enabled")).first().check();
  await as.getByRole("button", { name: "Assegna", exact: true }).click();

  await page.getByRole("button", { name: "Chiudi con i km" }).click();
  const done = page.getByRole("dialog", { name: "Chiudi il trasporto" });
  await done.getByLabel(/alla partenza/).fill("1000");
  await done.getByLabel(/all'arrivo/).fill("1025");
  await done.getByRole("button", { name: "Chiudi il trasporto" }).click();

  await page.getByRole("button", { name: "Emetti fattura" }).click();
  const inv = page.getByRole("dialog", { name: "Emetti fattura" });
  await expect(inv.getByLabel("Importo (euro)")).toBeVisible();
  await inv.getByRole("button", { name: "Emetti fattura" }).click();
  await expect(page.getByText(/Fattura n\. \d+\/\d{4} emessa/)).toBeVisible();
  return url;
}
