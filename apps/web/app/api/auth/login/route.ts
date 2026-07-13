import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { SESSION_COOKIE, adminCookieOptions, createAdminSessionToken, createCustomerSessionToken, verifyPassword } from "../../../../lib/admin-auth";
import { recordAdminAction } from "../../../../lib/audit";
import { getDb } from "../../../../lib/db";
import { customers } from "../../../../lib/db/schema";
import { checkRateLimit, rateLimitResponse } from "../../../../lib/rate-limit";

const schema = z.object({ email: z.email().transform((value) => value.toLowerCase()), password: z.string().min(1).max(200) });

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request, "auth-login", 10, 15 * 60);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid();
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const adminHash = process.env.ADMIN_PASSWORD_HASH;
  let token: string | undefined; let destination = "/account";
  if (adminEmail === parsed.data.email && adminHash && verifyPassword(parsed.data.password, adminHash)) {
    token = createAdminSessionToken(adminEmail); destination = "/admin";
  } else {
    const [customer] = await getDb().select().from(customers).where(eq(customers.email, parsed.data.email)).limit(1);
    if (customer?.passwordHash && verifyPassword(parsed.data.password, customer.passwordHash)) {
      token = createCustomerSessionToken({ id: customer.id, email: customer.email, firstName: customer.firstName || customer.name.split(" ")[0], authVersion: customer.authVersion });
    }
  }
  if (!token) return invalid();
  (await cookies()).set(SESSION_COOKIE, token, adminCookieOptions());
  if (destination === "/admin") await recordAdminAction({ actorId: parsed.data.email, action: "admin.login", entityType: "admin_session", entityId: parsed.data.email });
  return Response.json({ ok: true, destination });
}

function invalid() { return Response.json({ error: "Invalid email or password." }, { status: 401 }); }
