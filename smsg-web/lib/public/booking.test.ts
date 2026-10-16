import { bookingDays, normalizePhone, bookingFormSchema } from "./booking";

describe("bookingDays", () => {
  it("starts tomorrow in Rome and skips Sundays", () => {
    // Sat 17 Oct 2026 23:30 UTC is already Sun 18 in Rome -> tomorrow is Mon 19
    const d = bookingDays(new Date("2026-10-17T23:30:00Z"));
    expect(d[0]).toBe("2026-10-19");
    expect(d).toHaveLength(12);
    expect(d.every((x) => new Date(x).getUTCDay() !== 0)).toBe(true);
  });
  it("skips the Sunday after Saturday", () => {
    expect(bookingDays(new Date("2026-10-16T10:00:00Z"), 2)).toEqual([
      "2026-10-17",
      "2026-10-19",
    ]);
  });
});

describe("phone", () => {
  it("normalises", () => {
    expect(normalizePhone("+39 333.123-4567")).toBe("3331234567");
  });
  it("validates", () => {
    const base = {
      firstName: "A",
      lastName: "B",
      declaredMember: "si",
      notes: "",
    };
    expect(
      bookingFormSchema.safeParse({ ...base, phone: "333 1234567" }).success,
    ).toBe(true);
    expect(bookingFormSchema.safeParse({ ...base, phone: "12" }).success).toBe(
      false,
    );
  });
});
