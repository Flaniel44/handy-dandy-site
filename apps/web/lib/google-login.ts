import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";

const tokenSchema = z.object({ access_token: z.string().min(1) });
const userInfoSchema = z.object({
  sub: z.string().min(1),
  email: z.email().transform((value) => value.trim().toLowerCase()),
  email_verified: z.literal(true),
  name: z.string().trim().optional(),
  given_name: z.string().trim().optional(),
  family_name: z.string().trim().optional(),
});

export type GoogleLoginProfile = {
  subject: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
};

export function googleLoginConfigured() {
  return Boolean(process.env.GOOGLE_LOGIN_CLIENT_ID && process.env.GOOGLE_LOGIN_CLIENT_SECRET);
}

export function createPkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function getGoogleLoginAuthorizationUrl(state: string, codeChallenge: string) {
  const clientId = process.env.GOOGLE_LOGIN_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_LOGIN_CLIENT_SECRET) throw new Error("Google login is not configured.");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleLoginCode(code: string, verifier: string): Promise<GoogleLoginProfile> {
  const clientId = process.env.GOOGLE_LOGIN_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_LOGIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google login is not configured.");

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    cache: "no-store",
  });
  if (!tokenResponse.ok) throw new Error("Google rejected the login authorization code.");
  const token = tokenSchema.parse(await tokenResponse.json());

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
    cache: "no-store",
  });
  if (!profileResponse.ok) throw new Error("Google could not verify the account profile.");
  const profile = userInfoSchema.parse(await profileResponse.json());
  return {
    subject: profile.sub,
    email: profile.email,
    name: profile.name,
    firstName: profile.given_name,
    lastName: profile.family_name,
  };
}

function redirectUri() {
  return process.env.GOOGLE_LOGIN_REDIRECT_URI
    || `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/api/auth/google/callback`;
}
