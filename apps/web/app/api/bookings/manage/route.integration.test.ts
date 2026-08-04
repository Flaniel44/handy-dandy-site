import { createHash, randomBytes } from "node:crypto";
import { DateTime } from "luxon";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetTestData } from "../../../../test/integration/database";

const SERVICE_ID = "22222222-2222-4222-8222-222222222222";
const integrations = vi.hoisted(() => ({
  deleteGoogleEvent: vi.fn().mockResolvedValue(undefined),
  markCalendarSyncFailure: vi.fn().mockResolvedValue(undefined),
  notifyAdminAppointmentCancelled: vi.fn().mockResolvedValue(undefined),
  sendAppointmentCancelled: vi.fn().mockResolvedValue(undefined),
  sendAppointmentRescheduled: vi.fn().mockResolvedValue(undefined),
  updateGoogleEventForAppointment: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../../lib/appointment-notifications", () => ({
  notifyAdminAppointmentCancelled: integrations.notifyAdminAppointmentCancelled,
}));
vi.mock("../../../../lib/email", () => ({
  sendAppointmentCancelled: integrations.sendAppointmentCancelled,
  sendAppointmentRescheduled: integrations.sendAppointmentRescheduled,
}));
vi.mock("../../../../lib/google-calendar", () => ({
  deleteGoogleEvent: integrations.deleteGoogleEvent,
  getGoogleBusyRanges: vi.fn().mockResolvedValue([]),
  markCalendarSyncFailure: integrations.markCalendarSyncFailure,
  updateGoogleEventForAppointment: integrations.updateGoogleEventForAppointment,
}));

let testSql: ReturnType<typeof postgres>;
let getManagedAppointment: typeof import("./route").GET;
let rescheduleManagedAppointment: typeof import("./route").PATCH;
let cancelManagedAppointment: typeof import("./route").DELETE;

beforeAll(async () => {
  process.env.ADMIN_SESSION_SECRET = "integration-test-session-secret-at-least-32-characters";
  testSql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  ({ GET: getManagedAppointment, PATCH: rescheduleManagedAppointment, DELETE: cancelManagedAppointment } = await import("./route"));
});

beforeEach(async () => {
  await resetTestData(testSql);
  vi.clearAllMocks();
});

afterAll(async () => {
  await testSql?.end();
});

describe("guest appointment management", () => {
  it("rejects malformed and unknown private tokens", async () => {
    expect((await getManagedAppointment(manageRequest("bad"))).status).toBe(404);
    expect((await getManagedAppointment(manageRequest(randomBytes(32).toString("base64url")))).status).toBe(404);
  });

  it("loads, reschedules with token rotation, and cancels a guest appointment", async () => {
    const original = bookableTime(7, 9);
    const replacement = bookableTime(8, 11);
    const seeded = await seedManagedAppointment(original);

    const initial = await getManagedAppointment(manageRequest(seeded.token));
    expect(initial.status).toBe(200);
    expect((await initial.json() as { appointment: { serviceName: string; canManage: boolean } }).appointment)
      .toMatchObject({ serviceName: "Smart-home consultation", canManage: true });

    const moved = await rescheduleManagedAppointment(manageRequest(seeded.token, "PATCH", {
      date: replacement.date,
      startsAt: replacement.startsAt,
    }));
    expect(moved.status).toBe(200);
    const nextToken = (await moved.json() as { token: string }).token;
    expect(nextToken).not.toBe(seeded.token);
    expect((await getManagedAppointment(manageRequest(seeded.token))).status).toBe(404);
    expect((await getManagedAppointment(manageRequest(nextToken))).status).toBe(200);
    expect(integrations.sendAppointmentRescheduled).toHaveBeenCalledWith(
      "guest@example.com", "Guest Customer", "Smart-home consultation", new Date(original.startsAt), new Date(replacement.startsAt),
      expect.stringContaining(`/book/manage?token=${nextToken}`),
      expect.stringContaining(`/api/appointments/${seeded.appointmentId}/calendar?token=`),
    );
    expect(integrations.updateGoogleEventForAppointment).toHaveBeenCalledWith(seeded.appointmentId);

    const cancelled = await cancelManagedAppointment(manageRequest(nextToken, "DELETE"));
    expect(cancelled.status).toBe(200);
    const [saved] = await testSql<{ status: string; state: string }[]>`
      SELECT a.status, bs.state FROM appointments a
      JOIN booking_slots bs ON bs.id = a.slot_id WHERE a.id = ${seeded.appointmentId}
    `;
    expect(saved).toEqual({ status: "cancelled", state: "released" });
    expect(integrations.sendAppointmentCancelled).toHaveBeenCalledWith(
      "guest@example.com", "Guest Customer", "Smart-home consultation", new Date(replacement.startsAt), "http://localhost/book",
    );
    expect(integrations.notifyAdminAppointmentCancelled).toHaveBeenCalledWith(seeded.appointmentId);
    expect(integrations.deleteGoogleEvent).toHaveBeenCalledWith("google-event", seeded.appointmentId);
  });
});

async function seedManagedAppointment(slot: ReturnType<typeof bookableTime>) {
  const token = randomBytes(32).toString("base64url");
  const [customer] = await testSql<{ id: string }[]>`
    INSERT INTO customers (email, name) VALUES ('guest@example.com', 'Guest Customer') RETURNING id
  `;
  const [bookingSlot] = await testSql<{ id: string }[]>`
    INSERT INTO booking_slots (service_id, starts_at, ends_at, state)
    VALUES (${SERVICE_ID}, ${new Date(slot.startsAt)}, ${new Date(slot.endsAt)}, 'confirmed') RETURNING id
  `;
  const [appointment] = await testSql<{ id: string }[]>`
    INSERT INTO appointments (slot_id, customer_id, status, client_notes, google_event_id)
    VALUES (${bookingSlot.id}, ${customer.id}, 'confirmed', 'Guest note', 'google-event') RETURNING id
  `;
  await testSql`
    INSERT INTO guest_appointment_management_tokens (appointment_id, token_hash, expires_at)
    VALUES (${appointment.id}, ${createHash("sha256").update(token).digest("hex")}, ${new Date(new Date(slot.endsAt).getTime() + 86_400_000)})
  `;
  return { token, appointmentId: appointment.id };
}

function manageRequest(token: string, method = "GET", body?: unknown) {
  return new Request("http://localhost/api/bookings/manage", {
    method,
    headers: { "Content-Type": "application/json", "X-Appointment-Token": token },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function bookableTime(businessDaysAhead: number, hour: number) {
  let day = DateTime.now().setZone("America/Toronto").startOf("day");
  let remaining = businessDaysAhead;
  while (remaining > 0) { day = day.plus({ days: 1 }); if (day.weekday <= 5) remaining -= 1; }
  const start = day.set({ hour });
  return { date: start.toISODate()!, startsAt: start.toISO()!, endsAt: start.plus({ hours: 1 }).toISO()! };
}
