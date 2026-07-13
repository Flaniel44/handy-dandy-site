export const BOOKINGS_CLOSED_MESSAGE = "Online booking is not open yet. Please check back soon.";

export function areNewBookingsEnabled() {
  if (process.env.NODE_ENV !== "production") return process.env.BOOKINGS_ENABLED !== "false";
  return process.env.BOOKINGS_ENABLED === "true";
}

export function bookingsClosedResponse() {
  return Response.json(
    { error: BOOKINGS_CLOSED_MESSAGE, code: "BOOKINGS_CLOSED" },
    { status: 503, headers: { "Retry-After": "3600" } },
  );
}
