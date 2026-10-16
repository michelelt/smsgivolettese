import { canAccess, roleFromClaims, safeNext, SECTIONS } from "./roles";

describe("roleFromClaims", () => {
  it("accepts known roles only", () => {
    expect(roleFromClaims({ app_role: "staff" })).toBe("staff");
    expect(roleFromClaims({ app_role: "admin" })).toBeNull();
    expect(roleFromClaims(null)).toBeNull();
  });
});

describe("canAccess", () => {
  it("requires a session under /gestione", () => {
    expect(canAccess(null, "/gestione")).toBe(false);
    expect(canAccess(null, "/")).toBe(true);
  });
  it("lets volunteers see only dashboard and availability", () => {
    expect(canAccess("volontario", "/gestione")).toBe(true);
    expect(canAccess("volontario", "/gestione/disponibilita")).toBe(true);
    for (const s of SECTIONS.filter((s) => s.min !== "volontario"))
      expect(canAccess("volontario", `/gestione/${s.slug}`)).toBe(false);
  });
  it("lets staff see staff sections but not admin ones", () => {
    expect(canAccess("staff", "/gestione/soci/12")).toBe(true);
    expect(canAccess("staff", "/gestione/impostazioni")).toBe(false);
    expect(canAccess("staff", "/gestione/registro-attivita")).toBe(false);
  });
  it("lets super_admin see everything and closes unknown sections to others", () => {
    expect(canAccess("super_admin", "/gestione/utenti-e-ruoli")).toBe(true);
    expect(canAccess("staff", "/gestione/nuova")).toBe(false);
  });
  it("lets any role open its own account pages", () => {
    expect(canAccess("volontario", "/gestione/account/password")).toBe(true);
    expect(canAccess(null, "/gestione/account/password")).toBe(false);
  });
  it("does not match lookalike prefixes", () => {
    expect(canAccess(null, "/gestionefoo")).toBe(true);
  });
});

describe("safeNext", () => {
  it("only allows same-origin paths", () => {
    expect(safeNext("/gestione/soci")).toBe("/gestione/soci");
    expect(safeNext("//evil.com")).toBe("/gestione");
    expect(safeNext("https://evil.com")).toBe("/gestione");
    expect(safeNext("/\\evil.com")).toBe("/gestione");
    expect(safeNext(null)).toBe("/gestione");
    for (const bad of [
      "/%09/evil.com",
      "/\t/evil.com",
      "/%5cevil.com",
      "/%2f/evil.com",
      "%2f%2fevil.com",
      "/%0d%0a/evil.com",
      "/ /evil.com",
      "/%E0%A4%A",
    ])
      expect(safeNext(bad)).toBe("/gestione");
  });
});
