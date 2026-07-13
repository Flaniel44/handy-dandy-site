import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireAdmin } from "../../../../../lib/admin-auth";
import { getDb } from "../../../../../lib/db";
import { appointments, bookingSlots, customers, services } from "../../../../../lib/db/schema";
import { sendAppointmentCancelled } from "../../../../../lib/email";
import { deleteGoogleEvent, markCalendarSyncFailure } from "../../../../../lib/google-calendar";

const updateSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
  status: z.enum(["confirmed", "cancelled", "completed", "no_show"]).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = z.uuid().safeParse((await context.params).id);
  const body = updateSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return Response.json({ error: "Invalid update." }, { status: 400 });
  const db = getDb();
  const [existing] = await db.select({
    slotId: appointments.slotId,
    status: appointments.status,
    startsAt: bookingSlots.startsAt,
    customerEmail: customers.email,
    customerName: customers.name,
    serviceName: services.name,
    googleEventId: appointments.googleEventId,
  }).from(appointments)
    .innerJoin(bookingSlots, eq(bookingSlots.id, appointments.slotId))
    .innerJoin(customers, eq(customers.id, appointments.customerId))
    .innerJoin(services, eq(services.id, bookingSlots.serviceId))
    .where(eq(appointments.id, id.data)).limit(1);
  if (!existing) return Response.json({ error: "Appointment not found." }, { status: 404 });
  await db.transaction(async (tx) => {
    await tx.update(appointments).set({ ...body.data, updatedAt: new Date() }).where(eq(appointments.id, id.data));
    if (body.data.status) await tx.update(bookingSlots).set({
      state: body.data.status === "confirmed" ? "confirmed" : "released", updatedAt: new Date(),
    }).where(eq(bookingSlots.id, existing.slotId));
  });
  if (body.data.status === "cancelled" && existing.status !== "cancelled") {
    try {
      await sendAppointmentCancelled(existing.customerEmail, existing.customerName, existing.serviceName, existing.startsAt);
    } catch (emailError) {
      console.error("Appointment cancelled by admin but confirmation email failed", emailError);
    }
    try { await deleteGoogleEvent(existing.googleEventId, id.data); }
    catch (calendarError) { await markCalendarSyncFailure(id.data, calendarError); console.error("Appointment cancelled by admin but Google Calendar sync failed", calendarError); }
  }
  return Response.json({ ok: true });
}
