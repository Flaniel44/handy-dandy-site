import { desc, sql } from "drizzle-orm";
import { z } from "zod";

import { requireAdmin } from "../../../../lib/admin-auth";
import { getDb } from "../../../../lib/db";
import { auditLog } from "../../../../lib/db/schema";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: Request) {
  if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ page: url.searchParams.get("page") ?? 1, pageSize: url.searchParams.get("pageSize") ?? 20 });
  if (!parsed.success) return Response.json({ error: "Invalid pagination." }, { status: 400 });
  const { page, pageSize } = parsed.data;
  const db = getDb();
  const [[count], entries] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int` }).from(auditLog),
    db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
  ]);
  const total = count?.total ?? 0;
  return Response.json({ entries, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
