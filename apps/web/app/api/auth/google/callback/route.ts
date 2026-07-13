import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { SESSION_COOKIE, adminCookieOptions, createCustomerSessionToken } from "../../../../../lib/admin-auth";
import { getDb } from "../../../../../lib/db";
import { customers } from "../../../../../lib/db/schema";
import { exchangeGoogleLoginCode } from "../../../../../lib/google-login";
import { GOOGLE_LOGIN_STATE_COOKIE, GOOGLE_LOGIN_VERIFIER_COOKIE } from "../start/route";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(GOOGLE_LOGIN_STATE_COOKIE)?.value;
  const verifier = cookieStore.get(GOOGLE_LOGIN_VERIFIER_COOKIE)?.value;
  const expired = { ...adminCookieOptions(), maxAge: 0 };
  cookieStore.set(GOOGLE_LOGIN_STATE_COOKIE, "", expired);
  cookieStore.set(GOOGLE_LOGIN_VERIFIER_COOKIE, "", expired);

  if (url.searchParams.has("error")) return loginRedirect(request, "cancelled");
  if (!code || !state || !expectedState || !verifier || !safeEqual(state, expectedState)) {
    return loginRedirect(request, "invalid");
  }

  try {
    const profile = await exchangeGoogleLoginCode(code, verifier);
    if (profile.email === process.env.ADMIN_EMAIL?.trim().toLowerCase()) return loginRedirect(request, "admin");
    const customer = await findOrCreateCustomer(profile);
    cookieStore.set(SESSION_COOKIE, createCustomerSessionToken({
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName || customer.name.split(" ")[0],
      authVersion: customer.authVersion,
    }), adminCookieOptions());
    return Response.redirect(new URL("/account", request.url));
  } catch (error) {
    console.error("Unable to complete Google login", error);
    return loginRedirect(request, "failed");
  }
}

async function findOrCreateCustomer(profile: Awaited<ReturnType<typeof exchangeGoogleLoginCode>>) {
  const db = getDb();
  const [linked] = await db.select().from(customers).where(eq(customers.googleSubject, profile.subject)).limit(1);
  if (linked) return linked;

  const [sameEmail] = await db.select().from(customers).where(eq(customers.email, profile.email)).limit(1);
  if (sameEmail) {
    const [customer] = await db.update(customers).set({
      googleSubject: profile.subject,
      firstName: sameEmail.firstName || profile.firstName || firstName(profile),
      lastName: sameEmail.lastName || profile.lastName || null,
      updatedAt: new Date(),
    }).where(eq(customers.id, sameEmail.id)).returning();
    return customer;
  }

  const givenName = profile.firstName || firstName(profile);
  const familyName = profile.lastName || null;
  const [customer] = await db.insert(customers).values({
    email: profile.email,
    googleSubject: profile.subject,
    name: profile.name || [givenName, familyName].filter(Boolean).join(" "),
    firstName: givenName,
    lastName: familyName,
  }).returning();
  return customer;
}

function firstName(profile: Awaited<ReturnType<typeof exchangeGoogleLoginCode>>) {
  return profile.name?.split(/\s+/)[0] || profile.email.split("@")[0];
}

function loginRedirect(request: Request, reason: string) {
  return Response.redirect(new URL(`/login?oauth=${reason}`, request.url));
}

function safeEqual(first: string, second: string) {
  const a = Buffer.from(first);
  const b = Buffer.from(second);
  return a.length === b.length && timingSafeEqual(a, b);
}
