import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireAdmin } from "../../../../../lib/admin-auth";
import { getDb } from "../../../../../lib/db";
import { manualBlocks } from "../../../../../lib/db/schema";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.uuid().safeParse((await context.params).id);
  if (!parsed.success) return Response.json({ error: "Invalid block." }, { status: 400 });
  await getDb().delete(manualBlocks).where(eq(manualBlocks.id, parsed.data));
  return Response.json({ ok: true });
}
