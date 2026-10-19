import { expect, test } from "@playwright/test";
import { login } from "./session";

// Needs `make dev` with the seeded local database. 1x1 PNG, resized in the browser before upload.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);
const env = (k: string) => process.env[k]!;

test("staff writes, publishes and sees the article on /notizie", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const title = `Gita E2E ${Date.now()}`;
  await login(page, env("E2E_STAFF_EMAIL"));

  await page.goto("/gestione/bacheca/nuovo");
  await page.getByLabel("Titolo").fill(title);

  await page.getByLabel("Carica foto").setInputFiles({
    name: "foto.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(
    page.getByRole("button", { name: "Togli la foto" }),
  ).toBeVisible();

  await page.locator(".bn-editor").click();
  await page.keyboard.type("Ritrovo davanti alla sede alle nove.");
  await expect(
    page.getByRole("button", { name: "Inserisci foto" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pubblica", exact: true }).click();
  await expect(page.getByText("Articolo pubblicato")).toBeVisible();
  await page.waitForURL(/\/gestione\/bacheca\/[0-9a-f-]{36}$/);
  const editUrl = page.url();

  // ISR: the list can lag behind the publish; reload until the article shows up.
  await expect(async () => {
    await page.goto("/notizie");
    await expect(page.getByRole("link", { name: title }).first()).toBeVisible({
      timeout: 1000,
    });
  }).toPass({ timeout: 45_000 });
  await page.getByRole("link", { name: title }).first().click();
  await page.waitForURL(/\/notizie\/.+/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(
    page.locator("article").getByText("Ritrovo davanti alla sede"),
  ).toBeVisible();

  // Clean up so reruns leave no published post behind.
  await page.goto(editUrl);
  await page.getByRole("button", { name: "Elimina" }).click();
  await page.getByRole("button", { name: "Sì, elimina" }).click();
  await page.waitForURL("**/gestione/bacheca");
});
