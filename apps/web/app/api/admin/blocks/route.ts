import { asc } from "drizzle-orm";
import { DateTime } from "luxon";
import { z } from "zod";

import { requireAdmin } from "../../../../lib/admin-auth";
import { recordAdminAction } from "../../../../lib/audit";
import { getDb } from "../../../../lib/db";
import { businessSettings, manualBlocks } from "../../../../lib/db/schema";

const blockSchema = z.object({
  startsAtLocal: z.string().min(1), endsAtLocal: z.string().min(1), reason: z.string().trim().min(2).max(200),
});

export async function GET() {
  if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const blocks = await getDb().select().from(manualBlocks).orderBy(asc(manualBlocks.startsAt));
  return Response.json({ blocks });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = blockSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the vacation dates." }, { status: 400 });
  const db = getDb(); const [settings] = await db.select().from(businessSettings).limit(1);
  if (!settings) return Response.json({ error: "Business settings are missing." }, { status: 500 });
  const startsAt = DateTime.fromISO(parsed.data.startsAtLocal, { zone: settings.timezone });
  const endsAt = DateTime.fromISO(parsed.data.endsAtLocal, { zone: settings.timezone });
  if (!startsAt.isValid || !endsAt.isValid || endsAt <= startsAt) return Response.json({ error: "Vacation end must be after its start." }, { status: 400 });
  const [block] = await db.insert(manualBlocks).values({
    businessId: settings.id, startsAt: startsAt.toJSDate(), endsAt: endsAt.toJSDate(), reason: parsed.data.reason,
  }).returning();
  await recordAdminAction({ actorId: admin.email, action: "availability_block.created", entityType: "manual_block", entityId: block.id, details: { reason: block.reason, startsAt: block.startsAt.toISOString(), endsAt: block.endsAt.toISOString() } });
  return Response.json({ block }, { status: 201 });
}
