export function hasDatabaseErrorCode(error: unknown, code: string) {
  let current = error;
  while (typeof current === "object" && current !== null) {
    if ("code" in current && current.code === code) return true;
    if (!("cause" in current)) return false;
    current = current.cause;
  }
  return false;
}

const BOOKING_CONFLICT_CODES = ["23P01", "40P01", "40001"] as const;

export function isBookingConflictError(error: unknown) {
  return BOOKING_CONFLICT_CODES.some((code) => hasDatabaseErrorCode(error, code));
}
