import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { requireAdmin } from "../../../../../../lib/admin-auth";
import { getDb } from "../../../../../../lib/db";
import { appointments, bookingSlots, customers, services } from "../../../../../../lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return Response.json({ error: "Invalid client." }, { status: 400 });
  const rows = await getDb().select({
    id: appointments.id, status: appointments.status, notes: appointments.notes, source: appointments.source,
    startsAt: bookingSlots.startsAt, endsAt: bookingSlots.endsAt, customerName: customers.name,
    customerEmail: customers.email, customerPhone: customers.phone, serviceName: services.name,
  }).from(appointments)
    .innerJoin(bookingSlots, eq(bookingSlots.id, appointments.slotId))
    .innerJoin(customers, eq(customers.id, appointments.customerId))
    .innerJoin(services, eq(services.id, bookingSlots.serviceId))
    .where(eq(appointments.customerId, id.data)).orderBy(desc(bookingSlots.startsAt));
  return Response.json({ appointments: rows }, { headers: { "Cache-Control": "private, no-store" } });
}
