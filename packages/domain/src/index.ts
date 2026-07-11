export type AppointmentStatus =
  | "held"
  | "pending_payment"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

export type TimeRange = Readonly<{
  startsAt: string;
  endsAt: string;
}>;

export type WeeklyHours = Readonly<{
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startsAtLocal: string;
  endsAtLocal: string;
}>;

export type Appointment = TimeRange &
  Readonly<{
    id: string;
    customerId: string;
    serviceId: string;
    status: AppointmentStatus;
    googleEventId?: string;
    stripeCheckoutSessionId?: string;
  }>;

export function isActiveAppointment(status: AppointmentStatus): boolean {
  return status === "held" || status === "pending_payment" || status === "confirmed";
}

export function rangesOverlap(left: TimeRange, right: TimeRange): boolean {
  return left.startsAt < right.endsAt && right.startsAt < left.endsAt;
}
