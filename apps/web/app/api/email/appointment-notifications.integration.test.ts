import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetTestData } from "../../../test/integration/database";

const SERVICE_ID = "22222222-2222-4222-8222-222222222222";
const delivery = vi.hoisted(() => ({
  booked: vi.fn().mockResolvedValue(undefined),
  cancelled: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../lib/email", () => ({
  sendAdminAppointmentBooked: delivery.booked,
  sendAdminAppointmentCancelled: delivery.cancelled,
}));

let testSql: ReturnType<typeof postgres>;
let notifications: typeof import("../../../lib/appointment-notifications");

beforeAll(async () => {
  testSql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  notifications = await import("../../../lib/appointment-notifications");
});

beforeEach(async () => {
  await resetTestData(testSql);
  vi.clearAllMocks();
});

afterAll(async () => {
  await testSql?.end();
});

describe("admin appointment notifications", () => {
  it("loads complete client and appointment details for bookings and cancellations", async () => {
    const [customer] = await testSql<{ id: string }[]>`
      INSERT INTO customers (email, name, phone, street_address, unit, city, postal_code, country)
      VALUES ('ada@example.com', 'Ada Lovelace', '6135550100', '123 Main Street', '4B', 'Ottawa', 'K1A 0B1', 'Canada')
      RETURNING id
    `;
    const startsAt = new Date("2026-08-10T17:00:00.000Z");
    const endsAt = new Date("2026-08-10T18:00:00.000Z");
    const [slot] = await testSql<{ id: string }[]>`
      INSERT INTO booking_slots (service_id, starts_at, ends_at, state)
      VALUES (${SERVICE_ID}, ${startsAt}, ${endsAt}, 'confirmed')
      RETURNING id
    `;
    const [appointment] = await testSql<{ id: string }[]>`
      INSERT INTO appointments (slot_id, customer_id, status, source, client_notes)
      VALUES (${slot.id}, ${customer.id}, 'confirmed', 'web', 'Please check the downstairs lights.')
      RETURNING id
    `;

    await notifications.notifyAdminAppointmentBooked(appointment.id);
    await notifications.notifyAdminAppointmentCancelled(appointment.id);

    const expected = expect.objectContaining({
      appointmentId: appointment.id,
      status: "confirmed",
      source: "web",
      clientNotes: "Please check the downstairs lights.",
      customerName: "Ada Lovelace",
      customerEmail: "ada@example.com",
      customerPhone: "6135550100",
      streetAddress: "123 Main Street",
      unit: "4B",
      city: "Ottawa",
      postalCode: "K1A 0B1",
      country: "Canada",
      serviceName: "Smart-home consultation",
      startsAt,
      endsAt,
    });
    expect(delivery.booked).toHaveBeenCalledWith(expected);
    expect(delivery.cancelled).toHaveBeenCalledWith(expected);
  });
});
