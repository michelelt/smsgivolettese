import { describe, expect, it } from "vitest";
import { httpsOnly, isHttps } from "./https-url";

describe("httpsOnly", () => {
  it("keeps only valid https urls", () => {
    expect(isHttps("https://a.it/x")).toBe(true);
    for (const u of ["http://a.it", "javascript:alert(1)", "a.it", ""])
      expect(isHttps(u)).toBe(false);
    expect(httpsOnly([{ url: "https://a.it" }, { url: "data:x" }])).toEqual([
      { url: "https://a.it" },
    ]);
  });
});
