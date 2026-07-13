import { DateTime } from "luxon";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetTestData } from "../../../../test/integration/database";

const SERVICE_ID = "22222222-2222-4222-8222-222222222222";
const auth = vi.hoisted(() => ({ isAdmin: false }));
const integrations = vi.hoisted(() => ({
  createGoogleEventForAppointment: vi.fn().mockResolvedValue(undefined),
  deleteGoogleEvent: vi.fn().mockResolvedValue(undefined),
  markCalendarSyncFailure: vi.fn().mockResolvedValue(undefined),
  sendAppointmentCancelled: vi.fn().mockResolvedValue(undefined),
  sendBookingConfirmation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../../lib/admin-auth", () => ({
  requireAdmin: vi.fn(() => auth.isAdmin ? { role: "admin", email: "admin@example.com" } : null),
}));
vi.mock("../../../../lib/email", () => ({
  sendAppointmentCancelled: integrations.sendAppointmentCancelled,
  sendBookingConfirmation: integrations.sendBookingConfirmation,
}));
vi.mock("../../../../lib/google-calendar", () => ({
  createGoogleEventForAppointment: integrations.createGoogleEventForAppointment,
  deleteGoogleEvent: integrations.deleteGoogleEvent,
  markCalendarSyncFailure: integrations.markCalendarSyncFailure,
}));

let testSql: ReturnType<typeof postgres>;
let listAppointments: typeof import("./route").GET;
let createAppointment: typeof import("./route").POST;
let updateAppointment: typeof import("./[id]/route").PATCH;

beforeAll(async () => {
  testSql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  ({ GET: listAppointments, POST: createAppointment } = await import("./route"));
  ({ PATCH: updateAppointment } = await import("./[id]/route"));
});

beforeEach(async () => {
  await resetTestData(testSql);
  auth.isAdmin = false;
  vi.clearAllMocks();
  integrations.createGoogleEventForAppointment.mockResolvedValue(undefined);
  integrations.deleteGoogleEvent.mockResolvedValue(undefined);
  integrations.markCalendarSyncFailure.mockResolvedValue(undefined);
  integrations.sendAppointmentCancelled.mockResolvedValue(undefined);
  integrations.sendBookingConfirmation.mockResolvedValue(undefined);
});

afterAll(async () => {
  await testSql?.end();
});

