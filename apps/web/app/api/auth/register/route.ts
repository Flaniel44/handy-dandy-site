import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { SESSION_COOKIE, adminCookieOptions, createCustomerSessionToken, hashPassword } from "../../../../lib/admin-auth";
import { getDb } from "../../../../lib/db";
import { customers } from "../../../../lib/db/schema";
import { checkRateLimit, rateLimitResponse } from "../../../../lib/rate-limit";

const schema = z.object({
  firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80),
  email: z.email().transform((value) => value.trim().toLowerCase()), password: z.string().min(12).max(200),
  phone: z.string().trim().regex(/^\d*$/, "Phone number can only contain numbers.").max(30).optional(),
  streetAddress: z.string().trim().max(200).optional(), unit: z.string().trim().max(30).optional(),
  city: z.string().trim().max(100).optional(), postalCode: z.string().trim().max(20).optional(),
  country: z.string().trim().max(80).optional(),
});

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request, "registration", 5, 60 * 60);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check your account details. Passwords need at least 12 characters." }, { status: 400 });
  if (parsed.data.email === process.env.ADMIN_EMAIL?.toLowerCase()) return Response.json({ error: "That email is already in use." }, { status: 409 });
  const db = getDb(); const [existing] = await db.select().from(customers).where(eq(customers.email, parsed.data.email)).limit(1);
  if (existing?.passwordHash) return Response.json({ error: "An account already exists for that email." }, { status: 409 });
  const values = {
    name: `${parsed.data.firstName} ${parsed.data.lastName}`, firstName: parsed.data.firstName, lastName: parsed.data.lastName,
    email: parsed.data.email, phone: parsed.data.phone || null,
    streetAddress: parsed.data.streetAddress || null, unit: parsed.data.unit || null,
    city: parsed.data.city || null, postalCode: parsed.data.postalCode || null, country: parsed.data.country || null,
    passwordHash: hashPassword(parsed.data.password), updatedAt: new Date(),
  };
  const [customer] = existing
    ? await db.update(customers).set(values).where(eq(customers.id, existing.id)).returning()
    : await db.insert(customers).values(values).returning();
  (await cookies()).set(SESSION_COOKIE, createCustomerSessionToken({ id: customer.id, email: customer.email, firstName: parsed.data.firstName, authVersion: customer.authVersion }), adminCookieOptions());
  return Response.json({ ok: true }, { status: 201 });
}
