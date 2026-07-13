import "server-only";

import { and, eq, gt, isNull, lte, or } from "drizzle-orm";

import { getDb } from "./db";
import { appointments, bookingSlots, customers, services } from "./db/schema";
import { sendAdminAppointmentReminder, sendCustomerAppointmentReminder } from "./email";

const REMINDER_WINDOW_HOURS = 24;

export async function sendDueAppointmentReminders(now = new Date()) {
  const windowEndsAt = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000);
  const adminEmail = process.env.APPOINTMENT_REMINDER_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL ?? process.env.EMAIL_FAILURE_ALERT_TO;

  return getDb().transaction(async (tx) => {
    const due = await tx.select({
      id: appointments.id,
      customerReminderSentAt: appointments.customerReminderSentAt,
      adminReminderSentAt: appointments.adminReminderSentAt,
      startsAt: bookingSlots.startsAt,
      customerName: customers.name,
      customerEmail: customers.email,
      serviceName: services.name,
      clientNotes: appointments.clientNotes,
      adminNotes: appointments.notes,
    }).from(appointments)
      .innerJoin(bookingSlots, eq(bookingSlots.id, appointments.slotId))
      .innerJoin(customers, eq(customers.id, appointments.customerId))
      .innerJoin(services, eq(services.id, bookingSlots.serviceId))
      .where(and(
        eq(appointments.status, "confirmed"),
        gt(bookingSlots.startsAt, now),
        lte(bookingSlots.startsAt, windowEndsAt),
        or(isNull(appointments.customerReminderSentAt), isNull(appointments.adminReminderSentAt)),
      ))
      .for("update", { skipLocked: true });

    let customerSent = 0;
    let adminSent = 0;
    let failed = 0;
    for (const appointment of due) {
      if (!appointment.customerReminderSentAt) {
        try {
          await sendCustomerAppointmentReminder(
            appointment.customerEmail,
            appointment.customerName,
            appointment.serviceName,
            appointment.startsAt,
          );
          await tx.update(appointments).set({ customerReminderSentAt: new Date() }).where(eq(appointments.id, appointment.id));
          customerSent += 1;
        } catch (error) {
          failed += 1;
          console.error("Unable to send customer appointment reminder", { appointmentId: appointment.id, error });
        }
      }

      if (!appointment.adminReminderSentAt) {
        if (!adminEmail) {
          failed += 1;
          console.error("Unable to send admin appointment reminder: no admin reminder email is configured", { appointmentId: appointment.id });
        } else {
          try {
            await sendAdminAppointmentReminder(
              adminEmail,
              appointment.customerName,
              appointment.customerEmail,
              appointment.serviceName,
              appointment.startsAt,
              [appointment.clientNotes, appointment.adminNotes].filter(Boolean).join("\n\n"),
            );
            await tx.update(appointments).set({ adminReminderSentAt: new Date() }).where(eq(appointments.id, appointment.id));
            adminSent += 1;
          } catch (error) {
            failed += 1;
            console.error("Unable to send admin appointment reminder", { appointmentId: appointment.id, error });
          }
        }
      }
    }
    return { checked: due.length, customerSent, adminSent, failed };
  });
}
