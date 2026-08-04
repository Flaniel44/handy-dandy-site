import { eq } from "drizzle-orm";
import { z } from "zod";
import { shouldSendCancellation, slotStateForAppointmentStatus } from "@handy-dani/domain";

import { requireAdmin } from "../../../../../lib/admin-auth";
import { recordAdminAction } from "../../../../../lib/audit";
import { getDb } from "../../../../../lib/db";
import { appointments, bookingSlots, customers, services } from "../../../../../lib/db/schema";
import { sendAppointmentCancelled, sendBookingConfirmation } from "../../../../../lib/email";
import { deleteGoogleEvent, markCalendarSyncFailure, updateGoogleEventForAppointment } from "../../../../../lib/google-calendar";

const updateSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
  status: z.enum(["confirmed", "cancelled", "completed", "no_show"]).optional(),
  cancellationDiscountPercent: z.number().int().min(1).max(100).optional(),
}).refine(
  (value) => value.cancellationDiscountPercent === undefined || value.status === "cancelled",
  { message: "A discount can only be added when cancelling an appointment.", path: ["cancellationDiscountPercent"] },
);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });
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
    notes: appointments.notes,
    cancellationDiscountPercent: appointments.cancellationDiscountPercent,
    source: appointments.source,
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
      state: slotStateForAppointmentStatus(body.data.status), updatedAt: new Date(),
    }).where(eq(bookingSlots.id, existing.slotId));
  });
  if (body.data.status && shouldSendCancellation(existing.status, body.data.status)) {
    try {
      await sendAppointmentCancelled(
        existing.customerEmail,
        existing.customerName,
        existing.serviceName,
        existing.startsAt,
        `${appUrl()}/book`,
        body.data.notes ?? existing.notes,
        body.data.cancellationDiscountPercent,
      );
    } catch (emailError) {
      console.error("Appointment cancelled by admin but confirmation email failed", emailError);
    }
    try { await deleteGoogleEvent(existing.googleEventId, id.data); }
    catch (calendarError) { await markCalendarSyncFailure(id.data, calendarError); console.error("Appointment cancelled by admin but Google Calendar sync failed", calendarError); }
  }
  if (existing.status === "pending_approval" && body.data.status === "confirmed") {
    try {
      await sendBookingConfirmation(
        existing.customerEmail,
        existing.customerName,
        existing.serviceName,
        existing.startsAt,
        existing.source === "account" ? `${appUrl()}/account` : undefined,
      );
    } catch (emailError) {
      console.error("Appointment approved but confirmation email failed", emailError);
    }
    try { await updateGoogleEventForAppointment(id.data); }
    catch (calendarError) { await markCalendarSyncFailure(id.data, calendarError); console.error("Appointment approved but Google Calendar sync failed", calendarError); }
  }
  await recordAdminAction({ actorId: admin.email, action: "appointment.updated", entityType: "appointment", entityId: id.data, details: { previousStatus: existing.status, ...body.data } });
  return Response.json({ ok: true });
}

function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
