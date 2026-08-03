import { canCustomerManageAppointment } from "@handy-dani/domain";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { notifyAdminAppointmentCancelled } from "../../../../lib/appointment-notifications";
import { getAvailabilityForDate } from "../../../../lib/availability";
import { getDb } from "../../../../lib/db";
import { hasDatabaseErrorCode } from "../../../../lib/db/errors";
import { appointments, bookingSlots, guestAppointmentManagementTokens } from "../../../../lib/db/schema";
import { sendAppointmentCancelled, sendAppointmentRescheduled } from "../../../../lib/email";
import { createGuestManagementToken, getGuestManagedAppointment, guestManagementExpiry, GUEST_MANAGEMENT_TOKEN_PATTERN } from "../../../../lib/guest-appointment-management";
import { deleteGoogleEvent, markCalendarSyncFailure, updateGoogleEventForAppointment } from "../../../../lib/google-calendar";
import { publicUrl } from "../../../../lib/public-url";
import { checkRateLimit, rateLimitResponse } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";

const rescheduleSchema = z.object({ date: z.iso.date(), startsAt: z.iso.datetime({ offset: true }) });

export async function GET(request: Request) {
  const rateLimit = await checkRateLimit(request, "guest-appointment-management-read", 60, 60 * 60);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
  const current = await managedAppointment(request);
  if (!current) return invalidLinkResponse();
  return Response.json({
    appointment: {
      id: current.appointmentId,
      status: current.status,
      serviceId: current.serviceId,
      serviceName: current.serviceName,
      startsAt: current.startsAt.toISOString(),
      endsAt: current.endsAt.toISOString(),
      clientNotes: current.clientNotes,
      customerName: current.customerName,
      customerEmail: current.customerEmail,
      canManage: canManage(current),
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const rateLimit = await checkRateLimit(request, "guest-appointment-management-change", 20, 60 * 60);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
  const parsed = rescheduleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Choose a valid appointment time." }, { status: 400 });
  const current = await managedAppointment(request);
  if (!current) return invalidLinkResponse();
  if (!canManage(current)) return Response.json({ error: "That appointment can no longer be rescheduled." }, { status: 409 });
  const startsAt = new Date(parsed.data.startsAt);
  const availability = await getAvailabilityForDate(parsed.data.date, current.serviceId);
  const selected = availability?.slots.find((slot) => slot.startsAt === startsAt.toISOString());
  if (!availability || !selected) return Response.json({ error: "That time is no longer available." }, { status: 409 });

  const nextToken = createGuestManagementToken();
  const nextEndsAt = new Date(selected.endsAt);
  try {
    await getDb().transaction(async (tx) => {
      await tx.update(bookingSlots).set({ state: "released", updatedAt: new Date() }).where(eq(bookingSlots.id, current.slotId));
      const [slot] = await tx.insert(bookingSlots).values({
        serviceId: current.serviceId,
        startsAt,
        endsAt: nextEndsAt,
        state: "confirmed",
      }).returning({ id: bookingSlots.id });
      const [updated] = await tx.update(appointments).set({ slotId: slot.id, updatedAt: new Date() })
        .where(and(eq(appointments.id, current.appointmentId), eq(appointments.slotId, current.slotId)))
        .returning({ id: appointments.id });
      if (!updated) throw new Error("Appointment changed while it was being rescheduled.");
      await tx.update(guestAppointmentManagementTokens).set({
        tokenHash: nextToken.tokenHash,
        expiresAt: guestManagementExpiry(nextEndsAt),
        updatedAt: new Date(),
      }).where(eq(guestAppointmentManagementTokens.id, current.tokenId));
    });
  } catch (error) {
    if (hasDatabaseErrorCode(error, "23P01") || hasDatabaseErrorCode(error, "40P01")) {
      return Response.json({ error: "That time was just booked." }, { status: 409 });
    }
    console.error("Unable to reschedule guest appointment", error);
    return Response.json({ error: "We could not reschedule the appointment." }, { status: 500 });
  }

  const manageUrl = publicUrl(request, `/book/manage?token=${encodeURIComponent(nextToken.token)}`).toString();
  try { await sendAppointmentRescheduled(current.customerEmail, current.customerName, current.serviceName, current.startsAt, startsAt, manageUrl); }
  catch (error) { console.error("Guest appointment rescheduled but email failed", error); }
  try { await updateGoogleEventForAppointment(current.appointmentId); }
  catch (error) { await markCalendarSyncFailure(current.appointmentId, error); console.error("Guest appointment rescheduled but Google Calendar sync failed", error); }
  return Response.json({ ok: true, token: nextToken.token });
}

export async function DELETE(request: Request) {
  const rateLimit = await checkRateLimit(request, "guest-appointment-management-change", 20, 60 * 60);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
  const current = await managedAppointment(request);
  if (!current) return invalidLinkResponse();
  if (!canManage(current)) return Response.json({ error: "That appointment can no longer be cancelled." }, { status: 409 });

  await getDb().transaction(async (tx) => {
    await tx.update(appointments).set({ status: "cancelled", updatedAt: new Date() }).where(eq(appointments.id, current.appointmentId));
    await tx.update(bookingSlots).set({ state: "released", updatedAt: new Date() }).where(eq(bookingSlots.id, current.slotId));
  });
  try { await sendAppointmentCancelled(current.customerEmail, current.customerName, current.serviceName, current.startsAt, publicUrl(request, "/book").toString()); }
  catch (error) { console.error("Guest appointment cancelled but email failed", error); }
  try { await notifyAdminAppointmentCancelled(current.appointmentId); }
  catch (error) { console.error("Guest appointment cancelled but admin notification failed", error); }
  try { await deleteGoogleEvent(current.googleEventId, current.appointmentId); }
  catch (error) { await markCalendarSyncFailure(current.appointmentId, error); console.error("Guest appointment cancelled but Google Calendar sync failed", error); }
  return Response.json({ ok: true });
}

async function managedAppointment(request: Request) {
  const token = request.headers.get("X-Appointment-Token") ?? "";
  if (!GUEST_MANAGEMENT_TOKEN_PATTERN.test(token)) return null;
  return getGuestManagedAppointment(token);
}

function canManage(current: NonNullable<Awaited<ReturnType<typeof getGuestManagedAppointment>>>) {
  if (!canCustomerManageAppointment(current)) return false;
  return current.startsAt.getTime() >= Date.now() + current.cancellationNoticeMinutes * 60_000;
}

function invalidLinkResponse() {
  return Response.json({ error: "This private appointment link is invalid or has expired." }, { status: 404 });
}
