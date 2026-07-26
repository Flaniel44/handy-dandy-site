import { createHash, randomBytes } from "node:crypto";
import { and, eq, lt, lte } from "drizzle-orm";

import { getDb } from "./db";
import { bookingSlots, guestBookingConfirmations } from "./db/schema";

export const GUEST_BOOKING_HOLD_MINUTES = 15;
const STALE_CONFIRMATION_RETENTION_HOURS = 24;

export function createGuestBookingConfirmationToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashGuestBookingConfirmationToken(token) };
}

export function hashGuestBookingConfirmationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function releaseExpiredGuestBookingHolds(now = new Date()) {
  const staleBefore = new Date(now.getTime() - STALE_CONFIRMATION_RETENTION_HOURS * 60 * 60 * 1000);
  await getDb().transaction(async (tx) => {
    await tx.update(bookingSlots).set({
      state: "expired",
      updatedAt: now,
    }).where(and(
      eq(bookingSlots.state, "held"),
      lte(bookingSlots.expiresAt, now),
    ));
    await tx.delete(guestBookingConfirmations).where(lt(guestBookingConfirmations.expiresAt, staleBefore));
  });
}
