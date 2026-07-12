import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { requireCustomer } from "../../../../lib/admin-auth";
import { getDb } from "../../../../lib/db";
import { appointments, bookingSlots, services } from "../../../../lib/db/schema";

export async function GET() {
  const session = await requireCustomer();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await getDb().select({
    id: appointments.id, status: appointments.status, adminNotes: appointments.notes, clientNotes: appointments.clientNotes,
    startsAt: bookingSlots.startsAt, endsAt: bookingSlots.endsAt, serviceName: services.name,
  }).from(appointments).innerJoin(bookingSlots, eq(bookingSlots.id, appointments.slotId))
    .innerJoin(services, eq(services.id, bookingSlots.serviceId))
    .where(eq(appointments.customerId, session.customerId)).orderBy(desc(bookingSlots.startsAt));
  return Response.json({ appointments: rows });
}

const patchSchema = z.object({ id: z.uuid(), clientNotes: z.string().trim().max(2000) });
export async function PATCH(request: Request) {
  const session = await requireCustomer();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid notes." }, { status: 400 });
  const updated = await getDb().update(appointments).set({ clientNotes: parsed.data.clientNotes, updatedAt: new Date() })
    .where(and(eq(appointments.id, parsed.data.id), eq(appointments.customerId, session.customerId))).returning({ id: appointments.id });
  if (!updated.length) return Response.json({ error: "Appointment not found." }, { status: 404 });
  return Response.json({ ok: true });
}
