import "server-only";

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "handy_dandy_session";
export const ADMIN_COOKIE = SESSION_COOKIE;
const SESSION_SECONDS = 60 * 60 * 12;

export type AppSession =
  | { role: "admin"; email: string; expiresAt: number }
  | { role: "customer"; email: string; customerId: string; firstName: string; expiresAt: number };
type SessionInput =
  | { role: "admin"; email: string }
  | { role: "customer"; email: string; customerId: string; firstName: string };

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, salt, expectedHex] = encodedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createAdminSessionToken(email: string) {
  return createSessionToken({ role: "admin", email });
}

export function createCustomerSessionToken(customer: { id: string; email: string; firstName: string }) {
  return createSessionToken({ role: "customer", email: customer.email, customerId: customer.id, firstName: customer.firstName });
}

export function readSessionToken(token?: string): AppSession | null {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = Buffer.from(sign(encoded)); const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as AppSession;
    if (!payload.email || !payload.role || payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch { return null; }
}

export async function getSession() {
  return readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requireAdmin() {
  const session = await getSession();
  return session?.role === "admin" ? session : null;
}

export async function requireCustomer() {
  const session = await getSession();
  return session?.role === "customer" ? session : null;
}

export function adminCookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_SECONDS };
}

function createSessionToken(payload: SessionInput) {
  const complete = { ...payload, expiresAt: Date.now() + SESSION_SECONDS * 1000 } as AppSession;
  const encoded = Buffer.from(JSON.stringify(complete)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function sign(payload: string) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters.");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
