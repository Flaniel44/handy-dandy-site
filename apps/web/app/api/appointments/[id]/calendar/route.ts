import { and, eq } from "drizzle-orm";

import { appointmentModeLabel, formatAppointmentAddress } from "../../../../../lib/appointment-details";
import { buildAppointmentCalendarFile, validAppointmentCalendarToken } from "../../../../../lib/appointment-calendar";
import { getDb } from "../../../../../lib/db";
import { appointments, bookingSlots, services } from "../../../../../lib/db/schema";
import { getGoogleMeetUrl } from "../../../../../lib/google-calendar";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!validAppointmentCalendarToken(id, token)) return new Response("Calendar link not found.", { status: 404 });

  const [appointment] = await getDb().select({
    id: appointments.id,
    googleEventId: appointments.googleEventId,
    serviceName: services.name,
    startsAt: bookingSlots.startsAt,
    endsAt: bookingSlots.endsAt,
    appointmentMode: appointments.appointmentMode,
    appointmentStreetAddress: appointments.appointmentStreetAddress,
    appointmentUnit: appointments.appointmentUnit,
    appointmentCity: appointments.appointmentCity,
    appointmentPostalCode: appointments.appointmentPostalCode,
    appointmentCountry: appointments.appointmentCountry,
  }).from(appointments)
    .innerJoin(bookingSlots, eq(bookingSlots.id, appointments.slotId))
    .innerJoin(services, eq(services.id, bookingSlots.serviceId))
    .where(and(eq(appointments.id, id), eq(appointments.status, "confirmed")))
    .limit(1);
  if (!appointment) return new Response("This appointment is no longer confirmed.", { status: 404 });

  const location = appointment.appointmentMode === "in_person" ? formatAppointmentAddress(appointment) : appointment.appointmentMode === "google_meet" ? "Google Meet" : "Phone appointment";
  let joinUrl: string | null = null;
  if (appointment.appointmentMode === "google_meet") {
    try { joinUrl = await getGoogleMeetUrl(appointment.googleEventId); }
    catch (error) { console.error("Unable to add the Google Meet URL to the calendar download", error); }
  }
  const calendar = buildAppointmentCalendarFile({
    ...appointment,
    modeLabel: appointmentModeLabel(appointment.appointmentMode),
    location,
    joinUrl,
  });
  return new Response(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="digital-handydan-appointment.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
