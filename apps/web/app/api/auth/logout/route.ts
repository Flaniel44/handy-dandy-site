import { cookies } from "next/headers";
import { SESSION_COOKIE, adminCookieOptions } from "../../../../lib/admin-auth";

export async function POST() {
  (await cookies()).set(SESSION_COOKIE, "", { ...adminCookieOptions(), maxAge: 0 });
  return Response.json({ ok: true });
}
