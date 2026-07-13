import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetTestData } from "../../../../test/integration/database";

const SERVICE_ID = "22222222-2222-4222-8222-222222222222";
const email = vi.hoisted(() => ({
  sendAdminAppointmentReminder: vi.fn().mockResolvedValue(undefined),
  sendCustomerAppointmentReminder: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../../lib/email", () => ({
  sendAdminAppointmentReminder: email.sendAdminAppointmentReminder,
  sendCustomerAppointmentReminder: email.sendCustomerAppointmentReminder,
}));

let testSql: ReturnType<typeof postgres>;
let processReminderRequest: typeof import("./route").POST;
let sendDueAppointmentReminders: typeof import("../../../../lib/reminders").sendDueAppointmentReminders;

beforeAll(async () => {
  testSql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  ({ POST: processReminderRequest } = await import("./route"));
  ({ sendDueAppointmentReminders } = await import("../../../../lib/reminders"));
});

beforeEach(async () => {
  await resetTestData(testSql);
  process.env.REMINDER_CRON_SECRET = "integration-reminder-secret";
  process.env.APPOINTMENT_REMINDER_ADMIN_EMAIL = "owner@whatisthis.place";
  vi.clearAllMocks();
  email.sendAdminAppointmentReminder.mockResolvedValue(undefined);
  email.sendCustomerAppointmentReminder.mockResolvedValue(undefined);
});

afterAll(async () => {
  await testSql?.end();
});

