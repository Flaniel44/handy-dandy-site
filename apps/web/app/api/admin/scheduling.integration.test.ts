import { DateTime } from "luxon";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetTestData } from "../../../test/integration/database";

const SERVICE_ID = "22222222-2222-4222-8222-222222222222";
const auth = vi.hoisted(() => ({ isAdmin: false }));

vi.mock("../../../lib/admin-auth", () => ({
  requireAdmin: vi.fn(() => auth.isAdmin ? { role: "admin", email: "admin@example.com" } : null),
}));
vi.mock("../../../lib/google-calendar", () => ({
  getGoogleBusyRanges: vi.fn().mockResolvedValue([]),
}));

let testSql: ReturnType<typeof postgres>;
let getWorkingHours: typeof import("./working-hours/route").GET;
let putWorkingHours: typeof import("./working-hours/route").PUT;
let getBlocks: typeof import("./blocks/route").GET;
let createBlock: typeof import("./blocks/route").POST;
let deleteBlock: typeof import("./blocks/[id]/route").DELETE;
let getAvailabilityForDate: typeof import("../../../lib/availability").getAvailabilityForDate;

beforeAll(async () => {
  testSql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  ({ GET: getWorkingHours, PUT: putWorkingHours } = await import("./working-hours/route"));
  ({ GET: getBlocks, POST: createBlock } = await import("./blocks/route"));
  ({ DELETE: deleteBlock } = await import("./blocks/[id]/route"));
  ({ getAvailabilityForDate } = await import("../../../lib/availability"));
});

beforeEach(async () => {
  await resetTestData(testSql);
  auth.isAdmin = false;
  vi.clearAllMocks();
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
});

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
