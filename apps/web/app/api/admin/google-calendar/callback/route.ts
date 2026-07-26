import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { adminCookieOptions, requireAdmin } from "../../../../../lib/admin-auth";
import { connectGoogleCalendar } from "../../../../../lib/google-calendar";
import { publicUrl } from "../../../../../lib/public-url";

const STATE_COOKIE = "handy_dandy_google_oauth_state";

export async function GET(request: Request) {
  if (!await requireAdmin()) return Response.redirect(publicUrl(request, "/admin/login"));
  const url = new URL(request.url); const code = url.searchParams.get("code"); const state = url.searchParams.get("state");
  const cookieStore = await cookies(); const expected = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.set(STATE_COOKIE, "", { ...adminCookieOptions(), maxAge: 0 });
  if (!code || !state || !expected || !safeEqual(state, expected)) return Response.redirect(publicUrl(request, "/admin?calendar=invalid"));
  try {
    await connectGoogleCalendar(code);
    return Response.redirect(publicUrl(request, "/admin?calendar=connected"));
  } catch (error) {
    console.error("Unable to connect Google Calendar", error);
    return Response.redirect(publicUrl(request, "/admin?calendar=failed"));
  }
}

function safeEqual(first: string, second: string) {
  const a = Buffer.from(first); const b = Buffer.from(second);
  return a.length === b.length && timingSafeEqual(a, b);
}