describe("manual phone appointments", () => {
  it("requires admin access for listing, creation, and editing", async () => {
    expect((await listAppointments()).status).toBe(401);
    expect((await createAppointment(manualAppointmentRequest())).status).toBe(401);
    expect((await updateAppointment(updateRequest({ notes: "No access" }), context("00000000-0000-4000-8000-000000000001"))).status).toBe(401);
  });

  it("validates appointment details before writing anything", async () => {
    auth.isAdmin = true;
    expect((await createAppointment(manualAppointmentRequest({ phone: "555-HELP" }))).status).toBe(400);
    expect((await createAppointment(manualAppointmentRequest({ serviceId: "00000000-0000-4000-8000-000000000099" }))).status).toBe(400);
    expect((await createAppointment(manualAppointmentRequest({ startsAtLocal: "not-a-date" }))).status).toBe(400);
    const [{ count }] = await testSql<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM appointments`;
    expect(count).toBe(0);
  });

  it("does not create new phone appointments for a disabled service", async () => {
    auth.isAdmin = true;
    await testSql`UPDATE services SET active = false WHERE id = ${SERVICE_ID}`;
    expect((await createAppointment(manualAppointmentRequest())).status).toBe(400);
    const [{ count }] = await testSql<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM appointments`;
    expect(count).toBe(0);
  });

  it("creates a confirmed phone appointment in the business timezone", async () => {
    auth.isAdmin = true;
    const startsAt = futureLocalTime(10);
    const response = await createAppointment(manualAppointmentRequest({ startsAtLocal: startsAt.toFormat("yyyy-MM-dd'T'HH:mm") }));
    expect(response.status).toBe(201);
    const body = await response.json() as { id: string };

    const [saved] = await testSql<{
      email: string; name: string; phone: string; status: string; source: string; notes: string;
      starts_at: Date; ends_at: Date; state: string;
    }[]>`
      SELECT c.email, c.name, c.phone, a.status, a.source, a.notes, bs.starts_at, bs.ends_at, bs.state
      FROM appointments a
      JOIN customers c ON c.id = a.customer_id
      JOIN booking_slots bs ON bs.id = a.slot_id
      WHERE a.id = ${body.id}
    `;
    expect(saved).toMatchObject({
      email: "phone@example.com", name: "Phone Customer", phone: "4165550100",
      status: "confirmed", source: "phone", notes: "Called about a smart thermostat", state: "confirmed",
    });
    expect(saved.starts_at.toISOString()).toBe(startsAt.toUTC().toISO());
    expect(saved.ends_at.getTime() - saved.starts_at.getTime()).toBe(60 * 60 * 1000);
    expect(integrations.sendBookingConfirmation).toHaveBeenCalledWith(
      "phone@example.com", "Phone Customer", "Smart-home consultation", saved.starts_at,
    );
    expect(integrations.createGoogleEventForAppointment).toHaveBeenCalledWith(body.id);
  });

  it("updates a returning customer without creating a duplicate or replacing account credentials", async () => {
    auth.isAdmin = true;
    await testSql`
      INSERT INTO customers (email, name, phone, password_hash)
      VALUES ('phone@example.com', 'Previous Name', '1112223333', 'existing-password-hash')
    `;
    expect((await createAppointment(manualAppointmentRequest({ name: "Updated Name", phone: "6475550199" }))).status).toBe(201);

    const [customer] = await testSql<{ count: number; name: string; phone: string; password_hash: string }[]>`
      SELECT COUNT(*) OVER ()::int AS count, name, phone, password_hash
      FROM customers WHERE email = 'phone@example.com'
    `;
    expect(customer).toEqual({ count: 1, name: "Updated Name", phone: "6475550199", password_hash: "existing-password-hash" });
  });

  it("allows only one of two simultaneous phone bookings for the same time", async () => {
    auth.isAdmin = true;
    const requestData = { startsAtLocal: futureLocalTime(10).toFormat("yyyy-MM-dd'T'HH:mm") };
    const responses = await Promise.all([
      createAppointment(manualAppointmentRequest({ ...requestData, email: "first-phone@example.com", name: "First Caller" })),
      createAppointment(manualAppointmentRequest({ ...requestData, email: "second-phone@example.com", name: "Second Caller" })),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const [{ count }] = await testSql<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM appointments`;
    expect(count).toBe(1);
  });

  it("keeps the appointment when email and calendar synchronization fail", async () => {
    auth.isAdmin = true;
    integrations.sendBookingConfirmation.mockRejectedValueOnce(new Error("Email unavailable"));
    integrations.createGoogleEventForAppointment.mockRejectedValueOnce(new Error("Calendar unavailable"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await createAppointment(manualAppointmentRequest());
    expect(response.status).toBe(201);
    const { id } = await response.json() as { id: string };
    const [{ count }] = await testSql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM appointments WHERE id = ${id} AND status = 'confirmed'
    `;
    expect(count).toBe(1);
    expect(integrations.markCalendarSyncFailure).toHaveBeenCalledWith(id, expect.any(Error));
    expect(errorLog).toHaveBeenCalledTimes(2);
    errorLog.mockRestore();
  });
});

describe("admin appointment status and notes", () => {
  it("validates edits and reports missing appointments", async () => {
    auth.isAdmin = true;
    expect((await updateAppointment(updateRequest({ status: "invalid" }), context("00000000-0000-4000-8000-000000000001"))).status).toBe(400);
    expect((await updateAppointment(updateRequest({ notes: "x".repeat(2001) }), context("00000000-0000-4000-8000-000000000001"))).status).toBe(400);
    expect((await updateAppointment(updateRequest({ notes: "Valid" }), context("not-a-uuid"))).status).toBe(400);
    expect((await updateAppointment(updateRequest({ notes: "Valid" }), context("00000000-0000-4000-8000-000000000001"))).status).toBe(404);
  });

  it("edits and trims notes without changing status, slot state, or integrations", async () => {
    auth.isAdmin = true;
    const appointment = await seedAppointment();
    const response = await updateAppointment(updateRequest({ notes: "  Updated admin note  " }), context(appointment.id));
    expect(response.status).toBe(200);
    const [saved] = await savedAppointment(appointment.id);
    expect(saved).toMatchObject({ notes: "Updated admin note", status: "confirmed", state: "confirmed" });
    expect(integrations.sendAppointmentCancelled).not.toHaveBeenCalled();
    expect(integrations.deleteGoogleEvent).not.toHaveBeenCalled();
  });

  it.each(["completed", "no_show"] as const)("marks an appointment %s and releases its slot without cancellation messages", async (status) => {
    auth.isAdmin = true;
    const appointment = await seedAppointment();
    expect((await updateAppointment(updateRequest({ status }), context(appointment.id))).status).toBe(200);
    const [saved] = await savedAppointment(appointment.id);
    expect(saved).toMatchObject({ status, state: "released" });
    expect(integrations.sendAppointmentCancelled).not.toHaveBeenCalled();
    expect(integrations.deleteGoogleEvent).not.toHaveBeenCalled();
  });

  it("cancels once, releases the slot, and sends email and calendar side effects once", async () => {
    auth.isAdmin = true;
    const appointment = await seedAppointment("google-event-1");
    const first = await updateAppointment(updateRequest({ status: "cancelled", notes: "Customer called to cancel" }), context(appointment.id));
    expect(first.status).toBe(200);
    const [saved] = await savedAppointment(appointment.id);
    expect(saved).toMatchObject({ status: "cancelled", state: "released", notes: "Customer called to cancel" });
    expect(integrations.sendAppointmentCancelled).toHaveBeenCalledOnce();
    expect(integrations.deleteGoogleEvent).toHaveBeenCalledWith("google-event-1", appointment.id);

    expect((await updateAppointment(updateRequest({ status: "cancelled" }), context(appointment.id))).status).toBe(200);
    expect(integrations.sendAppointmentCancelled).toHaveBeenCalledOnce();
    expect(integrations.deleteGoogleEvent).toHaveBeenCalledOnce();
  });

  it("lists appointments newest first with phone-booking details", async () => {
    auth.isAdmin = true;
    await seedAppointment(null, futureLocalTime(9), "Older Customer");
    await seedAppointment(null, futureLocalTime(15), "Newer Customer");
    const response = await listAppointments();
    expect(response.status).toBe(200);
    const body = await response.json() as { appointments: Array<{ customerName: string; source: string; serviceName: string }> };
    expect(body.appointments.map((appointment) => appointment.customerName)).toEqual(["Newer Customer", "Older Customer"]);
    expect(body.appointments.every((appointment) => appointment.source === "phone")).toBe(true);
    expect(body.appointments.every((appointment) => appointment.serviceName === "Smart-home consultation")).toBe(true);
  });
});

async function seedAppointment(googleEventId: string | null = null, startsAt = futureLocalTime(10), name = "Status Customer") {
  const email = `${name.toLowerCase().replace(/\s+/g, "-")}@example.com`;
  const [customer] = await testSql<{ id: string }[]>`
    INSERT INTO customers (email, name) VALUES (${email}, ${name}) RETURNING id
  `;
  const [slot] = await testSql<{ id: string }[]>`
    INSERT INTO booking_slots (service_id, starts_at, ends_at, state)
    VALUES (${SERVICE_ID}, ${startsAt.toUTC().toJSDate()}, ${startsAt.plus({ hours: 1 }).toUTC().toJSDate()}, 'confirmed')
    RETURNING id
  `;
  const [appointment] = await testSql<{ id: string }[]>`
    INSERT INTO appointments (slot_id, customer_id, status, source, google_event_id)
    VALUES (${slot.id}, ${customer.id}, 'confirmed', 'phone', ${googleEventId}) RETURNING id
  `;
  return { id: appointment.id, slotId: slot.id };
}

function savedAppointment(id: string) {
  return testSql<{ notes: string; status: string; state: string }[]>`
    SELECT a.notes, a.status, bs.state
    FROM appointments a JOIN booking_slots bs ON bs.id = a.slot_id
    WHERE a.id = ${id}
  `;
}

function futureLocalTime(hour: number) {
  let day = DateTime.now().setZone("America/Toronto").plus({ days: 12 }).startOf("day");
  while (day.weekday > 5) day = day.plus({ days: 1 });
  return day.set({ hour });
}

function manualAppointmentRequest(overrides: Record<string, unknown> = {}) {
  return jsonRequest("/api/admin/appointments", {
    serviceId: SERVICE_ID,
    startsAtLocal: futureLocalTime(10).toFormat("yyyy-MM-dd'T'HH:mm"),
    name: "Phone Customer",
    email: "PHONE@EXAMPLE.COM",
    phone: "4165550100",
    notes: "Called about a smart thermostat",
    ...overrides,
  });
}

function updateRequest(body: Record<string, unknown>) {
  return jsonRequest("/api/admin/appointments/id", body, "PATCH");
}

function jsonRequest(path: string, body: unknown, method = "POST") {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}
