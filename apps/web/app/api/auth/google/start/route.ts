import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { adminCookieOptions } from "../../../../../lib/admin-auth";
import { createPkceChallenge, getGoogleLoginAuthorizationUrl, googleLoginConfigured } from "../../../../../lib/google-login";

export const GOOGLE_LOGIN_STATE_COOKIE = "handy_dandy_google_login_state";
export const GOOGLE_LOGIN_VERIFIER_COOKIE = "handy_dandy_google_login_verifier";

export async function GET(request: Request) {
  if (!googleLoginConfigured()) return Response.redirect(new URL("/login?oauth=unavailable", request.url));
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const cookieStore = await cookies();
  const options = { ...adminCookieOptions(), maxAge: 600 };
  cookieStore.set(GOOGLE_LOGIN_STATE_COOKIE, state, options);
  cookieStore.set(GOOGLE_LOGIN_VERIFIER_COOKIE, verifier, options);
  return Response.redirect(getGoogleLoginAuthorizationUrl(state, createPkceChallenge(verifier)));
}
