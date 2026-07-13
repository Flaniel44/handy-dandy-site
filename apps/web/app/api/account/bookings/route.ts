import { z } from "zod";

import { requireCustomer } from "../../../../lib/admin-auth";
import { getAvailabilityForDate } from "../../../../lib/availability";
import { areNewBookingsEnabled, bookingsClosedResponse } from "../../../../lib/booking-status";
import { getDb } from "../../../../lib/db";
import { appointments, bookingSlots } from "../../../../lib/db/schema";
import { sendBookingConfirmation } from "../../../../lib/email";
import { createGoogleEventForAppointment, markCalendarSyncFailure } from "../../../../lib/google-calendar";
import { checkRateLimit, rateLimitResponse } from "../../../../lib/rate-limit";

const schema = z.object({
  serviceId: z.uuid(), date: z.iso.date(), startsAt: z.iso.datetime({ offset: true }),
  clientNotes: z.string().trim().max(2000).default(""),
});

export async function POST(request: Request) {
  if (!areNewBookingsEnabled()) return bookingsClosedResponse();
  const rateLimit = await checkRateLimit(request, "account-booking", 20, 60 * 60);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
  const session = await requireCustomer();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the appointment details." }, { status: 400 });
  const startsAt = new Date(parsed.data.startsAt);
  try {
    const availability = await getAvailabilityForDate(parsed.data.date, parsed.data.serviceId);
    const selected = availability?.slots.find((slot) => slot.startsAt === startsAt.toISOString());
    if (!availability || !selected) return Response.json({ error: "That time is no longer available." }, { status: 409 });
    const appointment = await getDb().transaction(async (tx) => {
      const [slot] = await tx.insert(bookingSlots).values({
        serviceId: parsed.data.serviceId, startsAt, endsAt: new Date(selected.endsAt), state: "confirmed",
      }).returning({ id: bookingSlots.id });
      const [created] = await tx.insert(appointments).values({
        slotId: slot.id, customerId: session.customerId, status: "confirmed", clientNotes: parsed.data.clientNotes,
      }).returning({ id: appointments.id });
      return created;
    });
    try {
      await sendBookingConfirmation(session.email, session.firstName, availability.service.name, startsAt);
    } catch (emailError) {
      console.error("Account booking created but confirmation email failed", emailError);
    }
    try { await createGoogleEventForAppointment(appointment.id); }
    catch (calendarError) { await markCalendarSyncFailure(appointment.id, calendarError); console.error("Account booking created but Google Calendar sync failed", calendarError); }
    return Response.json({ appointmentId: appointment.id }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23P01") {
      return Response.json({ error: "That time was just booked." }, { status: 409 });
    }
    console.error("Unable to create account booking", error);
    return Response.json({ error: "We could not create the appointment." }, { status: 500 });
  }
}
