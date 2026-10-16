import { parseEnv } from "./env";

describe("parseEnv", () => {
  it("defaults API_URL outside production", () => {
    expect(parseEnv({ NODE_ENV: "development" }).API_URL).toBe(
      "http://localhost:3001",
    );
  });
  it("requires a valid API_URL in production", () => {
    expect(() => parseEnv({ NODE_ENV: "production" })).toThrow();
    expect(() =>
      parseEnv({ NODE_ENV: "production", API_URL: "nope" }),
    ).toThrow();
    expect(
      parseEnv({ NODE_ENV: "production", API_URL: "https://api.x.it" }).API_URL,
    ).toBe("https://api.x.it");
  });
});
