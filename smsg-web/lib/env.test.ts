import { parseEnv } from "./env";

const prod = {
  NODE_ENV: "production",
  API_URL: "https://api.x.it",
  API_PROXY_SECRET: "x".repeat(20),
  REVALIDATE_SECRET: "y".repeat(20),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAA",
  SITE_URL: "https://x.it",
};

describe("parseEnv", () => {
  it("defaults everything outside production", () => {
    const e = parseEnv({ NODE_ENV: "development", REVALIDATE_SECRET: "" });
    expect(e.API_URL).toBe("http://localhost:3001");
    expect(e.REVALIDATE_SECRET).toBe("dev-revalidate-secret");
    expect(e.NEXT_PUBLIC_TURNSTILE_SITE_KEY).toBe("1x00000000000000000000AA");
  });
  it("requires every variable but the Turnstile key in production", () => {
    expect(parseEnv(prod).API_URL).toBe("https://api.x.it");
    expect(() => parseEnv({ ...prod, API_URL: "nope" })).toThrow();
    for (const k of Object.keys(prod).filter(
      (k) => k !== "NODE_ENV" && k !== "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    ))
      expect(() => parseEnv({ ...prod, [k]: undefined })).toThrow();
  });
  it("makes Turnstile optional in production", () => {
    const e = parseEnv({ ...prod, NEXT_PUBLIC_TURNSTILE_SITE_KEY: "" });
    expect(e.NEXT_PUBLIC_TURNSTILE_SITE_KEY).toBeUndefined();
  });
  it("rejects dev secrets and Turnstile test keys in production", () => {
    for (const bad of [
      { API_PROXY_SECRET: "dev-proxy-secret" },
      { REVALIDATE_SECRET: "dev-revalidate-secret" },
      { NEXT_PUBLIC_TURNSTILE_SITE_KEY: "dev-key" },
      { NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA" },
      { NEXT_PUBLIC_TURNSTILE_SITE_KEY: "2x00000000000000000000AA" },
      { NEXT_PUBLIC_TURNSTILE_SITE_KEY: "3x00000000000000000000AA" },
    ])
      expect(() => parseEnv({ ...prod, ...bad })).toThrow();
  });
});
