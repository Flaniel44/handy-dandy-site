import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetTestData } from "../../../test/integration/database";
import { checkRateLimit } from "../../../lib/rate-limit";
import { isTrustedMutation } from "../../../lib/request-security";

const cookieJar = vi.hoisted(() => new Map<string, string>());
const email = vi.hoisted(() => ({
  sendPasswordChangedEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      if (value) cookieJar.set(name, value);
      else cookieJar.delete(name);
    },
  })),
}));
vi.mock("../../../lib/email", () => ({
  sendPasswordChangedEmail: email.sendPasswordChangedEmail,
  sendPasswordResetEmail: email.sendPasswordResetEmail,
}));

const PASSWORD = "correct horse battery staple";
const NEW_PASSWORD = "even better battery staple";

let testSql: ReturnType<typeof postgres>;
let register: typeof import("./register/route").POST;
let login: typeof import("./login/route").POST;
let logout: typeof import("./logout/route").POST;
let currentUser: typeof import("./me/route").GET;
let forgotPassword: typeof import("./forgot-password/route").POST;
let resetPassword: typeof import("./reset-password/route").POST;
let startGoogleLogin: typeof import("./google/start/route").GET;
let finishGoogleLogin: typeof import("./google/callback/route").GET;
let getProfile: typeof import("../account/profile/route").GET;
let updateProfile: typeof import("../account/profile/route").PATCH;
let hashPassword: typeof import("../../../lib/admin-auth").hashPassword;

beforeAll(async () => {
  process.env.ADMIN_SESSION_SECRET = "integration-test-session-secret-at-least-32-characters";
  testSql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  ({ POST: register } = await import("./register/route"));
  ({ POST: login } = await import("./login/route"));
  ({ POST: logout } = await import("./logout/route"));
  ({ GET: currentUser } = await import("./me/route"));
  ({ POST: forgotPassword } = await import("./forgot-password/route"));
  ({ POST: resetPassword } = await import("./reset-password/route"));
  ({ GET: startGoogleLogin } = await import("./google/start/route"));
  ({ GET: finishGoogleLogin } = await import("./google/callback/route"));
  ({ GET: getProfile, PATCH: updateProfile } = await import("../account/profile/route"));
  ({ hashPassword } = await import("../../../lib/admin-auth"));
});

beforeEach(async () => {
  await resetTestData(testSql);
  cookieJar.clear();
  vi.clearAllMocks();
  delete process.env.ADMIN_EMAIL;
  delete process.env.ADMIN_PASSWORD_HASH;
  delete process.env.GOOGLE_LOGIN_CLIENT_ID;
  delete process.env.GOOGLE_LOGIN_CLIENT_SECRET;
  delete process.env.GOOGLE_LOGIN_REDIRECT_URI;
});

afterAll(async () => {
  await testSql?.end();
});

