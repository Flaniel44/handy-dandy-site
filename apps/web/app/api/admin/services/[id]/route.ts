import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireAdmin } from "../../../../../lib/admin-auth";
import { recordAdminAction } from "../../../../../lib/audit";
import { getDb } from "../../../../../lib/db";
import { services } from "../../../../../lib/db/schema";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  priceCents: z.number().int().min(0).max(10_000_000).optional(),
  active: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one service field is required.");

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = z.uuid().safeParse((await params).id);
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !parsed.success) return Response.json({ error: "Check the service details." }, { status: 400 });
  const [service] = await getDb().update(services).set(parsed.data).where(eq(services.id, id.data)).returning();
  if (!service) return Response.json({ error: "Service not found." }, { status: 404 });
  await recordAdminAction({ actorId: admin.email, action: "service.updated", entityType: "service", entityId: service.id, details: parsed.data });
  return Response.json({ service });
}
