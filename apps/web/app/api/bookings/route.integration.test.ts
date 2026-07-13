import { DateTime } from "luxon";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetTestData } from "../../../test/integration/database";

const SERVICE_ID = "22222222-2222-4222-8222-222222222222";
const testDatabaseUrl = process.env.DATABASE_URL!;

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
  testSql = postgres(testDatabaseUrl, { max: 1, prepare: false });
  ({ POST: postBooking } = await import("./route"));
});

beforeEach(async () => {
  await resetTestData(testSql);
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
    const second = nextBookableSlot(11);

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

  it("keeps a confirmed booking and continues calendar sync when confirmation email fails", async () => {
    const slot = nextBookableSlot(9);
    sendBookingConfirmation.mockRejectedValueOnce(new Error("Resend unavailable"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await postBooking(bookingRequest(slot, {
      name: "Reliable Guest", email: "reliable@example.com",
    }));

    expect(response.status).toBe(201);
    const body = await response.json() as { appointmentId: string };
    const [{ count }] = await testSql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM appointments WHERE id = ${body.appointmentId} AND status = 'confirmed'
    `;
    expect(count).toBe(1);
    expect(createGoogleEventForAppointment).toHaveBeenCalledWith(body.appointmentId);
    expect(errorLog).toHaveBeenCalledWith("Booking created but confirmation email failed", expect.any(Error));
    errorLog.mockRestore();
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
