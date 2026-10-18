import { centsToInput, formatEuro, parseEuro } from "./money";

describe("parseEuro", () => {
  it.each([
    ["12,50", 1250],
    ["12.50", 1250],
    ["12", 1200],
    ["0,5", 50],
    ["1.250,50", 125050],
    ["1.250", 125000],
    ["€ 3", 300],
    ["0", 0],
  ])("%s -> %s", (i, c) => expect(parseEuro(i)).toBe(c));
  it.each(["", "abc", "-1", "1,234", "12,5,0", "1e3"])("rejects %j", (i) =>
    expect(parseEuro(i)).toBeNull(),
  );
});

describe("format", () => {
  it("formats cents in Italian", () => {
    expect(formatEuro(1250050).replace(/\s/g, " ")).toBe("12.500,50 €");
    expect(centsToInput(1205)).toBe("12,05");
  });
});
