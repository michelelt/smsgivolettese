import { expect, test, type Page } from "@playwright/test";

// Credentials of users seeded in api/supabase/seed.sql (not available yet), passed via env.
const {
  E2E_STAFF_EMAIL,
  E2E_STAFF_PASSWORD,
  E2E_VOLUNTEER_EMAIL,
  E2E_VOLUNTEER_PASSWORD,
} = process.env;

async function login(page: Page, email: string, password: string) {
  await page.goto("/accedi");
  await page.getByLabel("Email").first().fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Entra" }).click();
  await page.waitForURL("**/gestione");
}

test("anonymous visitor is sent to /accedi", async ({ page }) => {
  await page.goto("/gestione/soci");
  await expect(page).toHaveURL(/\/accedi\?next=/);
});

test("staff login reaches /gestione", async ({ page }) => {
  test.fixme(
    !E2E_STAFF_EMAIL || !E2E_STAFF_PASSWORD,
    "needs seeded staff user (E2E_STAFF_*), pending db-engineer seed.sql",
  );
  await login(page, E2E_STAFF_EMAIL!, E2E_STAFF_PASSWORD!);
  await expect(page.getByRole("link", { name: "Soci" })).toBeVisible();
});

test("volunteer is blocked from staff pages", async ({ page }) => {
  test.fixme(
    !E2E_VOLUNTEER_EMAIL || !E2E_VOLUNTEER_PASSWORD,
    "needs seeded volunteer user (E2E_VOLUNTEER_*), pending db-engineer seed.sql",
  );
  await login(page, E2E_VOLUNTEER_EMAIL!, E2E_VOLUNTEER_PASSWORD!);
  await expect(page.getByRole("link", { name: "Soci" })).toHaveCount(0);
  await page.goto("/gestione/soci");
  await expect(page).toHaveURL(/\/gestione\?negato=1/);
  await expect(page.getByRole("alert")).toContainText("non hai il permesso");
});
