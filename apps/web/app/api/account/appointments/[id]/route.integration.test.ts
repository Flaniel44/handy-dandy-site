import { DateTime } from "luxon";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetTestData } from "../../../../../test/integration/database";

const SERVICE_ID = "22222222-2222-4222-8222-222222222222";

type CustomerSession = {
  role: "customer";
  email: string;
  customerId: string;
  firstName: string;
  authVersion: number;
  expiresAt: number;
};

const auth = vi.hoisted(() => ({ session: null as CustomerSession | null }));
const integrations = vi.hoisted(() => ({
  deleteGoogleEvent: vi.fn().mockResolvedValue(undefined),
  markCalendarSyncFailure: vi.fn().mockResolvedValue(undefined),
  sendAppointmentCancelled: vi.fn().mockResolvedValue(undefined),
  sendAppointmentRescheduled: vi.fn().mockResolvedValue(undefined),
  updateGoogleEventForAppointment: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../../../lib/admin-auth", () => ({
  requireCustomer: vi.fn(() => auth.session),
}));
vi.mock("../../../../../lib/email", () => ({
  sendAppointmentCancelled: integrations.sendAppointmentCancelled,
  sendAppointmentRescheduled: integrations.sendAppointmentRescheduled,
}));
vi.mock("../../../../../lib/google-calendar", () => ({
  deleteGoogleEvent: integrations.deleteGoogleEvent,
  getGoogleBusyRanges: vi.fn().mockResolvedValue([]),
  markCalendarSyncFailure: integrations.markCalendarSyncFailure,
  updateGoogleEventForAppointment: integrations.updateGoogleEventForAppointment,
}));

let testSql: ReturnType<typeof postgres>;
let cancelAppointment: typeof import("./route").DELETE;
let rescheduleAppointment: typeof import("./route").PATCH;

beforeAll(async () => {
  testSql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  ({ DELETE: cancelAppointment, PATCH: rescheduleAppointment } = await import("./route"));
});

beforeEach(async () => {
  await resetTestData(testSql);
  auth.session = null;
  vi.clearAllMocks();
});

afterAll(async () => {
  await testSql?.end();
});

