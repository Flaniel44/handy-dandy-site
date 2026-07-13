import { DateTime } from "luxon";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetTestData } from "../../../../test/integration/database";

const SERVICE_ID = "22222222-2222-4222-8222-222222222222";
const googleState = {
  events: [] as GoogleEvent[],
  createEventId: "created-google-event",
  createStatus: 200,
  updateStatus: 200,
  deleteStatus: 204,
};

vi.mock("server-only", () => ({}));

let testSql: ReturnType<typeof postgres>;
let fetchMock: ReturnType<typeof vi.fn>;
let calendar: typeof import("../../../../lib/google-calendar");

beforeAll(async () => {
  process.env.GOOGLE_CLIENT_ID = "integration-client";
  process.env.GOOGLE_CLIENT_SECRET = "integration-secret";
  process.env.GOOGLE_CALENDAR_ID = "primary";
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.APP_URL = "http://localhost:3000";
  process.env.BUSINESS_TIMEZONE = "America/Toronto";
  testSql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  calendar = await import("../../../../lib/google-calendar");
});

beforeEach(async () => {
  await resetTestData(testSql);
  googleState.events = [];
  googleState.createEventId = "created-google-event";
  googleState.createStatus = 200;
  googleState.updateStatus = 200;
  googleState.deleteStatus = 204;
  fetchMock = vi.fn(googleFetchImplementation);
  vi.stubGlobal("fetch", fetchMock);
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await testSql?.end();
});

