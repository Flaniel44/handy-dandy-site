import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { requireAdmin } from "../../../../../lib/admin-auth";
import { getDb } from "../../../../../lib/db";
import { services } from "../../../../../lib/db/schema";

const orderSchema = z.object({ orderedIds: z.array(z.uuid()).min(1).max(500) });

export async function PUT(request: Request) {
  if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = orderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || new Set(parsed.data.orderedIds).size !== parsed.data.orderedIds.length) {
    return Response.json({ error: "Invalid service order." }, { status: 400 });
  }
  const db = getDb();
  const existing = await db.select({ id: services.id }).from(services).orderBy(asc(services.id));
  const existingIds = new Set(existing.map((service) => service.id));
  if (existingIds.size !== parsed.data.orderedIds.length || parsed.data.orderedIds.some((id) => !existingIds.has(id))) {
    return Response.json({ error: "The service order must include every service exactly once." }, { status: 400 });
  }
  await db.transaction(async (tx) => {
    for (const [sortOrder, id] of parsed.data.orderedIds.entries()) {
      await tx.update(services).set({ sortOrder }).where(eq(services.id, id));
    }
  });
  return Response.json({ ok: true });
}
