import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { requireAdmin } from "../../../../lib/admin-auth";
import { getDb } from "../../../../lib/db";
import { appointments, customers } from "../../../../lib/db/schema";

const querySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(5).max(100).default(20) });

export async function GET(request: Request) {
  if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url); const query = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) return Response.json({ error: "Invalid pagination options." }, { status: 400 });
  const db = getDb(); const { page, pageSize } = query.data;
  const [[totalRow], clients] = await Promise.all([db.select({ total: sql<number>`count(*)::int` }).from(customers), db.select({
    id: customers.id, name: customers.name, email: customers.email, phone: customers.phone,
    createdAt: customers.createdAt, appointmentCount: sql<number>`count(${appointments.id})::int`,
  }).from(customers).leftJoin(appointments, eq(appointments.customerId, customers.id))
    .groupBy(customers.id).orderBy(desc(customers.createdAt), desc(customers.id)).limit(pageSize).offset((page - 1) * pageSize)]);
  const total = totalRow?.total ?? 0;
  return Response.json({ clients, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
}
