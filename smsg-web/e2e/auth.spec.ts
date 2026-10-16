import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

// Demo users from api/supabase/seed.sql; defaults come from .env.example (see playwright.config.ts).
const env = (k: string) => process.env[k]!;
const PASSWORD = env("E2E_PASSWORD");
const MAIL = "http://localhost:54324/api/v1";

async function lastMail(request: APIRequestContext, to: string) {
  const list = await (
    await request.get(`${MAIL}/search?query=to:${to}`)
  ).json();
  const msg = await (
    await request.get(`${MAIL}/message/${list.messages[0].ID}`)
  ).json();
  return (msg.Text + msg.HTML) as string;
}

async function requestLink(page: Page, to: string) {
  await page.goto("/accedi");
  const form = page.getByRole("form", { name: /non ricordi la password/i });
  await form.getByLabel("Email").fill(to);
  await form.getByRole("button", { name: "Inviami il link" }).click();
  await expect(page.getByRole("status")).toBeVisible();
}

async function mailedLink(request: APIRequestContext, to: string) {
  let link = "";
  await expect(async () => {
    link = /https?:\/\/[^\s"<)]+\/auth\/callback\?token_hash=[^\s"<)]+/
      .exec(await lastMail(request, to))![0]
      .replaceAll("&amp;", "&");
  }).toPass();
  return link;
}

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
  await expect(
    page.getByRole("link", { name: "Soci", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Impostazioni" })).toHaveCount(0);
});

test("volunteer is blocked from staff pages", async ({ page }) => {
  await login(page, env("E2E_VOLUNTEER_EMAIL"), PASSWORD);
  await expect(
    page.getByRole("link", { name: "Soci", exact: true }),
  ).toHaveCount(0);
  await page.goto("/gestione/soci");
  await expect(page).toHaveURL(/\/gestione\?negato=1/);
  await expect(page.getByText("non hai il permesso")).toBeVisible();
});

test("super admin sees super-admin-only sections", async ({ page }) => {
  await login(page, env("E2E_ADMIN_EMAIL"), PASSWORD);
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await expect(page).toHaveURL(/\/gestione\/impostazioni/);
});

test("magic link from Mailpit signs the volunteer in", async ({
  page,
  request,
}) => {
  const to = env("E2E_VOLUNTEER_EMAIL");
  await requestLink(page, to);
  const link = await mailedLink(request, to);
  await page.goto(link);
  await expect(page).toHaveURL(/\/gestione/);
  await expect(
    page.getByRole("heading", { name: "I miei impegni" }),
  ).toBeVisible();
  // Same link again (single use) must give the generic message, not the staff one.
  await page.context().clearCookies();
  await page.goto(link);
  await expect(page).toHaveURL(/\/accedi\?errore=link/);
  await expect(
    page.getByText("il link non è valido o è scaduto"),
  ).toBeVisible();
  await expect(page.getByText("usa la password")).toHaveCount(0);
});

// Needs db-engineer's Access Token Hook change (staff cannot get a session via link).
test("staff magic link ends at /accedi with a message", async ({
  page,
  request,
}) => {
  const to = env("E2E_STAFF_EMAIL");
  await requestLink(page, to);
  await page.goto(await mailedLink(request, to));
  await expect(page).toHaveURL(/\/accedi/);
  await expect(page.getByText("usa la password")).toBeVisible();
});

test("staff changes own password with the emailed code", async ({
  page,
  request,
}) => {
  const to = env("E2E_STAFF_EMAIL");
  await login(page, to, PASSWORD);
  // GoTrue refuses an unchanged password, so change it and then restore the seed one.
  let prev = "";
  for (const pw of [`${PASSWORD}-nuova`, PASSWORD]) {
    await page.goto("/gestione/account/password");
    await page
      .getByRole("button", { name: "Inviami il codice per email" })
      .click();
    const field = page.getByLabel("Codice ricevuto per email");
    await field.waitFor();
    let code = "";
    await expect(async () => {
      code = /\b(\d{6})\b/.exec(await lastMail(request, to))![1];
      expect(code).not.toBe(prev);
    }).toPass();
    prev = code;
    await field.fill(code);
    await page.getByLabel("Nuova password", { exact: true }).fill(pw);
    await page.getByLabel("Ripeti la password").fill(pw);
    await page.getByRole("button", { name: "Salva la password" }).click();
    await expect(page.getByText("La password è stata cambiata.")).toBeVisible();
  }
});
