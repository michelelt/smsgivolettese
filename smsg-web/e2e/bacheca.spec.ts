import { expect, test } from "@playwright/test";

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
  await page.goto("/accedi");
  const form = page.getByRole("form", { name: "Entra con la password" });
  await form.getByLabel("Email").fill(env("E2E_STAFF_EMAIL"));
  await form.getByLabel("Password").fill(env("E2E_PASSWORD"));
  await form.getByRole("button", { name: "Entra" }).click();
  await page.waitForURL("**/gestione");

  await page.goto("/gestione/bacheca/nuovo");
  await page.getByLabel("Titolo").fill(title);
  await page.getByRole("button", { name: "Crea e scrivi" }).click();
  await page.waitForURL(/\/gestione\/bacheca\/[0-9a-f-]{36}$/);

  await page.getByLabel(/Scegli la foto in evidenza/).setInputFiles({
    name: "foto.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(
    page.getByRole("button", { name: "Togli la foto in evidenza" }),
  ).toBeVisible();

  await page.locator(".bn-editor").click();
  await page.keyboard.type("Ritrovo davanti alla sede alle nove.");
  await page.getByRole("button", { name: "Pubblica", exact: true }).click();
  await expect(page.getByText("Articolo pubblicato")).toBeVisible();

  await page.goto("/notizie");
  await expect(page.getByRole("link", { name: title }).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("link", { name: title }).first().click();
  await page.waitForURL(/\/notizie\/.+/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(
    page.locator("article").getByText("Ritrovo davanti alla sede"),
  ).toBeVisible();
});
