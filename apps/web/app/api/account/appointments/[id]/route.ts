import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireCustomer } from "../../../../../lib/admin-auth";
import { getAvailabilityForDate } from "../../../../../lib/availability";
import { getDb } from "../../../../../lib/db";
import { appointments, bookingSlots, services } from "../../../../../lib/db/schema";
import { sendAppointmentCancelled, sendAppointmentRescheduled } from "../../../../../lib/email";

const rescheduleSchema = z.object({ date: z.iso.date(), startsAt: z.iso.datetime({ offset: true }) });

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireCustomer();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = (await params).id;
  const current = await findEditableAppointment(id, session.customerId);
  if (!current) return Response.json({ error: "That appointment can no longer be cancelled." }, { status: 409 });

  await getDb().transaction(async (tx) => {
    await tx.update(appointments).set({ status: "cancelled", updatedAt: new Date() }).where(and(eq(appointments.id, id), eq(appointments.customerId, session.customerId)));
    await tx.update(bookingSlots).set({ state: "released", updatedAt: new Date() }).where(eq(bookingSlots.id, current.slotId));
  });
  try { await sendAppointmentCancelled(session.email, session.firstName, current.serviceName, current.startsAt); }
  catch (error) { console.error("Appointment cancelled but email failed", error); }
  return Response.json({ ok: true });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireCustomer();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = rescheduleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Choose a valid appointment time." }, { status: 400 });
  const id = (await params).id;
  const current = await findEditableAppointment(id, session.customerId);
  if (!current) return Response.json({ error: "That appointment can no longer be rescheduled." }, { status: 409 });
  const startsAt = new Date(parsed.data.startsAt);
  const availability = await getAvailabilityForDate(parsed.data.date, current.serviceId);
  const selected = availability?.slots.find((slot) => slot.startsAt === startsAt.toISOString());
  if (!availability || !selected) return Response.json({ error: "That time is no longer available." }, { status: 409 });

  try {
    await getDb().transaction(async (tx) => {
      await tx.update(bookingSlots).set({ state: "released", updatedAt: new Date() }).where(eq(bookingSlots.id, current.slotId));
      const [slot] = await tx.insert(bookingSlots).values({
        serviceId: current.serviceId, startsAt, endsAt: new Date(selected.endsAt), state: "confirmed",
      }).returning({ id: bookingSlots.id });
      await tx.update(appointments).set({ slotId: slot.id, updatedAt: new Date() }).where(and(eq(appointments.id, id), eq(appointments.customerId, session.customerId)));
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23P01") return Response.json({ error: "That time was just booked." }, { status: 409 });
    console.error("Unable to reschedule appointment", error);
    return Response.json({ error: "We could not reschedule the appointment." }, { status: 500 });
  }
  try { await sendAppointmentRescheduled(session.email, session.firstName, current.serviceName, current.startsAt, startsAt); }
  catch (error) { console.error("Appointment rescheduled but email failed", error); }
  return Response.json({ ok: true });
}

async function findEditableAppointment(id: string, customerId: string) {
  const [row] = await getDb().select({
    slotId: bookingSlots.id, startsAt: bookingSlots.startsAt, serviceId: bookingSlots.serviceId, serviceName: services.name,
  }).from(appointments)
    .innerJoin(bookingSlots, eq(bookingSlots.id, appointments.slotId))
    .innerJoin(services, eq(services.id, bookingSlots.serviceId))
    .where(and(eq(appointments.id, id), eq(appointments.customerId, customerId), eq(appointments.status, "confirmed"), eq(bookingSlots.state, "confirmed")))
    .limit(1);
  return row && row.startsAt.getTime() > Date.now() ? row : null;
}
