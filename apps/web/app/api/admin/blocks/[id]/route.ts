import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireAdmin } from "../../../../../lib/admin-auth";
import { recordAdminAction } from "../../../../../lib/audit";
import { getDb } from "../../../../../lib/db";
import { manualBlocks } from "../../../../../lib/db/schema";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.uuid().safeParse((await context.params).id);
  if (!parsed.success) return Response.json({ error: "Invalid block." }, { status: 400 });
  const [block] = await getDb().delete(manualBlocks).where(eq(manualBlocks.id, parsed.data)).returning();
  if (block) await recordAdminAction({ actorId: admin.email, action: "availability_block.deleted", entityType: "manual_block", entityId: block.id, details: { reason: block.reason } });
  return Response.json({ ok: true });
}
