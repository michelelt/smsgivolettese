export function isHttps(u: string): boolean {
  try {
    return new URL(u).protocol === "https:";
  } catch {
    return false;
  }
}

export const httpsOnly = <T extends { url: string }>(items: T[]): T[] =>
  items.filter((i) => isHttps(i.url));
