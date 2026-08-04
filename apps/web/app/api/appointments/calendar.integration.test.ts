import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetTestData } from "../../../test/integration/database";
import { appointmentCalendarUrl } from "../../../lib/appointment-calendar";

vi.mock("server-only", () => ({}));
vi.mock("../../../lib/google-calendar", () => ({
  getGoogleMeetUrl: vi.fn(async () => "https://meet.google.com/abc-defg-hij"),
}));

const SERVICE_ID = "22222222-2222-4222-8222-222222222222";
let testSql: ReturnType<typeof postgres>;
let downloadCalendar: typeof import("./[id]/calendar/route").GET;

beforeAll(async () => {
  process.env.ADMIN_SESSION_SECRET = "integration-test-session-secret-at-least-32-characters";
  process.env.APP_URL = "http://localhost:3000";
  testSql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  ({ GET: downloadCalendar } = await import("./[id]/calendar/route"));
});

beforeEach(async () => { await resetTestData(testSql); });
afterAll(async () => { await testSql?.end(); });

describe("GET /api/appointments/:id/calendar", () => {
  it("returns a signed calendar file for a confirmed in-person appointment", async () => {
    const [customer] = await testSql<{ id: string }[]>`INSERT INTO customers (email, name) VALUES ('calendar@example.com', 'Calendar Client') RETURNING id`;
    const [slot] = await testSql<{ id: string }[]>`
      INSERT INTO booking_slots (service_id, starts_at, ends_at, state)
      VALUES (${SERVICE_ID}, '2026-09-01T17:00:00Z', '2026-09-01T18:00:00Z', 'confirmed') RETURNING id
    `;
    const [appointment] = await testSql<{ id: string }[]>`
      INSERT INTO appointments (slot_id, customer_id, status, appointment_mode, appointment_street_address, appointment_unit, appointment_city, appointment_postal_code, appointment_country)
      VALUES (${slot.id}, ${customer.id}, 'confirmed', 'in_person', '123 Main Street', '4B', 'Ottawa', 'K1A 0B1', 'Canada') RETURNING id
    `;
    const url = appointmentCalendarUrl(appointment.id);
    const response = await downloadCalendar(new Request(url), { params: Promise.resolve({ id: appointment.id }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/calendar");
    const calendar = await response.text();
    expect(calendar).toContain("BEGIN:VCALENDAR");
    expect(calendar).toContain("SUMMARY:Digital Handyman: Smart-home consultation");
    expect(calendar).toContain("LOCATION:123 Main Street\\, Unit 4B\\, Ottawa K1A 0B1\\, Canada");
  });

  it("rejects an invalid token", async () => {
    const response = await downloadCalendar(new Request("http://localhost/api/appointments/missing/calendar?token=invalid"), { params: Promise.resolve({ id: "missing" }) });
    expect(response.status).toBe(404);
  });

  it("includes the Google Meet join URL in a Meet appointment calendar file", async () => {
    const [customer] = await testSql<{ id: string }[]>`INSERT INTO customers (email, name) VALUES ('meet@example.com', 'Meet Client') RETURNING id`;
    const [slot] = await testSql<{ id: string }[]>`
      INSERT INTO booking_slots (service_id, starts_at, ends_at, state)
      VALUES (${SERVICE_ID}, '2026-09-02T17:00:00Z', '2026-09-02T18:00:00Z', 'confirmed') RETURNING id
    `;
    const [appointment] = await testSql<{ id: string }[]>`
      INSERT INTO appointments (slot_id, customer_id, status, appointment_mode, google_event_id)
      VALUES (${slot.id}, ${customer.id}, 'confirmed', 'google_meet', 'meet-event') RETURNING id
    `;
    const response = await downloadCalendar(new Request(appointmentCalendarUrl(appointment.id)), { params: Promise.resolve({ id: appointment.id }) });
    const calendar = await response.text();

    expect(response.status).toBe(200);
    expect(calendar).toContain("LOCATION:Google Meet");
    expect(calendar).toContain("URL:https://meet.google.com/abc-defg-hij");
    expect(calendar).toContain("Join Google Meet: https://meet.google.com/abc-defg-hij");
  });
});
