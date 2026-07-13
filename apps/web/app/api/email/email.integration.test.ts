import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let email: typeof import("../../../lib/email");
let fetchMock: ReturnType<typeof vi.fn>;
const originalEnvironment = {
  apiKey: process.env.RESEND_API_KEY,
  from: process.env.EMAIL_FROM,
  replyTo: process.env.EMAIL_REPLY_TO,
  alertTo: process.env.EMAIL_FAILURE_ALERT_TO,
  appUrl: process.env.APP_URL,
  timezone: process.env.BUSINESS_TIMEZONE,
};

beforeAll(async () => {
  email = await import("../../../lib/email");
});

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("NODE_ENV", "test");
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.EMAIL_FROM = "Handy Dandy <bookings@whatisthis.place>";
  process.env.EMAIL_REPLY_TO = "hello@whatisthis.place";
  process.env.EMAIL_FAILURE_ALERT_TO = "owner@whatisthis.place";
  process.env.APP_URL = "https://whatisthis.place/";
  process.env.BUSINESS_TIMEZONE = "America/Toronto";
  fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email-id" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterAll(() => {
  vi.unstubAllEnvs();
  restoreEnvironment("RESEND_API_KEY", originalEnvironment.apiKey);
  restoreEnvironment("EMAIL_FROM", originalEnvironment.from);
  restoreEnvironment("EMAIL_REPLY_TO", originalEnvironment.replyTo);
  restoreEnvironment("EMAIL_FAILURE_ALERT_TO", originalEnvironment.alertTo);
  restoreEnvironment("APP_URL", originalEnvironment.appUrl);
  restoreEnvironment("BUSINESS_TIMEZONE", originalEnvironment.timezone);
  vi.unstubAllGlobals();
});

describe("transactional email delivery", () => {
  it("logs email locally without contacting Resend when no API key is configured", async () => {
    delete process.env.RESEND_API_KEY;
    vi.stubEnv("NODE_ENV", "development");
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await email.sendTransactionalEmail({
      to: "client@example.com", subject: "Development message", html: "<p>Hello</p>", text: "Hello",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("Development email", expect.objectContaining({
      to: "client@example.com", from: "Handy Dandy <bookings@whatisthis.place>", replyTo: "hello@whatisthis.place",
    }));
    log.mockRestore();
  });

  it("fails safely in production when the Resend key is missing", async () => {
    delete process.env.RESEND_API_KEY;
    vi.stubEnv("NODE_ENV", "production");
    await expect(email.sendTransactionalEmail({ to: "a@example.com", subject: "Test", html: "Test", text: "Test" }))
      .rejects.toThrow("RESEND_API_KEY is required in production");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries transient delivery failures up to three total attempts", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("server error", { status: 503 }))
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "delivered" }), { status: 200 }));

    await email.sendTransactionalEmail({ to: "a@example.com", subject: "Test", html: "Test", text: "Test" });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)).to)).toEqual([
      "a@example.com", "a@example.com", "a@example.com",
    ]);
  });

  it("alerts the owner with the intended message after all three attempts fail", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("server error", { status: 503 }))
      .mockResolvedValueOnce(new Response("server error", { status: 503 }))
      .mockResolvedValueOnce(new Response("server error", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "alert-delivered" }), { status: 200 }));

    await expect(email.sendTransactionalEmail({
      to: "customer@example.com",
      subject: "Your appointment changed",
      html: "<p>Please arrive at 2 p.m.</p>",
      text: "Please arrive at 2 p.m.",
    })).rejects.toThrow("Resend rejected an email with status 503");

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const alert = resendBody(3);
    expect(alert.to).toBe("owner@whatisthis.place");
    expect(alert.subject).toBe("Action required: email to customer@example.com failed");
    expect(alert.text).toContain("after 3 attempts");
    expect(alert.text).toContain("Subject: Your appointment changed");
    expect(alert.text).toContain("Please arrive at 2 p.m.");
  });

  it("sends booking confirmations with configured sender fields and escaped customer content", async () => {
    const startsAt = new Date("2026-08-03T17:00:00.000Z");
    await email.sendBookingConfirmation("ada@example.com", "Ada <Admin>", "Lights & Music", startsAt);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer re_test_key");
    const body = JSON.parse(String(init?.body)) as Record<string, string>;
    expect(body).toMatchObject({
      to: "ada@example.com",
      from: "Handy Dandy <bookings@whatisthis.place>",
      reply_to: "hello@whatisthis.place",
      subject: "Your Handy Dandy appointment is confirmed",
    });
    expect(body.text).toContain("Ada <Admin>");
    expect(body.html).toContain("Ada &lt;Admin&gt;");
    expect(body.html).toContain("Lights &amp; Music");
    expect(body.text).toContain("Monday, August 3, 2026 at 1:00 p.m.");
  });

  it("builds an encoded password-reset link and escapes it in HTML", async () => {
    await email.sendPasswordResetEmail("ada@example.com", "Ada & Co", "token+with?symbols");

    const body = resendBody(0);
    expect(body.text).toContain("https://whatisthis.place/reset-password?token=token%2Bwith%3Fsymbols");
    expect(body.html).toContain("Ada &amp; Co");
    expect(body.html).toContain("token%2Bwith%3Fsymbols");
  });

  it("generates distinct cancellation, rescheduling, and password-change notices", async () => {
    const oldTime = new Date("2026-08-03T17:00:00.000Z");
    const newTime = new Date("2026-08-04T19:00:00.000Z");
    await email.sendAppointmentCancelled("ada@example.com", "Ada", "Consultation", oldTime);
    await email.sendAppointmentRescheduled("ada@example.com", "Ada", "Consultation", oldTime, newTime);
    await email.sendPasswordChangedEmail("ada@example.com", "Ada");

    expect(resendBody(0).subject).toBe("Your Handy Dandy appointment was cancelled");
    expect(resendBody(1).subject).toBe("Your Handy Dandy appointment was rescheduled");
    expect(resendBody(1).text).toContain("Tuesday, August 4, 2026 at 3:00 p.m.");
    expect(resendBody(2).subject).toBe("Your Handy Dandy password was changed");
  });

  it("generates separate client and admin appointment reminders", async () => {
    const startsAt = new Date("2026-08-03T17:00:00.000Z");
    await email.sendCustomerAppointmentReminder("client@example.com", "Ada", "Consultation", startsAt);
    await email.sendAdminAppointmentReminder(
      "owner@example.com", "Ada", "client@example.com", "Consultation", startsAt, "Bring the hub",
    );

    expect(resendBody(0).subject).toBe("Reminder: your Handy Dandy appointment is tomorrow");
    expect(resendBody(0).text).toContain("Monday, August 3, 2026 at 1:00 p.m.");
    expect(resendBody(1).subject).toBe("Reminder: Ada is booked tomorrow");
    expect(resendBody(1).text).toContain("Client: Ada <client@example.com>");
    expect(resendBody(1).text).toContain("Bring the hub");
  });
});

function resendBody(index: number) {
  return JSON.parse(String(fetchMock.mock.calls[index]?.[1]?.body)) as Record<string, string>;
}

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