describe("authentication routes", () => {
  it("persistently rate limits repeated requests by client address", async () => {
    const request = () => new Request("http://localhost/api/auth/login", { method: "POST", headers: { "x-real-ip": "203.0.113.44" } });
    expect((await checkRateLimit(request(), "test-login", 2, 900)).allowed).toBe(true);
    expect((await checkRateLimit(request(), "test-login", 2, 900)).allowed).toBe(true);
    const blocked = await checkRateLimit(request(), "test-login", 2, 900);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("blocks cross-site mutations while allowing same-origin and server requests", () => {
    const originalAppUrl = process.env.APP_URL;
    const originalNodeEnv = process.env.NODE_ENV;
    vi.stubEnv("NODE_ENV", "production");
    process.env.APP_URL = "https://whatisthis.place";
    expect(isTrustedMutation(new Request("https://whatisthis.place/api/bookings", { method: "POST", headers: { origin: "https://whatisthis.place" } }))).toBe(true);
    expect(isTrustedMutation(new Request("https://whatisthis.place/api/bookings", { method: "POST", headers: { origin: "https://evil.example" } }))).toBe(false);
    expect(isTrustedMutation(new Request("https://whatisthis.place/api/bookings", { method: "POST", headers: { "sec-fetch-site": "cross-site" } }))).toBe(false);
    expect(isTrustedMutation(new Request("https://whatisthis.place/api/bookings", { method: "POST" }))).toBe(true);
    if (originalAppUrl === undefined) delete process.env.APP_URL; else process.env.APP_URL = originalAppUrl;
    vi.stubEnv("NODE_ENV", originalNodeEnv);
  });

  it("validates registration, creates a normalized account, and rejects duplicates", async () => {
    const invalid = await register(jsonRequest("/api/auth/register", {
      ...registrationData(), password: "short", phone: "555-HELP",
    }));
    expect(invalid.status).toBe(400);

    const response = await register(jsonRequest("/api/auth/register", registrationData()));
    expect(response.status).toBe(201);
    expect(cookieJar.get("handy_dandy_session")).toBeTruthy();

    const [customer] = await testSql<{
      email: string;
      name: string;
      first_name: string;
      phone: string;
      country: string;
      password_hash: string;
    }[]>`
      SELECT email, name, first_name, phone, country, password_hash
      FROM customers WHERE email = 'ada@example.com'
    `;
    expect(customer.email).toBe("ada@example.com");
    expect(customer.name).toBe("Ada Lovelace");
    expect(customer.first_name).toBe("Ada");
    expect(customer.phone).toBe("4165550100");
    expect(customer.country).toBe("Canada");
    expect(customer.password_hash).toMatch(/^scrypt:/);
    expect(customer.password_hash).not.toContain(PASSWORD);

    cookieJar.clear();
    const duplicate = await register(jsonRequest("/api/auth/register", registrationData()));
    expect(duplicate.status).toBe(409);
  });

  it("supports customer and admin login, session lookup, and logout", async () => {
    await register(jsonRequest("/api/auth/register", registrationData()));
    cookieJar.clear();

    expect((await login(jsonRequest("/api/auth/login", {
      email: "ada@example.com", password: "wrong password",
    }))).status).toBe(401);

    const customerLogin = await login(jsonRequest("/api/auth/login", {
      email: "ADA@example.com", password: PASSWORD,
    }));
    expect(customerLogin.status).toBe(200);
    expect(await customerLogin.json()).toEqual({ ok: true, destination: "/account" });
    expect(await (await currentUser()).json()).toEqual({ user: { role: "customer", firstName: "Ada" } });

    expect((await logout()).status).toBe(200);
    expect(await (await currentUser()).json()).toEqual({ user: null });

    process.env.ADMIN_EMAIL = "admin@example.com";
    process.env.ADMIN_PASSWORD_HASH = hashPassword("admin password is long");
    const adminLogin = await login(jsonRequest("/api/auth/login", {
      email: "admin@example.com", password: "admin password is long",
    }));
    expect(adminLogin.status).toBe(200);
    expect(await adminLogin.json()).toEqual({ ok: true, destination: "/admin" });
    expect(await (await currentUser()).json()).toEqual({ user: { role: "admin", firstName: "Admin" } });
  });

  it("uses state and PKCE to link a verified Google identity to an existing customer", async () => {
    await register(jsonRequest("/api/auth/register", registrationData()));
    cookieJar.clear();
    process.env.GOOGLE_LOGIN_CLIENT_ID = "google-login-client";
    process.env.GOOGLE_LOGIN_CLIENT_SECRET = "google-login-secret";
    process.env.GOOGLE_LOGIN_REDIRECT_URI = "http://localhost/api/auth/google/callback";

    const start = await startGoogleLogin(new Request("http://localhost/api/auth/google/start"));
    expect(start.status).toBe(302);
    const authorizationUrl = new URL(start.headers.get("location")!);
    const state = cookieJar.get("handy_dandy_google_login_state");
    const verifier = cookieJar.get("handy_dandy_google_login_verifier");
    expect(authorizationUrl.origin).toBe("https://accounts.google.com");
    expect(authorizationUrl.searchParams.get("scope")).toBe("openid email profile");
    expect(authorizationUrl.searchParams.get("state")).toBe(state);
    expect(authorizationUrl.searchParams.get("code_challenge")).toBeTruthy();
    expect(verifier).toBeTruthy();

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url === "https://oauth2.googleapis.com/token") {
        const body = init?.body as URLSearchParams;
        expect(body.get("code_verifier")).toBe(verifier);
        expect(body.get("code")).toBe("valid-code");
        return Response.json({ access_token: "verified-access-token" });
      }
      if (url === "https://openidconnect.googleapis.com/v1/userinfo") {
        expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer verified-access-token");
        return Response.json({
          sub: "google-subject-123",
          email: "ADA@example.com",
          email_verified: true,
          name: "Ada Lovelace",
          given_name: "Ada",
          family_name: "Lovelace",
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const callback = await finishGoogleLogin(new Request(
      `http://localhost/api/auth/google/callback?code=valid-code&state=${encodeURIComponent(state!)}`,
    ));
    fetchMock.mockRestore();
    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toBe("http://localhost/account");
    expect(cookieJar.get("handy_dandy_session")).toBeTruthy();
    expect(cookieJar.has("handy_dandy_google_login_state")).toBe(false);
    expect(cookieJar.has("handy_dandy_google_login_verifier")).toBe(false);

    const [customer] = await testSql<{ google_subject: string; password_hash: string }[]>`
      SELECT google_subject, password_hash FROM customers WHERE email = 'ada@example.com'
    `;
    expect(customer.google_subject).toBe("google-subject-123");
    expect(customer.password_hash).toMatch(/^scrypt:/);
    expect(await (await currentUser()).json()).toEqual({ user: { role: "customer", firstName: "Ada" } });
  });

  it("rejects a Google callback whose state does not match", async () => {
    process.env.GOOGLE_LOGIN_CLIENT_ID = "google-login-client";
    process.env.GOOGLE_LOGIN_CLIENT_SECRET = "google-login-secret";
    await startGoogleLogin(new Request("http://localhost/api/auth/google/start"));
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const callback = await finishGoogleLogin(new Request(
      "http://localhost/api/auth/google/callback?code=stolen-code&state=wrong-state",
    ));
    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toBe("http://localhost/login?oauth=invalid");
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it("issues a single-use reset token and invalidates the old session", async () => {
    await register(jsonRequest("/api/auth/register", registrationData()));
    const oldSession = cookieJar.get("handy_dandy_session")!;

    const unknown = await forgotPassword(jsonRequest("/api/auth/forgot-password", { email: "unknown@example.com" }));
    const known = await forgotPassword(jsonRequest("/api/auth/forgot-password", { email: "ada@example.com" }));
    expect(await unknown.json()).toEqual(await known.clone().json());
    expect(email.sendPasswordResetEmail).toHaveBeenCalledOnce();
    const token = email.sendPasswordResetEmail.mock.calls[0]![2] as string;

    await forgotPassword(jsonRequest("/api/auth/forgot-password", { email: "ada@example.com" }));
    expect(email.sendPasswordResetEmail).toHaveBeenCalledOnce();
    const [{ count: tokenCount }] = await testSql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM password_reset_tokens
    `;
    expect(tokenCount).toBe(1);

    const reset = await resetPassword(jsonRequest("/api/auth/reset-password", { token, password: NEW_PASSWORD }));
    expect(reset.status).toBe(200);
    expect(email.sendPasswordChangedEmail).toHaveBeenCalledOnce();

    const reused = await resetPassword(jsonRequest("/api/auth/reset-password", { token, password: PASSWORD }));
    expect(reused.status).toBe(400);

    cookieJar.set("handy_dandy_session", oldSession);
    expect((await getProfile()).status).toBe(401);
    expect((await login(jsonRequest("/api/auth/login", {
      email: "ada@example.com", password: PASSWORD,
    }))).status).toBe(401);
    expect((await login(jsonRequest("/api/auth/login", {
      email: "ada@example.com", password: NEW_PASSWORD,
    }))).status).toBe(200);
  });

  it("updates an authenticated profile without allowing the email to change", async () => {
    expect((await getProfile()).status).toBe(401);
    await register(jsonRequest("/api/auth/register", registrationData()));

    const response = await updateProfile(jsonRequest("/api/account/profile", {
      firstName: "Grace", lastName: "Hopper", phone: "6475550199",
      streetAddress: "2 Computer Way", unit: "", city: "Toronto",
      postalCode: "M5V 2T6", country: "Canada", email: "changed@example.com",
    }));
    expect(response.status).toBe(200);

    const profileResponse = await getProfile();
    expect(profileResponse.status).toBe(200);
    const { profile } = await profileResponse.json() as { profile: { firstName: string; lastName: string; email: string } };
    expect(profile).toMatchObject({ firstName: "Grace", lastName: "Hopper", email: "ada@example.com" });
    expect(await (await currentUser()).json()).toEqual({ user: { role: "customer", firstName: "Grace" } });
  });

  it("keeps a usable reset token when the reset email provider is temporarily unavailable", async () => {
    await register(jsonRequest("/api/auth/register", registrationData()));
    email.sendPasswordResetEmail.mockRejectedValueOnce(new Error("Resend unavailable"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await forgotPassword(jsonRequest("/api/auth/forgot-password", { email: "ada@example.com" }));
    expect(response.status).toBe(200);
    const [{ count }] = await testSql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM password_reset_tokens WHERE used_at IS NULL AND expires_at > now()
    `;
    expect(count).toBe(1);
    expect(errorLog).toHaveBeenCalledWith("Unable to send password reset email", expect.any(Error));
    errorLog.mockRestore();
  });
});

function registrationData() {
  return {
    firstName: "Ada", lastName: "Lovelace", email: "ADA@EXAMPLE.COM", password: PASSWORD,
    phone: "4165550100", streetAddress: "1 Analytical Engine Lane", unit: "",
    city: "Toronto", postalCode: "M5V 1A1", country: "Canada",
  };
}

function jsonRequest(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
