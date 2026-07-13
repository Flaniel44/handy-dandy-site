export type LifecycleAppointmentStatus = "pending_payment" | "confirmed" | "cancelled" | "completed" | "no_show";
export type LifecycleSlotState = "held" | "confirmed" | "released" | "expired";

export type CustomerManageableAppointment = Readonly<{
  status: LifecycleAppointmentStatus;
  slotState: LifecycleSlotState;
  startsAt: string | Date;
}>;

export function canCustomerManageAppointment(appointment: CustomerManageableAppointment, now: string | Date = new Date()) {
  const startsAt = toTime(appointment.startsAt); const currentTime = toTime(now);
  return appointment.status === "confirmed" && appointment.slotState === "confirmed"
    && startsAt !== null && currentTime !== null && startsAt > currentTime;
}

export function slotStateForAppointmentStatus(status: LifecycleAppointmentStatus): LifecycleSlotState {
  return status === "confirmed" ? "confirmed" : "released";
}

export function shouldSendCancellation(previousStatus: LifecycleAppointmentStatus, nextStatus: LifecycleAppointmentStatus) {
  return previousStatus !== "cancelled" && nextStatus === "cancelled";
}

function toTime(value: string | Date) {
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}
