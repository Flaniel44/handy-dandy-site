import { createHash } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";

import { adminCookieOptions, hashPassword, SESSION_COOKIE } from "../../../../lib/admin-auth";
import { getDb } from "../../../../lib/db";
import { customers, passwordResetTokens } from "../../../../lib/db/schema";
import { sendPasswordChangedEmail } from "../../../../lib/email";
import { checkRateLimit, rateLimitResponse } from "../../../../lib/rate-limit";

const schema = z.object({ token: z.string().min(20).max(200), password: z.string().min(12).max(200) });

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request, "reset-password", 10, 60 * 60);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Use a valid reset link and a password of at least 12 characters." }, { status: 400 });
  const db = getDb();
  const [reset] = await db.select().from(passwordResetTokens).where(and(
    eq(passwordResetTokens.tokenHash, createHash("sha256").update(parsed.data.token).digest("hex")),
    isNull(passwordResetTokens.usedAt),
    gt(passwordResetTokens.expiresAt, new Date()),
  )).limit(1);
  if (!reset) return Response.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
  const [customer] = await db.select({ email: customers.email, firstName: customers.firstName, name: customers.name }).from(customers).where(eq(customers.id, reset.customerId)).limit(1);
  if (!customer) return Response.json({ error: "This reset link is invalid or has expired." }, { status: 400 });

  await db.transaction(async (tx) => {
    await tx.update(customers).set({ passwordHash: hashPassword(parsed.data.password), authVersion: sql`${customers.authVersion} + 1`, updatedAt: new Date() }).where(eq(customers.id, reset.customerId));
    await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(and(eq(passwordResetTokens.customerId, reset.customerId), isNull(passwordResetTokens.usedAt)));
  });
  (await cookies()).set(SESSION_COOKIE, "", { ...adminCookieOptions(), maxAge: 0 });
  try {
    await sendPasswordChangedEmail(customer.email, customer.firstName || customer.name.split(" ")[0]);
  } catch (error) {
    console.error("Password changed but the security email failed", error);
  }
  return Response.json({ ok: true });
}
