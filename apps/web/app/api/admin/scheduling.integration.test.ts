import { DateTime } from "luxon";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetTestData } from "../../../test/integration/database";

const SERVICE_ID = "22222222-2222-4222-8222-222222222222";
const auth = vi.hoisted(() => ({ isAdmin: false }));
const googleCalendar = vi.hoisted(() => ({ getGoogleBusyRanges: vi.fn().mockResolvedValue([]) }));

vi.mock("../../../lib/admin-auth", () => ({
  requireAdmin: vi.fn(() => auth.isAdmin ? { role: "admin", email: "admin@example.com" } : null),
}));
vi.mock("../../../lib/google-calendar", () => ({
  getGoogleBusyRanges: googleCalendar.getGoogleBusyRanges,
}));

let testSql: ReturnType<typeof postgres>;
let getWorkingHours: typeof import("./working-hours/route").GET;
let putWorkingHours: typeof import("./working-hours/route").PUT;
let getBlocks: typeof import("./blocks/route").GET;
let createBlock: typeof import("./blocks/route").POST;
let deleteBlock: typeof import("./blocks/[id]/route").DELETE;
let getAvailabilityForDate: typeof import("../../../lib/availability").getAvailabilityForDate;
let getBookingPolicies: typeof import("./booking-policies/route").GET;
let putBookingPolicies: typeof import("./booking-policies/route").PUT;
let getAuditLog: typeof import("./audit-log/route").GET;

beforeAll(async () => {
  testSql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  ({ GET: getWorkingHours, PUT: putWorkingHours } = await import("./working-hours/route"));
  ({ GET: getBlocks, POST: createBlock } = await import("./blocks/route"));
  ({ DELETE: deleteBlock } = await import("./blocks/[id]/route"));
  ({ GET: getBookingPolicies, PUT: putBookingPolicies } = await import("./booking-policies/route"));
  ({ GET: getAuditLog } = await import("./audit-log/route"));
  ({ getAvailabilityForDate } = await import("../../../lib/availability"));
});

beforeEach(async () => {
  await resetTestData(testSql);
  auth.isAdmin = false;
  vi.clearAllMocks();
  googleCalendar.getGoogleBusyRanges.mockResolvedValue([]);
});

afterAll(async () => {
  await testSql?.end();
});

