import { DateTime } from "luxon";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetTestData } from "../../../test/integration/database";

const SERVICE_ID = "22222222-2222-4222-8222-222222222222";
const testDatabaseUrl = process.env.DATABASE_URL!;

const sendGuestBookingVerification = vi.fn().mockResolvedValue(undefined);
const sendBookingRequestReceived = vi.fn().mockResolvedValue(undefined);
const createGoogleEventForAppointment = vi.fn().mockResolvedValue(undefined);
const markCalendarSyncFailure = vi.fn().mockResolvedValue(undefined);
const notifyAdminAppointmentBooked = vi.fn().mockResolvedValue(undefined);

vi.mock("server-only", () => ({}));
vi.mock("../../../lib/email", () => ({ sendGuestBookingVerification, sendBookingRequestReceived }));
vi.mock("../../../lib/appointment-notifications", () => ({ notifyAdminAppointmentBooked }));
vi.mock("../../../lib/google-calendar", () => ({
  createGoogleEventForAppointment,
  getGoogleBusyRanges: vi.fn().mockResolvedValue([]),
  markCalendarSyncFailure,
}));

let testSql: ReturnType<typeof postgres>;
let postBooking: typeof import("./route").POST;
let confirmBooking: typeof import("./confirm/route").POST;

beforeAll(async () => {
  testSql = postgres(testDatabaseUrl, { max: 1, prepare: false });
  ({ POST: postBooking } = await import("./route"));
  ({ POST: confirmBooking } = await import("./confirm/route"));
});

beforeEach(async () => {
  await resetTestData(testSql);
  vi.clearAllMocks();
});

afterAll(async () => {
  await testSql?.end();
});

