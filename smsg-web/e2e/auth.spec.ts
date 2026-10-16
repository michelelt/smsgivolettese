import { expect, test, type Page } from "@playwright/test";

// Demo users from api/supabase/seed.sql; defaults come from .env.example (see playwright.config.ts).
const env = (k: string) => process.env[k]!;
const PASSWORD = env("E2E_PASSWORD");

async function login(page: Page, email: string, password: string) {
  await page.goto("/accedi");
  const form = page.getByRole("form", { name: "Entra con la password" });
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(password);
  await form.getByRole("button", { name: "Entra" }).click();
  await page.waitForURL("**/gestione");
}

test("anonymous visitor is sent to /accedi", async ({ page }) => {
  await page.goto("/gestione/soci");
  await expect(page).toHaveURL(/\/accedi\?next=/);
});

test("staff login reaches /gestione", async ({ page }) => {
  await login(page, env("E2E_STAFF_EMAIL"), PASSWORD);
  await expect(page.getByRole("link", { name: "Soci" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Impostazioni" })).toHaveCount(0);
});

test("volunteer is blocked from staff pages", async ({ page }) => {
  await login(page, env("E2E_VOLUNTEER_EMAIL"), PASSWORD);
  await expect(page.getByRole("link", { name: "Soci" })).toHaveCount(0);
  await page.goto("/gestione/soci");
  await expect(page).toHaveURL(/\/gestione\?negato=1/);
  await expect(page.getByText("non hai il permesso")).toBeVisible();
});

test("super admin sees super-admin-only sections", async ({ page }) => {
  await login(page, env("E2E_ADMIN_EMAIL"), PASSWORD);
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await expect(page).toHaveURL(/\/gestione\/impostazioni/);
});

test("magic link from Mailpit signs the user in", async ({ page, request }) => {
  const mail = "http://localhost:54324/api/v1";
  const to = env("E2E_STAFF_EMAIL");
  await page.goto("/accedi");
  const form = page.getByRole("form", { name: "Non ricordi la password?" });
  await form.getByLabel("Email").fill(to);
  await form.getByRole("button", { name: "Inviami il link" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  let link = "";
  await expect(async () => {
    const list = await (
      await request.get(`${mail}/search?query=to:${to}`)
    ).json();
    const msg = await (
      await request.get(`${mail}/message/${list.messages[0].ID}`)
    ).json();
    link = /http:\/\/127\.0\.0\.1:54321\/auth\/v1\/verify\?[^\s"<)]+/
      .exec(msg.Text + msg.HTML)![0]
      .replaceAll("&amp;", "&");
  }).toPass();
  await page.goto(link);
  await expect(page).toHaveURL(/\/gestione/);
  await expect(page.getByRole("link", { name: "Soci" })).toBeVisible();
});
