import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "./db";
import { appointments, bookingSlots, customers, services } from "./db/schema";
import { sendAdminAppointmentBooked, sendAdminAppointmentCancelled } from "./email";

export async function notifyAdminAppointmentBooked(appointmentId: string) {
  await sendAdminAppointmentBooked(await getNotificationDetails(appointmentId));
}

export async function notifyAdminAppointmentCancelled(appointmentId: string) {
  await sendAdminAppointmentCancelled(await getNotificationDetails(appointmentId));
}

async function getNotificationDetails(appointmentId: string) {
  const [details] = await getDb().select({
    appointmentId: appointments.id,
    source: appointments.source,
    clientNotes: appointments.clientNotes,
    customerName: customers.name,
    customerEmail: customers.email,
    customerPhone: customers.phone,
    streetAddress: customers.streetAddress,
    unit: customers.unit,
    city: customers.city,
    postalCode: customers.postalCode,
    country: customers.country,
    serviceName: services.name,
    startsAt: bookingSlots.startsAt,
    endsAt: bookingSlots.endsAt,
  }).from(appointments)
    .innerJoin(customers, eq(customers.id, appointments.customerId))
    .innerJoin(bookingSlots, eq(bookingSlots.id, appointments.slotId))
    .innerJoin(services, eq(services.id, bookingSlots.serviceId))
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  if (!details) throw new Error("Appointment notification details are unavailable.");
  return details;
}
