import { describe, expect, it } from "vitest";
import { availableOn } from "./availability-days";

const v = (
  id: string,
  rules: [number, string, string][],
  absences: [string, string][] = [],
) => ({
  volunteerId: id,
  firstName: id,
  lastName: "X",
  canDrive: false,
  rules: rules.map(([weekday, startTime, endTime]) => ({
    weekday,
    startTime,
    endTime,
  })),
  absences: absences.map(([startsOn, endsOn], i) => ({
    id: String(i),
    startsOn,
    endsOn,
    note: null,
  })),
});

describe("availableOn", () => {
  // 2026-10-19 is a Monday, 2026-10-25 a Sunday
  const items = [
    v("a", [
      [1, "14:00", "18:00"],
      [1, "08:00", "12:00"],
      [7, "09:00", "10:00"],
    ]),
    v("b", [[2, "08:00", "12:00"]]),
    v("c", [[1, "08:00", "12:00"]], [["2026-10-19", "2026-10-20"]]),
    v("d", []),
  ];
  it("matches the ISO weekday and sorts slots", () => {
    const r = availableOn(items, "2026-10-19");
    expect(r.map((x) => x.volunteer.volunteerId)).toEqual(["a"]);
    expect(r[0].slots.map((s) => s.startTime)).toEqual(["08:00", "14:00"]);
  });
  it("maps Sunday to 7", () => {
    expect(
      availableOn(items, "2026-10-25").map((x) => x.volunteer.volunteerId),
    ).toEqual(["a"]);
  });
  it("excludes absence days (inclusive) but not the next day", () => {
    expect(
      availableOn(items, "2026-10-26").map((x) => x.volunteer.volunteerId),
    ).toEqual(["a", "c"]);
  });
});
