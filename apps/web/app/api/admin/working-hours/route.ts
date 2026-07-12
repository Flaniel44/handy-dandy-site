import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireAdmin } from "../../../../lib/admin-auth";
import { getDb } from "../../../../lib/db";
import { businessSettings, weeklyHours } from "../../../../lib/db/schema";

const hoursSchema = z.object({ hours: z.array(z.object({
  weekday: z.number().int().min(0).max(6),
  startsAtLocal: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endsAtLocal: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
}).refine((value) => value.startsAtLocal < value.endsAtLocal, "End time must be after start time.")) });

export async function GET() {
  if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  const [settings] = await db.select().from(businessSettings).limit(1);
  const hours = settings ? await db.select().from(weeklyHours).where(eq(weeklyHours.businessId, settings.id)).orderBy(weeklyHours.weekday) : [];
  return Response.json({ timezone: settings?.timezone, hours });
}

export async function PUT(request: Request) {
  if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = hoursSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the working-hour values." }, { status: 400 });
  const db = getDb();
  const [settings] = await db.select().from(businessSettings).limit(1);
  if (!settings) return Response.json({ error: "Business settings are missing." }, { status: 500 });
  await db.transaction(async (tx) => {
    await tx.delete(weeklyHours).where(eq(weeklyHours.businessId, settings.id));
    if (parsed.data.hours.length) await tx.insert(weeklyHours).values(parsed.data.hours.map((hours) => ({ ...hours, businessId: settings.id })));
  });
  return Response.json({ ok: true });
}
