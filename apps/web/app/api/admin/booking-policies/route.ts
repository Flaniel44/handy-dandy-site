import { eq } from "drizzle-orm";
import { IANAZone } from "luxon";
import { z } from "zod";

import { requireAdmin } from "../../../../lib/admin-auth";
import { getDb } from "../../../../lib/db";
import { businessSettings } from "../../../../lib/db/schema";

const policySchema = z.object({
  timezone: z.string().trim().refine(IANAZone.isValidZone, "Choose a valid IANA timezone."),
  slotIntervalMinutes: z.number().int().min(5).max(240),
  minimumNoticeMinutes: z.number().int().min(0).max(43_200),
  bookingWindowDays: z.number().int().min(1).max(730),
  appointmentBufferMinutes: z.number().int().min(0).max(1_440),
  cancellationNoticeMinutes: z.number().int().min(0).max(43_200),
});

const selection = {
  timezone: businessSettings.timezone,
  slotIntervalMinutes: businessSettings.slotIntervalMinutes,
  minimumNoticeMinutes: businessSettings.minimumNoticeMinutes,
  bookingWindowDays: businessSettings.bookingWindowDays,
  appointmentBufferMinutes: businessSettings.appointmentBufferMinutes,
  cancellationNoticeMinutes: businessSettings.cancellationNoticeMinutes,
};

export async function GET() {
  if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const [policies] = await getDb().select(selection).from(businessSettings).limit(1);
  if (!policies) return Response.json({ error: "Business settings are missing." }, { status: 500 });
  return Response.json({ policies }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: Request) {
  if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = policySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Check the booking policies." }, { status: 400 });
  const db = getDb();
  const [business] = await db.select({ id: businessSettings.id }).from(businessSettings).limit(1);
  if (!business) return Response.json({ error: "Business settings are missing." }, { status: 500 });
  const [policies] = await db.update(businessSettings).set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(businessSettings.id, business.id)).returning(selection);
  return Response.json({ policies });
}
