import { describe, expect, it } from "vitest";
import { addDays, fmtTime, isDate, mondayOf } from "./dates";

describe("dates", () => {
  it("finds the Monday of a week, also across DST and year end", () => {
    expect(mondayOf("2026-10-16")).toBe("2026-10-12");
    expect(mondayOf("2026-10-12")).toBe("2026-10-12");
    expect(mondayOf("2026-10-25")).toBe("2026-10-19");
    expect(mondayOf("2027-01-01")).toBe("2026-12-28");
  });
  it("adds days", () => {
    expect(addDays("2026-10-25", 7)).toBe("2026-11-01");
  });
  it("validates dates and trims times", () => {
    expect(isDate("2026-02-30")).toBe(true); // rolls over; the API is the authority
    expect(isDate("x")).toBe(false);
    expect(fmtTime("09:30:00")).toBe("09:30");
  });
});
