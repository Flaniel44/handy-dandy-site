import { desc, eq, sql } from "drizzle-orm";

import { requireAdmin } from "../../../../lib/admin-auth";
import { getDb } from "../../../../lib/db";
import { appointments, customers } from "../../../../lib/db/schema";

export async function GET() {
  if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const clients = await getDb().select({
    id: customers.id, name: customers.name, email: customers.email, phone: customers.phone,
    createdAt: customers.createdAt, appointmentCount: sql<number>`count(${appointments.id})::int`,
  }).from(customers).leftJoin(appointments, eq(appointments.customerId, customers.id))
    .groupBy(customers.id).orderBy(desc(customers.createdAt));
  return Response.json({ clients });
}
