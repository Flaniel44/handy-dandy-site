import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "../../../../lib/db";
import { notifyAdminAppointmentBooked } from "../../../../lib/appointment-notifications";
import {
  appointments,
  bookingSlots,
  customers,
  guestAppointmentManagementTokens,
  guestBookingConfirmations,
  services,
} from "../../../../lib/db/schema";
import { sendBookingRequestReceived } from "../../../../lib/email";
import { createGuestManagementToken, guestManagementExpiry } from "../../../../lib/guest-appointment-management";
import { hashGuestBookingConfirmationToken } from "../../../../lib/guest-booking-confirmation";
import { createGoogleEventForAppointment, markCalendarSyncFailure } from "../../../../lib/google-calendar";
import { publicUrl } from "../../../../lib/public-url";
import { checkRateLimit, rateLimitResponse } from "../../../../lib/rate-limit";

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request, "guest-booking-confirmation", 30, 60 * 60);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
  const form = await request.formData().catch(() => null);
  const parsed = tokenSchema.safeParse(form?.get("token"));
  if (!parsed.success) return redirectResult(request, "invalid");

  const now = new Date();
  const tokenHash = hashGuestBookingConfirmationToken(parsed.data);
  const management = createGuestManagementToken();
  try {
    const result = await getDb().transaction(async (tx) => {
      const [confirmation] = await tx.delete(guestBookingConfirmations).where(and(
        eq(guestBookingConfirmations.tokenHash, tokenHash),
        gt(guestBookingConfirmations.expiresAt, now),
      )).returning();

      if (!confirmation) {
        const [expired] = await tx.select({
          slotId: guestBookingConfirmations.slotId,
        }).from(guestBookingConfirmations)
          .where(eq(guestBookingConfirmations.tokenHash, tokenHash))
          .limit(1);
        if (expired) {
          await tx.update(bookingSlots).set({ state: "expired", updatedAt: now })
            .where(eq(bookingSlots.id, expired.slotId));
          await tx.delete(guestBookingConfirmations)
            .where(eq(guestBookingConfirmations.tokenHash, tokenHash));
          return { state: "expired" as const };
        }
        return { state: "invalid" as const };
      }

      const [heldSlot] = await tx.select({
        id: bookingSlots.id,
        serviceName: services.name,
        startsAt: bookingSlots.startsAt,
        endsAt: bookingSlots.endsAt,
      }).from(bookingSlots)
        .innerJoin(services, eq(services.id, bookingSlots.serviceId))
        .where(eq(bookingSlots.id, confirmation.slotId))
        .limit(1);
      if (!heldSlot) return { state: "invalid" as const };

      const [confirmedSlot] = await tx.update(bookingSlots).set({
        state: "confirmed",
        expiresAt: null,
        updatedAt: now,
      }).where(and(
        eq(bookingSlots.id, confirmation.slotId),
        eq(bookingSlots.state, "held"),
        gt(bookingSlots.expiresAt, now),
      )).returning({ id: bookingSlots.id });
      if (!confirmedSlot) {
        await tx.update(bookingSlots).set({ state: "expired", updatedAt: now })
          .where(and(eq(bookingSlots.id, confirmation.slotId), eq(bookingSlots.state, "held")));
        return { state: "expired" as const };
      }

      const [customer] = await tx.insert(customers).values({
        name: confirmation.name,
        email: confirmation.email,
      }).onConflictDoUpdate({
        target: customers.email,
        set: { name: confirmation.name, updatedAt: now },
      }).returning({ id: customers.id });

      const [appointment] = await tx.insert(appointments).values({
        slotId: confirmedSlot.id,
        customerId: customer.id,
        status: "pending_approval",
        source: "guest",
        clientNotes: confirmation.clientNotes,
      }).returning({ id: appointments.id });

      await tx.insert(guestAppointmentManagementTokens).values({
        appointmentId: appointment.id,
        tokenHash: management.tokenHash,
        expiresAt: guestManagementExpiry(heldSlot.endsAt),
      });

      return {
        state: "requested" as const,
        appointmentId: appointment.id,
        email: confirmation.email,
        name: confirmation.name,
        serviceName: heldSlot.serviceName,
        startsAt: heldSlot.startsAt,
        managementToken: management.token,
      };
    });

    if (result.state !== "requested") return redirectResult(request, result.state);
    try {
      await sendBookingRequestReceived(
        result.email,
        result.name,
        result.serviceName,
        result.startsAt,
        publicUrl(request, `/book/manage?token=${encodeURIComponent(result.managementToken)}`).toString(),
      );
    } catch (emailError) {
      console.error("Guest booking request created but request email failed", emailError);
    }
    try {
      await notifyAdminAppointmentBooked(result.appointmentId);
    } catch (emailError) {
      console.error("Guest booking request created but admin notification failed", emailError);
    }
    try {
      await createGoogleEventForAppointment(result.appointmentId);
    } catch (calendarError) {
      await markCalendarSyncFailure(result.appointmentId, calendarError);
      console.error("Guest booking request created but Google Calendar sync failed", calendarError);
    }
    return redirectResult(request, "requested");
  } catch (error) {
    console.error("Unable to confirm guest booking", error);
    return redirectResult(request, "failed");
  }
}

function redirectResult(request: Request, status: "requested" | "expired" | "invalid" | "failed") {
  return Response.redirect(publicUrl(request, `/book/confirmation?status=${status}`), 303);
}
