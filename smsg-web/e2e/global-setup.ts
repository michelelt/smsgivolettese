import { chromium } from "@playwright/test";
import { stateFile } from "./session";

export default async function setup() {
  const browser = await chromium.launch();
  for (const email of [
    process.env.E2E_STAFF_EMAIL!,
    process.env.E2E_VOLUNTEER_EMAIL!,
    process.env.E2E_ADMIN_EMAIL!,
  ]) {
    const ctx = await browser.newContext({ baseURL: "http://localhost:3000" });
    const page = await ctx.newPage();
    await page.goto("/accedi");
    const f = page.getByRole("form", { name: "Entra con la password" });
    await f.getByLabel("Email").fill(email);
    await f.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
    await f.getByRole("button", { name: "Entra" }).click();
    await page.waitForURL("**/gestione");
    await ctx.storageState({ path: stateFile(email) });
    await ctx.close();
  }
  await browser.close();
}
