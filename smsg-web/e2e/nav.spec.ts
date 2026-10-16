import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const out = "/home/mc/.claude/jobs/f1ba2558/tmp";
async function login(page: Page, email: string) {
  await page.goto("/accedi");
  const f = page.getByRole("form", { name: "Entra con la password" });
  await f.getByLabel("Email").fill(email);
  await f.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await f.getByRole("button", { name: "Entra" }).click();
  await page.waitForURL("**/gestione");
}
const axe = async (page: Page) =>
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

test("staff menu: disclosure, Esc returns focus, axe", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page, process.env.E2E_STAFF_EMAIL!);
  const b = page.getByRole("button", { name: "Attività" });
  await b.click();
  await expect(b).toHaveAttribute("aria-expanded", "true");
  await page.waitForTimeout(400); // let the chevron finish rotating
  await page.screenshot({ path: `${out}/nav-staff-1280.png` });
  await axe(page);
  await page.keyboard.press("Escape");
  await expect(b).toHaveAttribute("aria-expanded", "false");
  await expect(b).toBeFocused();
  await b.click();
  await page.getByRole("link", { name: /^Prenotazioni/ }).click();
  await expect(page.getByRole("link", { name: /^Prenotazioni/ })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "Attività" })).toBeVisible();
});

test("staff mobile menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, process.env.E2E_STAFF_EMAIL!);
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
  await page.screenshot({ path: `${out}/nav-staff-390.png` });
  await axe(page);
});

test("volunteer nav", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, process.env.E2E_VOLUNTEER_EMAIL!);
  await page.screenshot({ path: `${out}/nav-volontario-390.png` });
  await axe(page);
});
