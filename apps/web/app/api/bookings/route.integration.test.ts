import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { DateTime } from "luxon";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const SERVICE_ID = "22222222-2222-4222-8222-222222222222";
const DEFAULT_TEST_DATABASE_URL =
  "postgresql://handy_dani:handy_dani_dev@localhost:5432/handy_dani_test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
assertSafeTestDatabase(testDatabaseUrl);
process.env.DATABASE_URL = testDatabaseUrl;

const sendBookingConfirmation = vi.fn().mockResolvedValue(undefined);
const createGoogleEventForAppointment = vi.fn().mockResolvedValue(undefined);
const markCalendarSyncFailure = vi.fn().mockResolvedValue(undefined);

vi.mock("../../../lib/email", () => ({ sendBookingConfirmation }));
vi.mock("../../../lib/google-calendar", () => ({
  createGoogleEventForAppointment,
  getGoogleBusyRanges: vi.fn().mockResolvedValue([]),
  markCalendarSyncFailure,
}));

let testSql: ReturnType<typeof postgres>;
let postBooking: typeof import("./route").POST;

beforeAll(async () => {
  await recreateTestDatabase(testDatabaseUrl);
  testSql = postgres(testDatabaseUrl, { max: 1, prepare: false });
  ({ POST: postBooking } = await import("./route"));
});

beforeEach(async () => {
  await testSql.unsafe("TRUNCATE appointments, booking_slots, customers RESTART IDENTITY CASCADE");
  vi.clearAllMocks();
});

afterAll(async () => {
  await testSql?.end();
});

describe("POST /api/bookings", () => {
  it("persists a confirmed guest booking and triggers its integrations", async () => {
    const slot = nextBookableSlot(9);
    const response = await postBooking(bookingRequest(slot, {
      name: "Ada Lovelace",
      email: "ADA@EXAMPLE.COM",
      notes: "Please check the living-room lights.",
    }));

    expect(response.status).toBe(201);
    const body = await response.json() as { appointmentId: string };
    expect(body.appointmentId).toMatch(/^[0-9a-f-]{36}$/);

    const [saved] = await testSql<{
      email: string;
      name: string;
      status: string;
      state: string;
      client_notes: string;
    }[]>`
      SELECT c.email, c.name, a.status, bs.state, a.client_notes
      FROM appointments a
      JOIN customers c ON c.id = a.customer_id
      JOIN booking_slots bs ON bs.id = a.slot_id
      WHERE a.id = ${body.appointmentId}
    `;
    expect(saved).toEqual({
      email: "ada@example.com",
      name: "Ada Lovelace",
      status: "confirmed",
      state: "confirmed",
      client_notes: "Please check the living-room lights.",
    });
    expect(sendBookingConfirmation).toHaveBeenCalledOnce();
    expect(createGoogleEventForAppointment).toHaveBeenCalledWith(body.appointmentId);
  });

  it("updates a returning guest instead of creating a duplicate customer", async () => {
    const first = nextBookableSlot(9);
    const second = nextBookableSlot(10);

    expect((await postBooking(bookingRequest(first, {
      name: "Old Name",
      email: "returning@example.com",
    }))).status).toBe(201);
    expect((await postBooking(bookingRequest(second, {
      name: "New Name",
      email: "RETURNING@example.com",
    }))).status).toBe(201);

    const [{ customer_count, appointment_count, name }] = await testSql<{
      customer_count: number;
      appointment_count: number;
      name: string;
    }[]>`
      SELECT COUNT(DISTINCT c.id)::int AS customer_count,
             COUNT(a.id)::int AS appointment_count,
             MAX(c.name) AS name
      FROM customers c
      JOIN appointments a ON a.customer_id = c.id
      WHERE c.email = 'returning@example.com'
    `;
    expect({ customer_count, appointment_count, name }).toEqual({
      customer_count: 1,
      appointment_count: 2,
      name: "New Name",
    });
  });

  it("allows only one of two simultaneous requests for the same slot", async () => {
    const slot = nextBookableSlot(9);
    const [first, second] = await Promise.all([
      postBooking(bookingRequest(slot, { name: "First Guest", email: "first@example.com" })),
      postBooking(bookingRequest(slot, { name: "Second Guest", email: "second@example.com" })),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);
    const [{ count }] = await testSql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM appointments
    `;
    expect(count).toBe(1);
  });
});

function nextBookableSlot(hour: number) {
  let local = DateTime.now().setZone("America/Toronto").plus({ days: 7 }).startOf("day");
  while (local.weekday > 5) local = local.plus({ days: 1 });
  const start = local.set({ hour });
  return { date: start.toISODate()!, startsAt: start.toISO()! };
}

function bookingRequest(
  slot: { date: string; startsAt: string },
  customer: { name: string; email: string; notes?: string },
) {
  return new Request("http://localhost/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serviceId: SERVICE_ID, ...slot, notes: "", ...customer }),
  });
}

function assertSafeTestDatabase(databaseUrl: string) {
  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.slice(1);
  if (!databaseName.endsWith("_test")) {
    throw new Error("Integration tests require a database whose name ends in _test.");
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === databaseUrl) {
    throw new Error("TEST_DATABASE_URL must not be the same as DATABASE_URL.");
  }
}

async function recreateTestDatabase(databaseUrl: string) {
  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.slice(1);
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { max: 1, prepare: false });

  try {
    await admin.unsafe(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [databaseName],
    );
    await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await admin.end();
  }

  const migrationSql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    const migrationDirectory = path.resolve(process.cwd(), "drizzle");
    const migrations = (await readdir(migrationDirectory))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    for (const migration of migrations) {
      await migrationSql.unsafe(await readFile(path.join(migrationDirectory, migration), "utf8"));
    }
  } finally {
    await migrationSql.end();
  }
}
