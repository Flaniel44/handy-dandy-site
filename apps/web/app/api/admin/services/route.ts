import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { requireAdmin } from "../../../../lib/admin-auth";
import { recordAdminAction } from "../../../../lib/audit";
import { getDb } from "../../../../lib/db";
import { businessSettings, services } from "../../../../lib/db/schema";

const serviceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000),
  durationMinutes: z.number().int().min(15).max(480),
  priceCents: z.number().int().min(0).max(10_000_000),
  active: z.boolean().default(true),
});

export async function GET() {
  if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await getDb().select({
    id: services.id,
    name: services.name,
    description: services.description,
    durationMinutes: services.durationMinutes,
    priceCents: services.priceCents,
    active: services.active,
    sortOrder: services.sortOrder,
  }).from(services).orderBy(asc(services.sortOrder), asc(services.name), asc(services.id));
  return Response.json({ services: rows }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = serviceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the service details." }, { status: 400 });
  const db = getDb();
  const [business] = await db.select({ id: businessSettings.id }).from(businessSettings).limit(1);
  if (!business) return Response.json({ error: "Business settings are missing." }, { status: 500 });
  const [position] = await db.select({ next: sql<number>`coalesce(max(${services.sortOrder}), -1)::int + 1` }).from(services).where(eq(services.businessId, business.id));
  const [service] = await db.insert(services).values({ businessId: business.id, sortOrder: position?.next ?? 0, ...parsed.data }).returning();
  await recordAdminAction({ actorId: admin.email, action: "service.created", entityType: "service", entityId: service.id, details: { name: service.name, durationMinutes: service.durationMinutes, priceCents: service.priceCents } });
  return Response.json({ service }, { status: 201 });
}