describe("appointment reminder processing", () => {
  it("protects the internal runner with its dedicated bearer secret", async () => {
    expect((await processReminderRequest(reminderRequest())).status).toBe(401);
    expect((await processReminderRequest(reminderRequest("wrong-secret"))).status).toBe(401);
    const authorized = await processReminderRequest(reminderRequest("integration-reminder-secret"));
    expect(authorized.status).toBe(200);
    expect(await authorized.json()).toEqual({ checked: 0, customerSent: 0, adminSent: 0, failed: 0 });
  });

  it("sends client and admin reminders once for a confirmed appointment inside 24 hours", async () => {
    const now = new Date("2026-08-03T12:00:00.000Z");
    const appointmentId = await seedAppointment(new Date("2026-08-04T11:00:00.000Z"), "confirmed");

    expect(await sendDueAppointmentReminders(now)).toEqual({ checked: 1, customerSent: 1, adminSent: 1, failed: 0 });
    expect(email.sendCustomerAppointmentReminder).toHaveBeenCalledWith(
      "reminder@example.com", "Reminder Customer", "Smart-home consultation", new Date("2026-08-04T11:00:00.000Z"),
    );
    expect(email.sendAdminAppointmentReminder).toHaveBeenCalledWith(
      "owner@whatisthis.place", "Reminder Customer", "reminder@example.com", "Smart-home consultation",
      new Date("2026-08-04T11:00:00.000Z"), "Client detail\n\nAdmin detail",
    );
    const [saved] = await reminderState(appointmentId);
    expect(saved.customer_reminder_sent_at).toBeInstanceOf(Date);
    expect(saved.admin_reminder_sent_at).toBeInstanceOf(Date);

    expect(await sendDueAppointmentReminders(now)).toEqual({ checked: 0, customerSent: 0, adminSent: 0, failed: 0 });
    expect(email.sendCustomerAppointmentReminder).toHaveBeenCalledOnce();
    expect(email.sendAdminAppointmentReminder).toHaveBeenCalledOnce();
  });

  it("ignores past, cancelled, completed, and appointments more than 24 hours away", async () => {
    const now = new Date("2026-08-03T12:00:00.000Z");
    await seedAppointment(new Date("2026-08-03T11:00:00.000Z"), "confirmed", 1);
    await seedAppointment(new Date("2026-08-04T11:00:00.000Z"), "cancelled", 2);
    await seedAppointment(new Date("2026-08-04T11:30:00.000Z"), "completed", 3);
    await seedAppointment(new Date("2026-08-04T12:01:00.000Z"), "confirmed", 4);

    expect(await sendDueAppointmentReminders(now)).toEqual({ checked: 0, customerSent: 0, adminSent: 0, failed: 0 });
    expect(email.sendCustomerAppointmentReminder).not.toHaveBeenCalled();
    expect(email.sendAdminAppointmentReminder).not.toHaveBeenCalled();
  });

  it("retries only the failed recipient on the next worker cycle", async () => {
    const now = new Date("2026-08-03T12:00:00.000Z");
    const appointmentId = await seedAppointment(new Date("2026-08-04T11:00:00.000Z"), "confirmed");
    email.sendCustomerAppointmentReminder.mockRejectedValueOnce(new Error("Customer email unavailable"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await sendDueAppointmentReminders(now)).toEqual({ checked: 1, customerSent: 0, adminSent: 1, failed: 1 });
    let [saved] = await reminderState(appointmentId);
    expect(saved.customer_reminder_sent_at).toBeNull();
    expect(saved.admin_reminder_sent_at).toBeInstanceOf(Date);

    expect(await sendDueAppointmentReminders(now)).toEqual({ checked: 1, customerSent: 1, adminSent: 0, failed: 0 });
    [saved] = await reminderState(appointmentId);
    expect(saved.customer_reminder_sent_at).toBeInstanceOf(Date);
    expect(email.sendCustomerAppointmentReminder).toHaveBeenCalledTimes(2);
    expect(email.sendAdminAppointmentReminder).toHaveBeenCalledOnce();
    errorLog.mockRestore();
  });

  it("prevents two simultaneous workers from sending duplicate reminders", async () => {
    const now = new Date("2026-08-03T12:00:00.000Z");
    await seedAppointment(new Date("2026-08-04T11:00:00.000Z"), "confirmed");

    const results = await Promise.all([sendDueAppointmentReminders(now), sendDueAppointmentReminders(now)]);
    expect(results.reduce((sum, result) => sum + result.customerSent, 0)).toBe(1);
    expect(results.reduce((sum, result) => sum + result.adminSent, 0)).toBe(1);
    expect(email.sendCustomerAppointmentReminder).toHaveBeenCalledOnce();
    expect(email.sendAdminAppointmentReminder).toHaveBeenCalledOnce();
  });
});

async function seedAppointment(startsAt: Date, status: "confirmed" | "cancelled" | "completed", suffix = 0) {
  const [customer] = await testSql<{ id: string }[]>`
    INSERT INTO customers (email, name)
    VALUES (${suffix ? `reminder-${suffix}@example.com` : "reminder@example.com"}, 'Reminder Customer')
    RETURNING id
  `;
  const [slot] = await testSql<{ id: string }[]>`
    INSERT INTO booking_slots (service_id, starts_at, ends_at, state)
    VALUES (${SERVICE_ID}, ${startsAt}, ${new Date(startsAt.getTime() + 60 * 60 * 1000)}, ${status === "confirmed" ? "confirmed" : "released"})
    RETURNING id
  `;
  const [appointment] = await testSql<{ id: string }[]>`
    INSERT INTO appointments (slot_id, customer_id, status, client_notes, notes)
    VALUES (${slot.id}, ${customer.id}, ${status}, 'Client detail', 'Admin detail')
    RETURNING id
  `;
  return appointment.id;
}

function reminderState(id: string) {
  return testSql<{ customer_reminder_sent_at: Date | null; admin_reminder_sent_at: Date | null }[]>`
    SELECT customer_reminder_sent_at, admin_reminder_sent_at FROM appointments WHERE id = ${id}
  `;
}

function reminderRequest(secret?: string) {
  return new Request("http://localhost/api/internal/reminders", {
    method: "POST",
    headers: secret ? { Authorization: `Bearer ${secret}` } : undefined,
  });
}
