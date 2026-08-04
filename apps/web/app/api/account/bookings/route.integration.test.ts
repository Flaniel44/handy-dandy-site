import { DateTime } from "luxon";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetTestData } from "../../../../test/integration/database";

const SERVICE_ID = "22222222-2222-4222-8222-222222222222";
const session = vi.hoisted(() => ({ customerId: "", email: "client@example.com", firstName: "Client" }));
const sendBookingRequestReceived = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const notifyAdminAppointmentBooked = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const createGoogleEventForAppointment = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("server-only", () => ({}));
vi.mock("../../../../lib/admin-auth", () => ({ requireCustomer: vi.fn(() => session) }));
vi.mock("../../../../lib/email", () => ({ sendBookingRequestReceived }));
vi.mock("../../../../lib/appointment-notifications", () => ({ notifyAdminAppointmentBooked }));
vi.mock("../../../../lib/google-calendar", () => ({
  createGoogleEventForAppointment,
  getGoogleBusyRanges: vi.fn().mockResolvedValue([]),
  markCalendarSyncFailure: vi.fn().mockResolvedValue(undefined),
}));

let testSql: ReturnType<typeof postgres>;
let createAccountBooking: typeof import("./route").POST;

beforeAll(async () => {
  testSql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  ({ POST: createAccountBooking } = await import("./route"));
});

beforeEach(async () => {
  await resetTestData(testSql);
  vi.clearAllMocks();
  const [customer] = await testSql<{ id: string }[]>`
    INSERT INTO customers (email, name, first_name, last_name, password_hash)
    VALUES ('client@example.com', 'Client Example', 'Client', 'Example', 'hash') RETURNING id
  `;
  session.customerId = customer.id;
});

afterAll(async () => { await testSql?.end(); });

describe("POST /api/account/bookings", () => {
  it("creates a reserved request awaiting approval and sends request notifications", async () => {
    const slot = nextBookableSlot(10);
    const response = await createAccountBooking(new Request("http://localhost/api/account/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId: SERVICE_ID, ...slot, clientNotes: "Please review my setup." }),
    }));

    expect(response.status).toBe(202);
    const body = await response.json() as { appointmentId: string; status: string };
    expect(body.status).toBe("pending_approval");
    const [saved] = await testSql<{ status: string; state: string; source: string; client_notes: string }[]>`
      SELECT a.status, bs.state, a.source, a.client_notes
      FROM appointments a JOIN booking_slots bs ON bs.id = a.slot_id
      WHERE a.id = ${body.appointmentId}
    `;
    expect(saved).toEqual({ status: "pending_approval", state: "confirmed", source: "account", client_notes: "Please review my setup." });
    expect(sendBookingRequestReceived).toHaveBeenCalledWith(
      "client@example.com", "Client", "Smart-home consultation", expect.any(Date), "http://localhost:3000/account",
    );
    expect(notifyAdminAppointmentBooked).toHaveBeenCalledWith(body.appointmentId);
    expect(createGoogleEventForAppointment).toHaveBeenCalledWith(body.appointmentId);
  });
});

function nextBookableSlot(hour: number) {
  let local = DateTime.now().setZone("America/Toronto").plus({ days: 7 }).startOf("day");
  while (local.weekday > 5) local = local.plus({ days: 1 });
  const start = local.set({ hour });
  return { date: start.toISODate()!, startsAt: start.toISO()! };
}
