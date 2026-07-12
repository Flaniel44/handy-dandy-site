import { describe, expect, it } from "vitest";

import { calculateAvailability } from "./availability";

const mondayHours = [{ weekday: 1 as const, startsAtLocal: "09:00", endsAtLocal: "12:00" }];

describe("calculateAvailability", () => {
  it("creates aligned slots that fit completely inside working hours", () => {
    const slots = calculateAvailability({
      date: "2026-07-13", timezone: "America/Toronto", durationMinutes: 60, intervalMinutes: 30,
      now: "2026-07-12T12:00:00Z", weeklyHours: mondayHours, busyRanges: [],
    });
    expect(slots.map((slot) => slot.localTime)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"]);
  });

  it("removes overlaps but allows adjacent slots", () => {
    const slots = calculateAvailability({
      date: "2026-07-13", timezone: "America/Toronto", durationMinutes: 60, intervalMinutes: 30,
      now: "2026-07-12T12:00:00Z", weeklyHours: mondayHours,
      busyRanges: [{ startsAt: "2026-07-13T14:00:00Z", endsAt: "2026-07-13T15:00:00Z" }],
    });
    expect(slots.map((slot) => slot.localTime)).toEqual(["09:00", "11:00"]);
  });

  it("applies minimum notice using absolute instants", () => {
    const slots = calculateAvailability({
      date: "2026-07-13", timezone: "America/Toronto", durationMinutes: 60, intervalMinutes: 30,
      minimumNoticeMinutes: 120, now: "2026-07-13T12:15:00Z", weeklyHours: mondayHours, busyRanges: [],
    });
    expect(slots.map((slot) => slot.localTime)).toEqual(["10:30", "11:00"]);
  });

  it("uses the business timezone across daylight-saving changes", () => {
    const slots = calculateAvailability({
      date: "2026-11-01", timezone: "America/Toronto", durationMinutes: 60, intervalMinutes: 60,
      now: "2026-10-01T12:00:00Z",
      weeklyHours: [{ weekday: 0, startsAtLocal: "09:00", endsAtLocal: "11:00" }], busyRanges: [],
    });
    expect(slots[0]?.startsAt).toBe("2026-11-01T14:00:00.000Z");
    expect(slots.map((slot) => slot.localTime)).toEqual(["09:00", "10:00"]);
  });
});
