import { cookies } from "next/headers";
import { z } from "zod";

import { ADMIN_COOKIE, adminCookieOptions, createAdminSessionToken, verifyPassword } from "../../../../lib/admin-auth";
import { recordAdminAction } from "../../../../lib/audit";
import { checkRateLimit, rateLimitResponse } from "../../../../lib/rate-limit";

const loginSchema = z.object({ email: z.email(), password: z.string().min(1).max(200) });

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request, "admin-login", 5, 15 * 60);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!parsed.success || !adminEmail || !passwordHash) {
    return Response.json({ error: "Invalid email or password." }, { status: 401 });
  }
  if (parsed.data.email.toLowerCase() !== adminEmail || !verifyPassword(parsed.data.password, passwordHash)) {
    return Response.json({ error: "Invalid email or password." }, { status: 401 });
  }
  (await cookies()).set(ADMIN_COOKIE, createAdminSessionToken(adminEmail), adminCookieOptions());
  await recordAdminAction({ actorId: adminEmail, action: "admin.login", entityType: "admin_session", entityId: adminEmail });
  return Response.json({ ok: true });
}
