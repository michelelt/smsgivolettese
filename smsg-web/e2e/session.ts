import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

// One real login per user (global-setup.ts) reused by every spec: the local
// auth rate limit is 30 sign-ins per 5 minutes and the suite has more tests than that.
export const stateFile = (email: string) => `e2e/.auth/${email}.json`;

export async function login(page: Page, email: string) {
  const { cookies } = JSON.parse(readFileSync(stateFile(email), "utf8"));
  await page.context().addCookies(cookies);
  await page.goto("/gestione");
  await page.waitForURL("**/gestione");
}
