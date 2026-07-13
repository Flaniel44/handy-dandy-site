import { z } from "zod";

import { getAvailabilityForDate } from "../../../lib/availability";
import { getDb } from "../../../lib/db";
import { appointments, bookingSlots, customers } from "../../../lib/db/schema";
import { sendBookingConfirmation } from "../../../lib/email";
import { createGoogleEventForAppointment, markCalendarSyncFailure } from "../../../lib/google-calendar";

export const dynamic = "force-dynamic";

const bookingSchema = z.object({
  serviceId: z.uuid(),
  date: z.iso.date(),
  startsAt: z.iso.datetime({ offset: true }),
  name: z.string().trim().min(2).max(120),
  email: z.email().transform((email) => email.trim().toLowerCase()),
  notes: z.string().trim().max(2000).default(""),
});

export async function POST(request: Request) {
  const parsed = bookingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please check your booking details." }, { status: 400 });

  const startsAt = new Date(parsed.data.startsAt);
  try {
    const availability = await getAvailabilityForDate(parsed.data.date, parsed.data.serviceId);
    const selected = availability?.slots.find((slot) => slot.startsAt === startsAt.toISOString());
    if (!availability || !selected) return Response.json({ error: "That time is no longer available." }, { status: 409 });

    const result = await getDb().transaction(async (tx) => {
      const [customer] = await tx.insert(customers).values({
        name: parsed.data.name,
        email: parsed.data.email,
      }).onConflictDoUpdate({
        target: customers.email,
        set: { name: parsed.data.name, updatedAt: new Date() },
      }).returning({ id: customers.id });

      const [slot] = await tx.insert(bookingSlots).values({
        serviceId: parsed.data.serviceId,
        startsAt,
        endsAt: new Date(selected.endsAt),
        state: "confirmed",
      }).returning({ id: bookingSlots.id });

      const [appointment] = await tx.insert(appointments).values({
        slotId: slot.id,
        customerId: customer.id,
        status: "confirmed",
        clientNotes: parsed.data.notes,
      }).returning({ id: appointments.id });

      return { appointmentId: appointment.id };
    });

    try {
      await sendBookingConfirmation(parsed.data.email, parsed.data.name, availability.service.name, startsAt);
    } catch (emailError) {
      console.error("Booking created but confirmation email failed", emailError);
    }
    try { await createGoogleEventForAppointment(result.appointmentId); }
    catch (calendarError) { await markCalendarSyncFailure(result.appointmentId, calendarError); console.error("Booking created but Google Calendar sync failed", calendarError); }
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (isOverlapError(error)) return Response.json({ error: "That time was just reserved by someone else." }, { status: 409 });
    console.error("Unable to create booking", error);
    return Response.json({ error: "We could not reserve that time." }, { status: 500 });
  }
}

function isOverlapError(error: unknown) {
  let current = error;
  while (typeof current === "object" && current !== null) {
    if ("code" in current && current.code === "23P01") return true;
    if (!("cause" in current)) return false;
    current = current.cause;
  }
  return false;
}