describe("admin scheduling controls", () => {
  it("protects every working-hours and manual-block operation", async () => {
    expect((await getWorkingHours()).status).toBe(401);
    expect((await putWorkingHours(jsonRequest("/api/admin/working-hours", { hours: [] }, "PUT"))).status).toBe(401);
    expect((await getBlocks()).status).toBe(401);
    expect((await createBlock(jsonRequest("/api/admin/blocks", blockData(futureBusinessDay()), "POST"))).status).toBe(401);
    expect((await deleteBlock(new Request("http://localhost"), context("00000000-0000-4000-8000-000000000000"))).status).toBe(401);
    expect((await getBookingPolicies()).status).toBe(401);
    expect((await putBookingPolicies(jsonRequest("/api/admin/booking-policies", policyData(), "PUT"))).status).toBe(401);
    expect((await getAuditLog(new Request("http://localhost/api/admin/audit-log"))).status).toBe(401);
  });

  it("reads, validates, and saves booking policies", async () => {
    auth.isAdmin = true;
    const initial = await (await getBookingPolicies()).json() as { policies: ReturnType<typeof policyData> };
    expect(initial.policies).toMatchObject({ timezone: "America/Toronto", minimumNoticeMinutes: 120, appointmentBufferMinutes: 60 });

    const response = await putBookingPolicies(jsonRequest("/api/admin/booking-policies", policyData({
      timezone: "America/Vancouver", minimumNoticeMinutes: 1440, bookingWindowDays: 90,
      appointmentBufferMinutes: 30, cancellationNoticeMinutes: 720,
    }), "PUT"));
    expect(response.status).toBe(200);
    expect((await response.json() as { policies: ReturnType<typeof policyData> }).policies).toMatchObject({
      timezone: "America/Vancouver", minimumNoticeMinutes: 1440, bookingWindowDays: 90,
      appointmentBufferMinutes: 30, cancellationNoticeMinutes: 720,
    });

    expect((await putBookingPolicies(jsonRequest("/api/admin/booking-policies", policyData({ timezone: "Toronto" }), "PUT"))).status).toBe(400);
    expect((await putBookingPolicies(jsonRequest("/api/admin/booking-policies", policyData({ bookingWindowDays: 0 }), "PUT"))).status).toBe(400);

    const audit = await (await getAuditLog(new Request("http://localhost/api/admin/audit-log"))).json() as { entries: Array<{ actorId: string; action: string; entityType: string }> };
    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0]).toMatchObject({ actorId: "admin@example.com", action: "booking_policies.updated", entityType: "business" });
  });

  it("atomically replaces and normalizes weekly working hours", async () => {
    auth.isAdmin = true;
    const response = await putWorkingHours(jsonRequest("/api/admin/working-hours", {
      hours: [
        { weekday: 2, startsAtLocal: "10:15:00", endsAtLocal: "14:45:00" },
        { weekday: 4, startsAtLocal: "12:00", endsAtLocal: "18:00" },
      ],
    }, "PUT"));
    expect(response.status).toBe(200);

    const body = await (await getWorkingHours()).json() as {
      timezone: string;
      hours: Array<{ weekday: number; startsAtLocal: string; endsAtLocal: string }>;
    };
    expect(body.timezone).toBe("America/Toronto");
    expect(body.hours).toHaveLength(2);
    expect(body.hours.map(({ weekday, startsAtLocal, endsAtLocal }) => ({ weekday, startsAtLocal, endsAtLocal }))).toEqual([
      { weekday: 2, startsAtLocal: "10:15:00", endsAtLocal: "14:45:00" },
      { weekday: 4, startsAtLocal: "12:00:00", endsAtLocal: "18:00:00" },
    ]);
  });

  it("rejects malformed or reversed working-hour ranges without deleting existing hours", async () => {
    auth.isAdmin = true;
    const response = await putWorkingHours(jsonRequest("/api/admin/working-hours", {
      hours: [{ weekday: 1, startsAtLocal: "17:00", endsAtLocal: "09:00" }],
    }, "PUT"));
    expect(response.status).toBe(400);
    const [{ count }] = await testSql<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM weekly_hours`;
    expect(count).toBe(5);
  });

  it("creates, orders, validates, and removes vacation blocks in the business timezone", async () => {
    auth.isAdmin = true;
    const firstDay = futureBusinessDay();
    const laterDay = firstDay.plus({ days: 2 });

    const laterResponse = await createBlock(jsonRequest("/api/admin/blocks", blockData(laterDay, "Later vacation"), "POST"));
    const earlierResponse = await createBlock(jsonRequest("/api/admin/blocks", blockData(firstDay, "Earlier vacation"), "POST"));
    expect(laterResponse.status).toBe(201);
    expect(earlierResponse.status).toBe(201);

    const { blocks } = await (await getBlocks()).json() as { blocks: Array<{ id: string; reason: string; startsAt: string }> };
    expect(blocks.map((block) => block.reason)).toEqual(["Earlier vacation", "Later vacation"]);
    expect(new Date(blocks[0]!.startsAt).toISOString()).toBe(firstDay.set({ hour: 10 }).toUTC().toISO());

    const reversed = await createBlock(jsonRequest("/api/admin/blocks", {
      startsAtLocal: firstDay.set({ hour: 12 }).toFormat("yyyy-MM-dd'T'HH:mm"),
      endsAtLocal: firstDay.set({ hour: 11 }).toFormat("yyyy-MM-dd'T'HH:mm"),
      reason: "Invalid vacation",
    }, "POST"));
    expect(reversed.status).toBe(400);
    expect((await deleteBlock(new Request("http://localhost"), context("not-a-uuid"))).status).toBe(400);
    expect((await deleteBlock(new Request("http://localhost"), context(blocks[0]!.id))).status).toBe(200);
    expect((await (await getBlocks()).json() as { blocks: unknown[] }).blocks).toHaveLength(1);
  });

  it("removes blocked periods from public availability", async () => {
    auth.isAdmin = true;
    const day = futureBusinessDay();
    const weekday = day.weekday % 7;
    await putWorkingHours(jsonRequest("/api/admin/working-hours", {
      hours: [{ weekday, startsAtLocal: "09:00", endsAtLocal: "13:00" }],
    }, "PUT"));
    await createBlock(jsonRequest("/api/admin/blocks", {
      startsAtLocal: day.set({ hour: 10 }).toFormat("yyyy-MM-dd'T'HH:mm"),
      endsAtLocal: day.set({ hour: 11 }).toFormat("yyyy-MM-dd'T'HH:mm"),
      reason: "Unavailable for an errand",
    }, "POST"));

    const availability = await getAvailabilityForDate(day.toISODate()!, SERVICE_ID);
    expect(availability?.slots.map((slot) => slot.localTime)).toEqual(["09:00", "11:00", "11:30", "12:00"]);
  });

  it("keeps one hour free after a blocking Google Calendar event", async () => {
    auth.isAdmin = true;
    const day = futureBusinessDay();
    const weekday = day.weekday % 7;
    await putWorkingHours(jsonRequest("/api/admin/working-hours", {
      hours: [{ weekday, startsAtLocal: "09:00", endsAtLocal: "17:00" }],
    }, "PUT"));
    googleCalendar.getGoogleBusyRanges.mockResolvedValue([{
      startsAt: day.set({ hour: 9 }).toUTC().toJSDate(),
      endsAt: day.set({ hour: 12 }).toUTC().toJSDate(),
    }]);

    const availability = await getAvailabilityForDate(day.toISODate()!, SERVICE_ID);
    expect(availability?.slots[0]?.localTime).toBe("13:00");
    expect(availability?.slots.some((slot) => slot.localTime === "12:30")).toBe(false);
  });

  it("uses the configured buffer after confirmed appointments", async () => {
    auth.isAdmin = true;
    const day = futureBusinessDay();
    await putBookingPolicies(jsonRequest("/api/admin/booking-policies", policyData({ appointmentBufferMinutes: 30 }), "PUT"));
    await testSql`
      INSERT INTO booking_slots (service_id, starts_at, ends_at, state)
      VALUES (${SERVICE_ID}, ${day.set({ hour: 9 }).toUTC().toJSDate()}, ${day.set({ hour: 10 }).toUTC().toJSDate()}, 'confirmed')
    `;
    const availability = await getAvailabilityForDate(day.toISODate()!, SERVICE_ID);
    expect(availability?.slots[0]?.localTime).toBe("10:30");
  });

  it("enforces the configured minimum notice and advance booking window", async () => {
    auth.isAdmin = true;
    const day = futureBusinessDay();
    await putBookingPolicies(jsonRequest("/api/admin/booking-policies", policyData({ bookingWindowDays: 1 }), "PUT"));
    expect((await getAvailabilityForDate(day.toISODate()!, SERVICE_ID))?.slots).toEqual([]);

    await putBookingPolicies(jsonRequest("/api/admin/booking-policies", policyData({ minimumNoticeMinutes: 43_200 }), "PUT"));
    expect((await getAvailabilityForDate(day.toISODate()!, SERVICE_ID))?.slots).toEqual([]);
  });
});

function policyData(overrides: Record<string, unknown> = {}) {
  return {
    timezone: "America/Toronto", slotIntervalMinutes: 30, minimumNoticeMinutes: 120,
    bookingWindowDays: 60, appointmentBufferMinutes: 60, cancellationNoticeMinutes: 0,
    ...overrides,
  };
}

function futureBusinessDay() {
  let day = DateTime.now().setZone("America/Toronto").plus({ days: 8 }).startOf("day");
  while (day.weekday > 5) day = day.plus({ days: 1 });
  return day;
}

function blockData(day: DateTime, reason = "Vacation") {
  return {
    startsAtLocal: day.set({ hour: 10 }).toFormat("yyyy-MM-dd'T'HH:mm"),
    endsAtLocal: day.set({ hour: 12 }).toFormat("yyyy-MM-dd'T'HH:mm"),
    reason,
  };
}

function jsonRequest(path: string, body: unknown, method: string) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}
