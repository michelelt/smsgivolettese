import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { textSizeHash } from "../lib/csp";

const PAGES = [
  "/",
  "/chi-siamo",
  "/servizi",
  "/convenzioni",
  "/dove-siamo",
  "/privacy",
];

test("edit link is hidden for anonymous visitors", async ({ page }) => {
  await page.goto("/chi-siamo");
  await page.locator("h1").waitFor();
  await page.waitForTimeout(500); // the check runs after hydration
  await expect(
    page.getByRole("link", { name: "Modifica questa pagina" }),
  ).toHaveCount(0);
});

test("edit link is hidden for a logged-in volunteer", async ({ page }) => {
  await page.goto("/accedi");
  const form = page.getByRole("form", { name: "Entra con la password" });
  await form.getByLabel("Email").fill(process.env.E2E_VOLUNTEER_EMAIL!);
  await form.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await form.getByRole("button", { name: "Entra" }).click();
  await page.waitForURL("**/gestione");
  await page.goto("/chi-siamo");
  await page.locator("h1").waitFor();
  await page.waitForTimeout(1000); // the role check runs after hydration
  await expect(
    page.getByRole("link", { name: "Modifica questa pagina" }),
  ).toHaveCount(0);
});

test("text size persists", async ({ page }) => {
  await page.goto("/servizi");
  await page.getByRole("button", { name: "Testo grande" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-text-size", "l");
  await expect(
    page.getByRole("button", { name: "Testo grande" }),
  ).toHaveAttribute("aria-pressed", "true");
});

for (const path of PAGES) {
  test(`showcase only: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.locator("h1").waitFor();
    await expect(
      page.locator('a[href^="tel:"], a[href^="mailto:"]'),
    ).toHaveCount(0);
    expect(await page.locator("body").innerText()).not.toContain("€");
  });
}

for (const path of ["/prenota", "/contatti"]) {
  test(`removed: ${path}`, async ({ request }) => {
    expect((await request.get(path)).status()).toBe(404);
  });
}

for (const path of PAGES) {
  test(`axe: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.locator("h1").waitFor();
    const r = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(r.violations).toEqual([]);
  });
}

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

test("text-size script is a real inline script in head, applied before hydration", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("text-size", "xl"));
  const res = await page.request.get("/");
  expect(await res.text()).toMatch(
    /<head>.*localStorage\.getItem\("text-size"\)/s,
  );
  await page.route("**/_next/static/**/*.js", (r) => r.abort());
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-text-size", "xl");
});
