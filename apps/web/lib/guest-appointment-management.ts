import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";

import { getDb } from "./db";
import { appointments, bookingSlots, businessSettings, customers, guestAppointmentManagementTokens, services } from "./db/schema";

export const GUEST_MANAGEMENT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const TOKEN_GRACE_PERIOD_HOURS = 24;

export function createGuestManagementToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashGuestManagementToken(token) };
}

export function hashGuestManagementToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function guestManagementExpiry(endsAt: Date) {
  return new Date(endsAt.getTime() + TOKEN_GRACE_PERIOD_HOURS * 60 * 60 * 1000);
}

export async function getGuestManagedAppointment(token: string) {
  if (!GUEST_MANAGEMENT_TOKEN_PATTERN.test(token)) return null;
  const [row] = await getDb().select({
    tokenId: guestAppointmentManagementTokens.id,
    appointmentId: appointments.id,
    status: appointments.status,
    clientNotes: appointments.clientNotes,
    googleEventId: appointments.googleEventId,
    slotId: bookingSlots.id,
    slotState: bookingSlots.state,
    serviceId: services.id,
    serviceName: services.name,
    startsAt: bookingSlots.startsAt,
    endsAt: bookingSlots.endsAt,
    customerName: customers.name,
    customerEmail: customers.email,
    appointmentMode: appointments.appointmentMode,
    appointmentPhone: appointments.appointmentPhone,
    appointmentStreetAddress: appointments.appointmentStreetAddress,
    appointmentUnit: appointments.appointmentUnit,
    appointmentCity: appointments.appointmentCity,
    appointmentPostalCode: appointments.appointmentPostalCode,
    appointmentCountry: appointments.appointmentCountry,
    cancellationNoticeMinutes: businessSettings.cancellationNoticeMinutes,
  }).from(guestAppointmentManagementTokens)
    .innerJoin(appointments, eq(appointments.id, guestAppointmentManagementTokens.appointmentId))
    .innerJoin(bookingSlots, eq(bookingSlots.id, appointments.slotId))
    .innerJoin(services, eq(services.id, bookingSlots.serviceId))
    .innerJoin(customers, eq(customers.id, appointments.customerId))
    .innerJoin(businessSettings, eq(businessSettings.id, services.businessId))
    .where(and(
      eq(guestAppointmentManagementTokens.tokenHash, hashGuestManagementToken(token)),
      gt(guestAppointmentManagementTokens.expiresAt, new Date()),
    )).limit(1);
  return row ?? null;
}
