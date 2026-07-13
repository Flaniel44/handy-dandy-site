import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetTestData } from "../../../test/integration/database";

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
  ({ GET: getProfile, PATCH: updateProfile } = await import("../account/profile/route"));
  ({ hashPassword } = await import("../../../lib/admin-auth"));
});

beforeEach(async () => {
  await resetTestData(testSql);
  cookieJar.clear();
  vi.clearAllMocks();
  delete process.env.ADMIN_EMAIL;
  delete process.env.ADMIN_PASSWORD_HASH;
});

afterAll(async () => {
  await testSql?.end();
});

describe("authentication routes", () => {
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
