import { cookies } from "next/headers";

import { ADMIN_COOKIE, adminCookieOptions } from "../../../../lib/admin-auth";

export async function POST() {
  (await cookies()).set(ADMIN_COOKIE, "", { ...adminCookieOptions(), maxAge: 0 });
  return Response.json({ ok: true });
}