describe("customer appointment lifecycle routes", () => {
  it("rejects unauthenticated cancellation", async () => {
    const response = await cancelAppointment(new Request("http://localhost"), context("00000000-0000-4000-8000-000000000000"));
    expect(response.status).toBe(401);
  });

  it("cancels an owned appointment once and releases its slot", async () => {
    const customerId = await seedCustomer("owner@example.com", "Owner");
    auth.session = sessionFor(customerId, "owner@example.com", "Owner");
    const appointment = await seedAppointment(customerId, futureSlot(8, 9), "google-event-1");

    const response = await cancelAppointment(new Request("http://localhost"), context(appointment.id));
    expect(response.status).toBe(200);

    const [saved] = await testSql<{ status: string; state: string }[]>`
      SELECT a.status, bs.state
      FROM appointments a JOIN booking_slots bs ON bs.id = a.slot_id
      WHERE a.id = ${appointment.id}
    `;
    expect(saved).toEqual({ status: "cancelled", state: "released" });
    expect(integrations.sendAppointmentCancelled).toHaveBeenCalledOnce();
    expect(integrations.deleteGoogleEvent).toHaveBeenCalledWith("google-event-1", appointment.id);

    const repeated = await cancelAppointment(new Request("http://localhost"), context(appointment.id));
    expect(repeated.status).toBe(409);
    expect(integrations.sendAppointmentCancelled).toHaveBeenCalledOnce();
  });

  it("does not allow a customer to cancel another customer's appointment", async () => {
    const ownerId = await seedCustomer("owner@example.com", "Owner");
    const otherId = await seedCustomer("other@example.com", "Other");
    auth.session = sessionFor(otherId, "other@example.com", "Other");
    const appointment = await seedAppointment(ownerId, futureSlot(8, 9));

    const response = await cancelAppointment(new Request("http://localhost"), context(appointment.id));
    expect(response.status).toBe(409);
    const [{ status }] = await testSql<{ status: string }[]>`
      SELECT status FROM appointments WHERE id = ${appointment.id}
    `;
    expect(status).toBe("confirmed");
  });

  it("reschedules an owned appointment and releases the previous slot", async () => {
    const customerId = await seedCustomer("owner@example.com", "Owner");
    auth.session = sessionFor(customerId, "owner@example.com", "Owner");
    const oldTime = futureSlot(8, 9);
    const newTime = futureSlot(9, 10);
    const appointment = await seedAppointment(customerId, oldTime);

    const response = await rescheduleAppointment(rescheduleRequest(newTime), context(appointment.id));
    expect(response.status).toBe(200);

    const slots = await testSql<{ id: string; starts_at: Date; state: string }[]>`
      SELECT bs.id, bs.starts_at, bs.state
      FROM booking_slots bs
      WHERE bs.id = ${appointment.slotId}
         OR bs.id = (SELECT slot_id FROM appointments WHERE id = ${appointment.id})
      ORDER BY bs.starts_at
    `;
    expect(slots).toHaveLength(2);
    expect(slots.find((slot) => slot.id === appointment.slotId)?.state).toBe("released");
    expect(slots.find((slot) => slot.id !== appointment.slotId)?.state).toBe("confirmed");
    expect(integrations.sendAppointmentRescheduled).toHaveBeenCalledOnce();
    expect(integrations.updateGoogleEventForAppointment).toHaveBeenCalledWith(appointment.id);
  });

  it("returns one conflict when two appointments race for the same new slot", async () => {
    const customerId = await seedCustomer("owner@example.com", "Owner");
    auth.session = sessionFor(customerId, "owner@example.com", "Owner");
    const first = await seedAppointment(customerId, futureSlot(8, 9));
    const second = await seedAppointment(customerId, futureSlot(8, 10));
    const target = futureSlot(9, 9);

    const responses = await Promise.all([
      rescheduleAppointment(rescheduleRequest(target), context(first.id)),
      rescheduleAppointment(rescheduleRequest(target), context(second.id)),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const [{ count }] = await testSql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM booking_slots
      WHERE starts_at = ${new Date(target.startsAt)} AND state = 'confirmed'
    `;
    expect(count).toBe(1);
  });
});

async function seedCustomer(email: string, firstName: string) {
  const [customer] = await testSql<{ id: string }[]>`
    INSERT INTO customers (email, name, first_name, last_name, auth_version)
    VALUES (${email}, ${firstName}, ${firstName}, 'Customer', 1)
    RETURNING id
  `;
  return customer.id;
}

async function seedAppointment(
  customerId: string,
  slot: { startsAt: string; endsAt: string },
  googleEventId: string | null = null,
) {
  const [bookingSlot] = await testSql<{ id: string }[]>`
    INSERT INTO booking_slots (service_id, starts_at, ends_at, state)
    VALUES (${SERVICE_ID}, ${new Date(slot.startsAt)}, ${new Date(slot.endsAt)}, 'confirmed')
    RETURNING id
  `;
  const [appointment] = await testSql<{ id: string }[]>`
    INSERT INTO appointments (slot_id, customer_id, status, google_event_id)
    VALUES (${bookingSlot.id}, ${customerId}, 'confirmed', ${googleEventId})
    RETURNING id
  `;
  return { id: appointment.id, slotId: bookingSlot.id };
}

function futureSlot(daysAhead: number, hour: number) {
  let day = DateTime.now().setZone("America/Toronto").plus({ days: daysAhead }).startOf("day");
  while (day.weekday > 5) day = day.plus({ days: 1 });
  const start = day.set({ hour });
  return { date: start.toISODate()!, startsAt: start.toISO()!, endsAt: start.plus({ hours: 1 }).toISO()! };
}

function rescheduleRequest(slot: { date: string; startsAt: string }) {
  return new Request("http://localhost/api/account/appointments/id", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date: slot.date, startsAt: slot.startsAt }),
  });
}

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

function sessionFor(customerId: string, email: string, firstName: string): CustomerSession {
  return { role: "customer", customerId, email, firstName, authVersion: 1, expiresAt: Date.now() + 60_000 };
}