describe("POST /api/bookings", () => {
  it("requires contact details for the selected appointment format", async () => {
    const slot = nextBookableSlot(9);
    const shortPhone = await postBooking(bookingRequest(slot, { name: "Phone Guest", email: "phone@example.com", appointmentPhone: "123" }));
    const missingAddress = await postBooking(bookingRequest(slot, { name: "Visit Guest", email: "visit@example.com", appointmentMode: "in_person", appointmentPhone: "" }));
    expect(shortPhone.status).toBe(400);
    expect(missingAddress.status).toBe(400);
    expect(await confirmationCount()).toBe(0);
  });

  it("holds a guest slot until its email token is explicitly confirmed", async () => {
    const slot = nextBookableSlot(9);
    const response = await postBooking(bookingRequest(slot, {
      name: "Ada Lovelace",
      email: "ADA@EXAMPLE.COM",
      notes: "Please check the living-room lights.",
      appointmentMode: "in_person",
      appointmentPhone: "",
      appointmentStreetAddress: "123 Main Street",
      appointmentUnit: "4B",
      appointmentCity: "Ottawa",
      appointmentPostalCode: "K1A 0B1",
      appointmentCountry: "Canada",
    }));

    expect(response.status).toBe(202);
    const body = await response.json() as { confirmationRequired: boolean; expiresAt: string };
    expect(body.confirmationRequired).toBe(true);
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const [saved] = await testSql<{
      email: string;
      name: string;
      state: string;
      client_notes: string;
      appointment_mode: string;
      appointment_street_address: string;
    }[]>`
      SELECT gbc.email, gbc.name, bs.state, gbc.client_notes, gbc.appointment_mode, gbc.appointment_street_address
      FROM guest_booking_confirmations gbc
      JOIN booking_slots bs ON bs.id = gbc.slot_id
    `;
    expect(saved).toEqual({
      email: "ada@example.com",
      name: "Ada Lovelace",
      state: "held",
      client_notes: "Please check the living-room lights.",
      appointment_mode: "in_person",
      appointment_street_address: "123 Main Street",
    });
    expect(await appointmentCount()).toBe(0);
    expect(sendGuestBookingVerification).toHaveBeenCalledOnce();
    expect(sendBookingRequestReceived).not.toHaveBeenCalled();
    expect(notifyAdminAppointmentBooked).not.toHaveBeenCalled();
    expect(createGoogleEventForAppointment).not.toHaveBeenCalled();

    const token = verificationToken();
    const confirmation = await confirmBookingRequest(token);
    expect(confirmation.status).toBe(303);
    expect(confirmation.headers.get("location")).toBe("http://localhost/book/confirmation?status=requested");

    const [confirmed] = await testSql<{
      email: string;
      name: string;
      status: string;
      state: string;
      client_notes: string;
      appointment_id: string;
      appointment_mode: string;
      appointment_street_address: string;
    }[]>`
      SELECT c.email, c.name, a.status, bs.state, a.client_notes, a.appointment_mode, a.appointment_street_address, a.id AS appointment_id
      FROM appointments a
      JOIN customers c ON c.id = a.customer_id
      JOIN booking_slots bs ON bs.id = a.slot_id
    `;
    expect(confirmed).toMatchObject({
      email: "ada@example.com",
      name: "Ada Lovelace",
      status: "pending_approval",
      state: "confirmed",
      client_notes: "Please check the living-room lights.",
      appointment_mode: "in_person",
      appointment_street_address: "123 Main Street",
    });
    expect(sendBookingRequestReceived).toHaveBeenCalledOnce();
    expect(sendBookingRequestReceived.mock.calls[0]?.[4]).toMatch(/^http:\/\/localhost\/book\/manage\?token=/);
    expect(notifyAdminAppointmentBooked).toHaveBeenCalledWith(confirmed.appointment_id);
    expect(createGoogleEventForAppointment).toHaveBeenCalledWith(confirmed.appointment_id);
    expect(await confirmationCount()).toBe(0);
    expect(await managementTokenCount()).toBe(1);

    const replay = await confirmBookingRequest(token);
    expect(replay.headers.get("location")).toBe("http://localhost/book/confirmation?status=invalid");
    expect(await appointmentCount()).toBe(1);
    expect(createGoogleEventForAppointment).toHaveBeenCalledTimes(1);
    expect(notifyAdminAppointmentBooked).toHaveBeenCalledTimes(1);
  });

  it("updates a returning guest instead of creating a duplicate customer", async () => {
    const first = nextBookableSlot(9);
    const second = nextBookableSlot(11);

    expect((await postBooking(bookingRequest(first, {
      name: "Old Name",
      email: "returning@example.com",
    }))).status).toBe(202);
    expect((await confirmBookingRequest(verificationToken())).status).toBe(303);
    vi.clearAllMocks();
    expect((await postBooking(bookingRequest(second, {
      name: "New Name",
      email: "RETURNING@example.com",
    }))).status).toBe(202);
    expect((await confirmBookingRequest(verificationToken())).status).toBe(303);

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

    expect([first.status, second.status].sort()).toEqual([202, 409]);
    expect(await appointmentCount()).toBe(0);
    expect(await confirmationCount()).toBe(1);
  });

  it("releases the provisional hold when its verification email cannot be delivered", async () => {
    const slot = nextBookableSlot(9);
    sendGuestBookingVerification.mockRejectedValueOnce(new Error("Resend unavailable"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await postBooking(bookingRequest(slot, {
      name: "Reliable Guest", email: "reliable@example.com",
    }));

    expect(response.status).toBe(503);
    expect(await appointmentCount()).toBe(0);
    expect(await confirmationCount()).toBe(0);
    const [{ count: slotCount }] = await testSql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM booking_slots
    `;
    expect(slotCount).toBe(0);
    expect(createGoogleEventForAppointment).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith("Unable to send guest booking verification", expect.any(Error));
    errorLog.mockRestore();
  });

  it("expires an unconfirmed hold without creating a customer, appointment, or calendar event", async () => {
    const slot = nextBookableSlot(9);
    expect((await postBooking(bookingRequest(slot, {
      name: "Late Guest", email: "late@example.com",
    }))).status).toBe(202);
    const token = verificationToken();
    await testSql`UPDATE guest_booking_confirmations SET expires_at = now() - interval '1 minute'`;
    await testSql`UPDATE booking_slots SET expires_at = now() - interval '1 minute'`;

    const response = await confirmBookingRequest(token);
    expect(response.headers.get("location")).toBe("http://localhost/book/confirmation?status=expired");
    const [savedSlot] = await testSql<{ state: string }[]>`SELECT state FROM booking_slots`;
    expect(savedSlot.state).toBe("expired");
    expect(await appointmentCount()).toBe(0);
    expect(createGoogleEventForAppointment).not.toHaveBeenCalled();

    const replacement = await postBooking(bookingRequest(slot, {
      name: "Replacement Guest", email: "replacement@example.com",
    }));
    expect(replacement.status).toBe(202);
    expect(await confirmationCount()).toBe(1);
  });
});

function verificationToken() {
  const call = sendGuestBookingVerification.mock.calls.at(-1);
  expect(call).toBeTruthy();
  return call![4] as string;
}

function confirmBookingRequest(token: string) {
  return confirmBooking(new Request("http://localhost/api/bookings/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }));
}

async function appointmentCount() {
  const [{ count }] = await testSql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM appointments
  `;
  return count;
}

async function confirmationCount() {
  const [{ count }] = await testSql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM guest_booking_confirmations
  `;
  return count;
}

async function managementTokenCount() {
  const [{ count }] = await testSql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM guest_appointment_management_tokens
  `;
  return count;
}

function nextBookableSlot(hour: number) {
  let local = DateTime.now().setZone("America/Toronto").plus({ days: 7 }).startOf("day");
  while (local.weekday > 5) local = local.plus({ days: 1 });
  const start = local.set({ hour });
  return { date: start.toISODate()!, startsAt: start.toISO()! };
}

function bookingRequest(
  slot: { date: string; startsAt: string },
  customer: { name: string; email: string; notes?: string; appointmentMode?: "phone" | "in_person"; appointmentPhone?: string; appointmentStreetAddress?: string; appointmentUnit?: string; appointmentCity?: string; appointmentPostalCode?: string; appointmentCountry?: string },
) {
  return new Request("http://localhost/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serviceId: SERVICE_ID, ...slot, notes: "", appointmentMode: "phone", appointmentPhone: "3435961813", ...customer }),
  });
}
