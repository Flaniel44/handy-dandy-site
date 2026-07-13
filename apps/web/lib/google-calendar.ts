import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";

import { getDb } from "./db";
import { appointments, bookingSlots, businessSettings, customers, googleCalendarConnections, services } from "./db/schema";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export function googleCalendarConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_TOKEN_ENCRYPTION_KEY);
}

export function getGoogleAuthorizationUrl(state: string) {
  const params = new URLSearchParams({
    client_id: required("GOOGLE_CLIENT_ID"),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function connectGoogleCalendar(code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: required("GOOGLE_CLIENT_ID"),
      client_secret: required("GOOGLE_CLIENT_SECRET"),
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const body = await response.json() as { refresh_token?: string; error_description?: string };
  if (!response.ok || !body.refresh_token) throw new Error(body.error_description ?? "Google did not return a refresh token.");

  const db = getDb();
  const [business] = await db.select({ id: businessSettings.id }).from(businessSettings).limit(1);
  if (!business) throw new Error("Business settings are missing.");
  await db.delete(googleCalendarConnections).where(eq(googleCalendarConnections.businessId, business.id));
  await db.insert(googleCalendarConnections).values({
    businessId: business.id,
    calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
    encryptedRefreshToken: encrypt(body.refresh_token),
  });
}

export async function getGoogleCalendarStatus() {
  const [connection] = await getDb().select({ calendarId: googleCalendarConnections.calendarId, updatedAt: googleCalendarConnections.updatedAt })
    .from(googleCalendarConnections).limit(1);
  return { configured: googleCalendarConfigured(), connected: Boolean(connection), connection: connection ?? null };
}

export async function disconnectGoogleCalendar() {
  await getDb().delete(googleCalendarConnections);
}

export async function getGoogleBusyRanges(startsAt: Date, endsAt: Date) {
  const connection = await getConnection();
  if (!connection) return [];
  const accessToken = await getAccessToken(connection.encryptedRefreshToken);
  const params = new URLSearchParams({
    timeMin: startsAt.toISOString(), timeMax: endsAt.toISOString(), singleEvents: "true", showDeleted: "false", maxResults: "2500",
  });
  const response = await googleFetch(`/calendars/${encodeURIComponent(connection.calendarId)}/events?${params}`, accessToken);
  const body = await response.json() as { items?: Array<{ status?: string; start?: { date?: string; dateTime?: string }; end?: { date?: string; dateTime?: string } }> };
  return (body.items ?? []).flatMap((event) => {
    if (event.status === "cancelled" || !event.start?.dateTime || !event.end?.dateTime) return [];
    return [{ startsAt: new Date(event.start.dateTime), endsAt: new Date(event.end.dateTime) }];
  });
}

export async function createGoogleEventForAppointment(appointmentId: string) {
  const connection = await getConnection();
  if (!connection) return;
  const [row] = await getDb().select({
    serviceName: services.name, startsAt: bookingSlots.startsAt, endsAt: bookingSlots.endsAt,
    customerName: customers.name, customerEmail: customers.email, clientNotes: appointments.clientNotes, adminNotes: appointments.notes,
  }).from(appointments)
    .innerJoin(bookingSlots, eq(bookingSlots.id, appointments.slotId))
    .innerJoin(services, eq(services.id, bookingSlots.serviceId))
    .innerJoin(customers, eq(customers.id, appointments.customerId))
    .where(eq(appointments.id, appointmentId)).limit(1);
  if (!row) return;
  const accessToken = await getAccessToken(connection.encryptedRefreshToken);
  const response = await googleFetch(`/calendars/${encodeURIComponent(connection.calendarId)}/events`, accessToken, {
    method: "POST",
    body: JSON.stringify({
      summary: `Handy Dandy: ${row.serviceName} — ${row.customerName}`,
      description: [`Client: ${row.customerName} <${row.customerEmail}>`, row.clientNotes && `Client notes: ${row.clientNotes}`, row.adminNotes && `Admin notes: ${row.adminNotes}`].filter(Boolean).join("\n\n"),
      start: { dateTime: row.startsAt.toISOString() }, end: { dateTime: row.endsAt.toISOString() },
      extendedProperties: { private: { handyDandyAppointmentId: appointmentId } },
    }),
  });
  const event = await response.json() as { id?: string };
  if (!event.id) throw new Error("Google did not return an event ID.");
  await getDb().update(appointments).set({ googleEventId: event.id, updatedAt: new Date() }).where(eq(appointments.id, appointmentId));
}

export async function updateGoogleEventForAppointment(appointmentId: string) {
  const connection = await getConnection();
  if (!connection) return;
  const [row] = await getDb().select({ eventId: appointments.googleEventId, startsAt: bookingSlots.startsAt, endsAt: bookingSlots.endsAt })
    .from(appointments).innerJoin(bookingSlots, eq(bookingSlots.id, appointments.slotId)).where(eq(appointments.id, appointmentId)).limit(1);
  if (!row) return;
  if (!row.eventId) return createGoogleEventForAppointment(appointmentId);
  const accessToken = await getAccessToken(connection.encryptedRefreshToken);
  await googleFetch(`/calendars/${encodeURIComponent(connection.calendarId)}/events/${encodeURIComponent(row.eventId)}`, accessToken, {
    method: "PATCH", body: JSON.stringify({ start: { dateTime: row.startsAt.toISOString() }, end: { dateTime: row.endsAt.toISOString() } }),
  });
}

export async function deleteGoogleEvent(eventId: string | null) {
  if (!eventId) return;
  const connection = await getConnection();
  if (!connection) return;
  const accessToken = await getAccessToken(connection.encryptedRefreshToken);
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
  });
  if (!response.ok && response.status !== 404 && response.status !== 410) throw new Error(`Google Calendar returned ${response.status}.`);
}

async function getConnection() {
  const [connection] = await getDb().select().from(googleCalendarConnections).limit(1);
  return connection ?? null;
}

async function getAccessToken(encryptedRefreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, cache: "no-store",
    body: new URLSearchParams({ client_id: required("GOOGLE_CLIENT_ID"), client_secret: required("GOOGLE_CLIENT_SECRET"), refresh_token: decrypt(encryptedRefreshToken), grant_type: "refresh_token" }),
  });
  const body = await response.json() as { access_token?: string; error_description?: string };
  if (!response.ok || !body.access_token) throw new Error(body.error_description ?? "Unable to refresh Google access.");
  return body.access_token;
}

async function googleFetch(path: string, accessToken: string, init: RequestInit = {}) {
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init, cache: "no-store", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) throw new Error(await googleErrorMessage(response));
  return response;
}

async function googleErrorMessage(response: Response) {
  const fallback = `Google Calendar returned ${response.status}.`;
  try {
    const body = await response.json() as { error?: { message?: string; errors?: Array<{ reason?: string }> } };
    const reason = body.error?.errors?.[0]?.reason;
    return [fallback, reason, body.error?.message].filter(Boolean).join(" ");
  } catch { return fallback; }
}

function encryptionKey() {
  const key = Buffer.from(required("GOOGLE_TOKEN_ENCRYPTION_KEY"), "base64");
  if (key.length !== 32) throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return key;
}

function encrypt(value: string) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

function decrypt(value: string) {
  const [ivText, tagText, encryptedText] = value.split(".");
  if (!ivText || !tagText || !encryptedText) throw new Error("Stored Google token is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
}

function getRedirectUri() {
  return process.env.GOOGLE_OAUTH_REDIRECT_URI || `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/api/admin/google-calendar/callback`;
}

function required(name: string) {
  const value = process.env[name]; if (!value) throw new Error(`${name} is required.`); return value;
}
