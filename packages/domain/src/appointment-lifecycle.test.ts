import { describe, expect, it } from "vitest";

import { canCustomerManageAppointment, shouldSendCancellation, slotStateForAppointmentStatus } from "./appointment-lifecycle";

describe("appointment lifecycle", () => {
  const now = "2026-07-13T12:00:00Z";

  it("allows customers to manage only future confirmed appointments with confirmed slots", () => {
    expect(canCustomerManageAppointment({ status: "confirmed", slotState: "confirmed", startsAt: "2026-07-13T13:00:00Z" }, now)).toBe(true);
    expect(canCustomerManageAppointment({ status: "completed", slotState: "released", startsAt: "2026-07-13T13:00:00Z" }, now)).toBe(false);
    expect(canCustomerManageAppointment({ status: "cancelled", slotState: "released", startsAt: "2026-07-13T13:00:00Z" }, now)).toBe(false);
    expect(canCustomerManageAppointment({ status: "no_show", slotState: "released", startsAt: "2026-07-13T13:00:00Z" }, now)).toBe(false);
    expect(canCustomerManageAppointment({ status: "pending_payment", slotState: "held", startsAt: "2026-07-13T13:00:00Z" }, now)).toBe(false);
    expect(canCustomerManageAppointment({ status: "confirmed", slotState: "released", startsAt: "2026-07-13T13:00:00Z" }, now)).toBe(false);
  });

  it("rejects appointments that have started, passed, or contain invalid dates", () => {
    expect(canCustomerManageAppointment({ status: "confirmed", slotState: "confirmed", startsAt: now }, now)).toBe(false);
    expect(canCustomerManageAppointment({ status: "confirmed", slotState: "confirmed", startsAt: "2026-07-13T11:59:59Z" }, now)).toBe(false);
    expect(canCustomerManageAppointment({ status: "confirmed", slotState: "confirmed", startsAt: "invalid" }, now)).toBe(false);
    expect(canCustomerManageAppointment({ status: "confirmed", slotState: "confirmed", startsAt: "2026-07-13T13:00:00Z" }, "invalid")).toBe(false);
  });

  it("keeps only confirmed appointments reserved", () => {
    expect(slotStateForAppointmentStatus("confirmed")).toBe("confirmed");
    expect(slotStateForAppointmentStatus("pending_payment")).toBe("released");
    expect(slotStateForAppointmentStatus("cancelled")).toBe("released");
    expect(slotStateForAppointmentStatus("completed")).toBe("released");
    expect(slotStateForAppointmentStatus("no_show")).toBe("released");
  });

  it("fires cancellation side effects only on the first transition to cancelled", () => {
    expect(shouldSendCancellation("confirmed", "cancelled")).toBe(true);
    expect(shouldSendCancellation("pending_payment", "cancelled")).toBe(true);
    expect(shouldSendCancellation("cancelled", "cancelled")).toBe(false);
    expect(shouldSendCancellation("confirmed", "completed")).toBe(false);
  });
});
