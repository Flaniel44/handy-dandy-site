import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";

import { SESSION_COOKIE, adminCookieOptions, createCustomerSessionToken, requireCustomer } from "../../../../lib/admin-auth";
import { getDb } from "../../../../lib/db";
import { customers } from "../../../../lib/db/schema";

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().regex(/^\d*$/, "Phone number can only contain numbers.").max(30),
  streetAddress: z.string().trim().max(200),
  unit: z.string().trim().max(30),
  city: z.string().trim().max(100),
  postalCode: z.string().trim().max(20),
  country: z.string().trim().max(80),
});

export async function GET() {
  const session = await requireCustomer();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const [profile] = await getDb().select({
    firstName: customers.firstName, lastName: customers.lastName, email: customers.email, phone: customers.phone,
    streetAddress: customers.streetAddress, unit: customers.unit, city: customers.city,
    postalCode: customers.postalCode, country: customers.country,
  }).from(customers).where(eq(customers.id, session.customerId)).limit(1);
  return profile ? Response.json({ profile }) : Response.json({ error: "Profile not found." }, { status: 404 });
}

export async function PATCH(request: Request) {
  const session = await requireCustomer();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Check your profile details." }, { status: 400 });
  await getDb().update(customers).set({
    ...parsed.data,
    name: `${parsed.data.firstName} ${parsed.data.lastName}`,
    phone: parsed.data.phone || null,
    streetAddress: parsed.data.streetAddress || null,
    unit: parsed.data.unit || null,
    city: parsed.data.city || null,
    postalCode: parsed.data.postalCode || null,
    country: parsed.data.country || null,
    updatedAt: new Date(),
  }).where(eq(customers.id, session.customerId));
  (await cookies()).set(SESSION_COOKIE, createCustomerSessionToken({
    id: session.customerId, email: session.email, firstName: parsed.data.firstName, authVersion: session.authVersion,
  }), adminCookieOptions());
  return Response.json({ ok: true });
}
