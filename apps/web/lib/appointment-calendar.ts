import { createHmac, timingSafeEqual } from "node:crypto";

export function appointmentCalendarUrl(appointmentId: string) {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/appointments/${encodeURIComponent(appointmentId)}/calendar?token=${encodeURIComponent(sign(appointmentId))}`;
}

export function validAppointmentCalendarToken(appointmentId: string, token: string) {
  const expected = Buffer.from(sign(appointmentId));
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function buildAppointmentCalendarFile(details: {
  id: string;
  serviceName: string;
  startsAt: Date;
  endsAt: Date;
  modeLabel: string;
  location: string;
  joinUrl?: string | null;
}) {
  const description = [`Appointment with Digital Handyman`, `Format: ${details.modeLabel}`, details.joinUrl && `Join Google Meet: ${details.joinUrl}`].filter(Boolean).join("\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "PRODID:-//Digital Handyman//Appointments//EN",
    "BEGIN:VEVENT",
    `UID:${escapeCalendarText(details.id)}@digitalhandydan.ca`,
    `DTSTAMP:${calendarDate(new Date())}`,
    `DTSTART:${calendarDate(details.startsAt)}`,
    `DTEND:${calendarDate(details.endsAt)}`,
    `SUMMARY:${escapeCalendarText(`Digital Handyman: ${details.serviceName}`)}`,
    `DESCRIPTION:${escapeCalendarText(description)}`,
    details.location && `LOCATION:${escapeCalendarText(details.location)}`,
    details.joinUrl && `URL:${details.joinUrl}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].filter((line) => line !== "").join("\r\n");
}

function sign(appointmentId: string) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters.");
  return createHmac("sha256", secret).update(`appointment-calendar:${appointmentId}`).digest("base64url");
}

function calendarDate(value: Date) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeCalendarText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
