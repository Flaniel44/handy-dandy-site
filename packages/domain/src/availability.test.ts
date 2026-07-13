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

  it("returns no slots on a closed day", () => {
    const slots = calculateAvailability({
      date: "2026-07-14", timezone: "America/Toronto", durationMinutes: 60, intervalMinutes: 30,
      now: "2026-07-12T12:00:00Z", weeklyHours: mondayHours, busyRanges: [],
    });
    expect(slots).toEqual([]);
  });

  it("combines multiple working windows in chronological order", () => {
    const slots = calculateAvailability({
      date: "2026-07-13", timezone: "America/Toronto", durationMinutes: 60, intervalMinutes: 60,
      now: "2026-07-12T12:00:00Z",
      weeklyHours: [
        { weekday: 1, startsAtLocal: "13:00", endsAtLocal: "15:00" },
        { weekday: 1, startsAtLocal: "09:00", endsAtLocal: "11:00" },
      ], busyRanges: [],
    });
    expect(slots.map((slot) => slot.localTime)).toEqual(["09:00", "10:00", "13:00", "14:00"]);
  });

  it("excludes slots touched by a partial busy overlap", () => {
    const slots = calculateAvailability({
      date: "2026-07-13", timezone: "America/Toronto", durationMinutes: 60, intervalMinutes: 30,
      now: "2026-07-12T12:00:00Z", weeklyHours: mondayHours,
      busyRanges: [{ startsAt: "2026-07-13T13:45:00Z", endsAt: "2026-07-13T14:15:00Z" }],
    });
    expect(slots.map((slot) => slot.localTime)).toEqual(["10:30", "11:00"]);
  });

  it("blocks an entire day when an all-day busy range covers it", () => {
    const slots = calculateAvailability({
      date: "2026-07-13", timezone: "America/Toronto", durationMinutes: 60, intervalMinutes: 30,
      now: "2026-07-12T12:00:00Z", weeklyHours: mondayHours,
      busyRanges: [{ startsAt: "2026-07-13T04:00:00Z", endsAt: "2026-07-14T04:00:00Z" }],
    });
    expect(slots).toEqual([]);
  });

  it("blocks a day inside a multi-day busy range", () => {
    const slots = calculateAvailability({
      date: "2026-07-13", timezone: "America/Toronto", durationMinutes: 60, intervalMinutes: 30,
      now: "2026-07-01T12:00:00Z", weeklyHours: mondayHours,
      busyRanges: [{ startsAt: "2026-07-12T04:00:00Z", endsAt: "2026-07-15T04:00:00Z" }],
    });
    expect(slots).toEqual([]);
  });

  it("allows a slot exactly at the minimum-notice boundary", () => {
    const slots = calculateAvailability({
      date: "2026-07-13", timezone: "America/Toronto", durationMinutes: 60, intervalMinutes: 30,
      minimumNoticeMinutes: 120, now: "2026-07-13T12:00:00Z", weeklyHours: mondayHours, busyRanges: [],
    });
    expect(slots.map((slot) => slot.localTime)).toEqual(["10:00", "10:30", "11:00"]);
  });

  it("ignores malformed busy ranges instead of hiding valid availability", () => {
    const slots = calculateAvailability({
      date: "2026-07-13", timezone: "America/Toronto", durationMinutes: 60, intervalMinutes: 60,
      now: "2026-07-12T12:00:00Z", weeklyHours: mondayHours,
      busyRanges: [{ startsAt: "not-a-date", endsAt: "also-not-a-date" }],
    });
    expect(slots.map((slot) => slot.localTime)).toEqual(["09:00", "10:00", "11:00"]);
  });

  it("returns no slots for invalid durations, intervals, dates, or timezones", () => {
    const base = { date: "2026-07-13", timezone: "America/Toronto", durationMinutes: 60, intervalMinutes: 30, now: "2026-07-12T12:00:00Z", weeklyHours: mondayHours, busyRanges: [] };
    expect(calculateAvailability({ ...base, durationMinutes: 0 })).toEqual([]);
    expect(calculateAvailability({ ...base, intervalMinutes: -1 })).toEqual([]);
    expect(calculateAvailability({ ...base, date: "2026-02-30" })).toEqual([]);
    expect(calculateAvailability({ ...base, timezone: "Not/A_Timezone" })).toEqual([]);
  });

  it("returns no slots when the service cannot fit inside working hours", () => {
    const slots = calculateAvailability({
      date: "2026-07-13", timezone: "America/Toronto", durationMinutes: 181, intervalMinutes: 30,
      now: "2026-07-12T12:00:00Z", weeklyHours: mondayHours, busyRanges: [],
    });
    expect(slots).toEqual([]);
  });

  it("rejects nonexistent local times during the spring DST transition", () => {
    const slots = calculateAvailability({
      date: "2026-03-08", timezone: "America/Toronto", durationMinutes: 30, intervalMinutes: 30,
      now: "2026-03-01T12:00:00Z",
      weeklyHours: [{ weekday: 0, startsAtLocal: "02:00", endsAtLocal: "03:30" }], busyRanges: [],
    });
    expect(slots).toEqual([]);
  });
});