describe("Google Calendar integration", () => {
  it("stores an encrypted refresh token and interprets timed, all-day, free, and cancelled events", async () => {
    await connect();
    const day = futureDay();
    googleState.events = [
      timedEvent("busy", "Client meeting", day, 10, 12),
      { ...timedEvent("free", "Optional event", day, 13, 14), transparency: "transparent" },
      {
        id: "all-day", summary: "Conference", start: { date: day.toISODate()! },
        end: { date: day.plus({ days: 2 }).toISODate()! },
      },
      { ...timedEvent("cancelled", "Deleted", day, 15, 16), status: "cancelled" },
    ];

    const events = await calendar.getGoogleAvailabilityEvents(
      day.startOf("day").toUTC().toJSDate(),
      day.plus({ days: 3 }).startOf("day").toUTC().toJSDate(),
    );
    expect(events.map((event) => event.id)).toEqual(["busy", "free", "all-day"]);
    expect(events.find((event) => event.id === "busy")).toMatchObject({ googleBusy: true, blocksAvailability: true, isAllDay: false });
    expect(events.find((event) => event.id === "free")).toMatchObject({ googleBusy: false, blocksAvailability: false });
    expect(events.find((event) => event.id === "all-day")).toMatchObject({ isAllDay: true, blocksAvailability: true });

    const [connection] = await testSql<{ encrypted_refresh_token: string }[]>`
      SELECT encrypted_refresh_token FROM google_calendar_connections
    `;
    expect(connection.encrypted_refresh_token).not.toContain("integration-refresh-token");
    expect(connection.encrypted_refresh_token.split(".")).toHaveLength(3);
    const refreshRequest = fetchMock.mock.calls.find(([input, init]) =>
      String(input).includes("oauth2.googleapis.com/token") && String(init?.body).includes("grant_type=refresh_token"));
    expect(refreshRequest).toBeTruthy();
    expect(String(refreshRequest?.[1]?.body)).toContain("refresh_token=integration-refresh-token");
    const eventRequest = fetchMock.mock.calls.find(([input]) => String(input).includes("googleapis.com/calendar/v3/calendars"));
    expect(new Headers(eventRequest?.[1]?.headers).get("Authorization")).toBe("Bearer integration-access-token");
  });

  it("applies availability overrides and ignores deleted events even when overrides remain", async () => {
    await connect();
    const day = futureDay();
    googleState.events = [
      timedEvent("busy", "Busy event", day, 10, 11),
      { ...timedEvent("free", "Free event", day, 13, 14), transparency: "transparent" },
    ];
    await calendar.setGoogleEventAvailability("busy", "available");
    await calendar.setGoogleEventAvailability("free", "unavailable");

    const events = await calendar.getGoogleAvailabilityEvents(day.toJSDate(), day.plus({ days: 1 }).toJSDate());
    expect(events.find((event) => event.id === "busy")).toMatchObject({ override: "available", blocksAvailability: false });
    expect(events.find((event) => event.id === "free")).toMatchObject({ override: "unavailable", blocksAvailability: true });

    googleState.events = [];
    expect(await calendar.getGoogleBusyRanges(day.toJSDate(), day.plus({ days: 1 }).toJSDate())).toEqual([]);
    const [{ count }] = await testSql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM google_calendar_event_overrides
    `;
    expect(count).toBe(2);
  });

  it("creates, updates, and deletes the Google event attached to an appointment", async () => {
    await connect();
    const appointment = await seedAppointment("confirmed");

    await calendar.createGoogleEventForAppointment(appointment.id);
    let [saved] = await appointmentSyncState(appointment.id);
    expect(saved).toMatchObject({ google_event_id: "created-google-event", calendar_sync_status: "synced" });
    const createRequest = calendarRequest("POST");
    const createBody = JSON.parse(String(createRequest?.[1]?.body)) as { summary: string; extendedProperties: { private: { handyDandyAppointmentId: string } } };
    expect(createBody.summary).toContain("Smart-home consultation");
    expect(createBody.summary).toContain("Calendar Customer");
    expect(createBody.extendedProperties.private.handyDandyAppointmentId).toBe(appointment.id);

    const movedStart = futureDay().plus({ days: 1 }).set({ hour: 14 });
    await testSql`
      UPDATE booking_slots SET starts_at = ${movedStart.toUTC().toJSDate()}, ends_at = ${movedStart.plus({ hours: 1 }).toUTC().toJSDate()}
      WHERE id = ${appointment.slotId}
    `;
    await calendar.updateGoogleEventForAppointment(appointment.id);
    const updateBody = JSON.parse(String(calendarRequest("PATCH")?.[1]?.body)) as { start: { dateTime: string } };
    expect(updateBody.start.dateTime).toBe(movedStart.toUTC().toISO());

    await calendar.deleteGoogleEvent("created-google-event", appointment.id);
    [saved] = await appointmentSyncState(appointment.id);
    expect(saved).toMatchObject({ google_event_id: null, calendar_sync_status: "synced" });
    expect(calendarRequest("DELETE")).toBeTruthy();
  });

  it("recreates an appointment event when Google reports that the old event is gone", async () => {
    await connect();
    const appointment = await seedAppointment("confirmed", "missing-event");
    googleState.updateStatus = 404;
    googleState.createEventId = "replacement-event";

    await calendar.updateGoogleEventForAppointment(appointment.id);
    const [saved] = await appointmentSyncState(appointment.id);
    expect(saved).toMatchObject({ google_event_id: "replacement-event", calendar_sync_status: "synced" });
    expect(calendarRequest("PATCH")).toBeTruthy();
    expect(calendarRequest("POST")).toBeTruthy();
  });

  it("reconciles cancellations while recording failed updates for retry", async () => {
    await connect();
    const confirmed = await seedAppointment("confirmed", "update-event", 0);
    const cancelled = await seedAppointment("cancelled", "delete-event", 2);
    googleState.updateStatus = 500;

    const result = await calendar.reconcileGoogleCalendar();
    expect(result).toEqual({ checked: 2, synced: 1, failed: 1 });
    const [failed] = await appointmentSyncState(confirmed.id);
    const [removed] = await appointmentSyncState(cancelled.id);
    expect(failed.calendar_sync_status).toBe("failed");
    expect(failed.calendar_sync_error).toContain("Google Calendar returned 500");
    expect(removed).toMatchObject({ google_event_id: null, calendar_sync_status: "synced" });
  });
});

async function connect() {
  await calendar.connectGoogleCalendar("authorization-code");
}

async function seedAppointment(status: "confirmed" | "cancelled", googleEventId: string | null = null, dayOffset = 0) {
  const [customer] = await testSql<{ id: string }[]>`
    INSERT INTO customers (email, name, first_name, last_name)
    VALUES (${`calendar-${dayOffset}@example.com`}, 'Calendar Customer', 'Calendar', 'Customer')
    RETURNING id
  `;
  const startsAt = futureDay().plus({ days: dayOffset }).set({ hour: 9 });
  const [slot] = await testSql<{ id: string }[]>`
    INSERT INTO booking_slots (service_id, starts_at, ends_at, state)
    VALUES (${SERVICE_ID}, ${startsAt.toUTC().toJSDate()}, ${startsAt.plus({ hours: 1 }).toUTC().toJSDate()}, ${status === "cancelled" ? "released" : "confirmed"})
    RETURNING id
  `;
  const [appointment] = await testSql<{ id: string }[]>`
    INSERT INTO appointments (slot_id, customer_id, status, google_event_id, client_notes, notes)
    VALUES (${slot.id}, ${customer.id}, ${status}, ${googleEventId}, 'Client note', 'Admin note')
    RETURNING id
  `;
  return { id: appointment.id, slotId: slot.id };
}

function appointmentSyncState(appointmentId: string) {
  return testSql<{ google_event_id: string | null; calendar_sync_status: string; calendar_sync_error: string | null }[]>`
    SELECT google_event_id, calendar_sync_status, calendar_sync_error
    FROM appointments WHERE id = ${appointmentId}
  `;
}

function futureDay() {
  return DateTime.now().setZone("America/Toronto").plus({ days: 10 }).startOf("day");
}

function timedEvent(id: string, summary: string, day: DateTime, startHour: number, endHour: number): GoogleEvent {
  return {
    id,
    summary,
    start: { dateTime: day.set({ hour: startHour }).toISO()! },
    end: { dateTime: day.set({ hour: endHour }).toISO()! },
  };
}

function calendarRequest(method: string) {
  return fetchMock.mock.calls.find(([input, init]) =>
    String(input).includes("googleapis.com/calendar/v3/calendars") && (init?.method ?? "GET") === method);
}

async function googleFetchImplementation(input: string | URL | Request, init?: RequestInit) {
  const url = String(input);
  const method = init?.method ?? "GET";
  if (url === "https://oauth2.googleapis.com/token") {
    const body = new URLSearchParams(String(init?.body));
    if (body.get("grant_type") === "authorization_code") return jsonResponse({ refresh_token: "integration-refresh-token" });
    return jsonResponse({ access_token: "integration-access-token" });
  }
  if (!url.includes("https://www.googleapis.com/calendar/v3/calendars/")) return jsonResponse({}, 404);
  if (method === "GET") return jsonResponse({ items: googleState.events });
  if (method === "POST") return googleState.createStatus < 400
    ? jsonResponse({ id: googleState.createEventId }, googleState.createStatus)
    : googleError(googleState.createStatus);
  if (method === "PATCH") return googleState.updateStatus < 400
    ? jsonResponse({}, googleState.updateStatus)
    : googleError(googleState.updateStatus);
  if (method === "DELETE") return googleState.deleteStatus === 204
    ? new Response(null, { status: 204 })
    : googleError(googleState.deleteStatus);
  return jsonResponse({}, 405);
}

function googleError(status: number) {
  return jsonResponse({ error: { message: "Simulated Google failure", errors: [{ reason: "backendError" }] } }, status);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

type GoogleEvent = {
  id?: string;
  summary?: string;
  status?: string;
  transparency?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};
