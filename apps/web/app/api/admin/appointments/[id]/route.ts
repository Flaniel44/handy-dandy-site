import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireAdmin } from "../../../../../lib/admin-auth";
import { getDb } from "../../../../../lib/db";
import { appointments, bookingSlots } from "../../../../../lib/db/schema";

const updateSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
  status: z.enum(["confirmed", "cancelled", "completed", "no_show"]).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = z.uuid().safeParse((await context.params).id);
  const body = updateSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return Response.json({ error: "Invalid update." }, { status: 400 });
  const db = getDb();
  const [existing] = await db.select({ slotId: appointments.slotId }).from(appointments).where(eq(appointments.id, id.data)).limit(1);
  if (!existing) return Response.json({ error: "Appointment not found." }, { status: 404 });
  await db.transaction(async (tx) => {
    await tx.update(appointments).set({ ...body.data, updatedAt: new Date() }).where(eq(appointments.id, id.data));
    if (body.data.status) await tx.update(bookingSlots).set({
      state: body.data.status === "confirmed" ? "confirmed" : "released", updatedAt: new Date(),
    }).where(eq(bookingSlots.id, existing.slotId));
  });
  return Response.json({ ok: true });
}
