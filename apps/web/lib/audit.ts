import { getDb } from "./db";
import { auditLog } from "./db/schema";

export async function recordAdminAction(input: {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
}) {
  await getDb().insert(auditLog).values({ ...input, details: input.details ?? {} });
}
