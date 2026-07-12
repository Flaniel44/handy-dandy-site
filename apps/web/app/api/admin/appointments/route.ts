import { desc, eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { z } from "zod";

import { requireAdmin } from "../../../../lib/admin-auth";
import { getDb } from "../../../../lib/db";
import { appointments, bookingSlots, businessSettings, customers, services } from "../../../../lib/db/schema";

const manualAppointmentSchema = z.object({
  serviceId: z.uuid(), startsAtLocal: z.string().min(1), name: z.string().trim().min(2).max(120),
  email: z.email().transform((value) => value.trim().toLowerCase()),
  phone: z.string().trim().regex(/^\d*$/, "Phone number can only contain numbers.").max(30).optional(),
  notes: z.string().trim().max(2000).default(""),
});

export async function GET() {
  if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await getDb().select({
    id: appointments.id, status: appointments.status, notes: appointments.notes, source: appointments.source,
    startsAt: bookingSlots.startsAt, endsAt: bookingSlots.endsAt, customerName: customers.name,
    customerEmail: customers.email, customerPhone: customers.phone, serviceName: services.name,
  }).from(appointments)
    .innerJoin(bookingSlots, eq(bookingSlots.id, appointments.slotId))
    .innerJoin(customers, eq(customers.id, appointments.customerId))
    .innerJoin(services, eq(services.id, bookingSlots.serviceId))
    .orderBy(desc(bookingSlots.startsAt));
  return Response.json({ appointments: rows });
}

export async function POST(request: Request) {
  if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = manualAppointmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the appointment details." }, { status: 400 });
  const db = getDb();
  const [[settings], [service]] = await Promise.all([
    db.select().from(businessSettings).limit(1), db.select().from(services).where(eq(services.id, parsed.data.serviceId)).limit(1),
  ]);
  if (!settings || !service) return Response.json({ error: "Service or settings are missing." }, { status: 400 });
  const startsAt = DateTime.fromISO(parsed.data.startsAtLocal, { zone: settings.timezone });
  if (!startsAt.isValid) return Response.json({ error: "Invalid appointment time." }, { status: 400 });

  try {
    const result = await db.transaction(async (tx) => {
      const [customer] = await tx.insert(customers).values({
        name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone || null,
      }).onConflictDoUpdate({ target: customers.email, set: {
        name: parsed.data.name, phone: parsed.data.phone || null, updatedAt: new Date(),
      }}).returning({ id: customers.id });
      const [slot] = await tx.insert(bookingSlots).values({
        serviceId: service.id, startsAt: startsAt.toJSDate(),
        endsAt: startsAt.plus({ minutes: service.durationMinutes }).toJSDate(), state: "confirmed",
      }).returning({ id: bookingSlots.id });
      const [appointment] = await tx.insert(appointments).values({
        slotId: slot.id, customerId: customer.id, status: "confirmed", notes: parsed.data.notes, source: "phone",
      }).returning({ id: appointments.id });
      return appointment;
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23P01") {
      return Response.json({ error: "That time overlaps another appointment." }, { status: 409 });
    }
    console.error("Unable to create manual appointment", error);
    return Response.json({ error: "Unable to create appointment." }, { status: 500 });
  }
}
