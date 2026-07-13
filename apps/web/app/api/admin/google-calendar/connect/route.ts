import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { adminCookieOptions, requireAdmin } from "../../../../../lib/admin-auth";
import { getGoogleAuthorizationUrl, googleCalendarConfigured } from "../../../../../lib/google-calendar";

const STATE_COOKIE = "handy_dandy_google_oauth_state";

export async function GET() {
  if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!googleCalendarConfigured()) return Response.json({ error: "Google Calendar environment variables are incomplete." }, { status: 503 });
  const state = randomBytes(32).toString("base64url");
  (await cookies()).set(STATE_COOKIE, state, { ...adminCookieOptions(), maxAge: 600 });
  return Response.redirect(getGoogleAuthorizationUrl(state));
}
