import { calculateAvailability } from "@handy-dani/domain";
import { and, eq, gt, lt, or } from "drizzle-orm";
import { DateTime } from "luxon";

import { getDb } from "./db";
import { bookingSlots, businessSettings, manualBlocks, services, weeklyHours } from "./db/schema";
import { getGoogleBusyRanges } from "./google-calendar";

export async function getActiveServices() {
  return getDb().select({
    id: services.id,
    name: services.name,
    description: services.description,
    durationMinutes: services.durationMinutes,
    priceCents: services.priceCents,
  }).from(services).where(eq(services.active, true)).orderBy(services.name);
}

export async function getAvailabilityForDate(date: string, serviceId: string) {
  const db = getDb();
  const [service] = await db.select().from(services).where(and(eq(services.id, serviceId), eq(services.active, true))).limit(1);
  if (!service) return null;

  const [settings] = await db.select().from(businessSettings).where(eq(businessSettings.id, service.businessId)).limit(1);
  if (!settings) return null;

  const localDay = DateTime.fromISO(date, { zone: settings.timezone });
  if (!localDay.isValid || localDay.toISODate() !== date) return null;
  const today = DateTime.now().setZone(settings.timezone).startOf("day");
  if (localDay < today || localDay > today.plus({ days: settings.bookingWindowDays })) {
    return { service, settings, slots: [] };
  }
  const dayStart = localDay.startOf("day").toUTC();
  const dayEnd = localDay.plus({ days: 1 }).startOf("day").toUTC();
  const now = new Date();

  const [hours, blocks, reserved, googleBusy] = await Promise.all([
    db.select().from(weeklyHours).where(eq(weeklyHours.businessId, settings.id)),
    db.select({ startsAt: manualBlocks.startsAt, endsAt: manualBlocks.endsAt }).from(manualBlocks).where(and(
      eq(manualBlocks.businessId, settings.id),
      lt(manualBlocks.startsAt, dayEnd.toJSDate()),
      gt(manualBlocks.endsAt, dayStart.toJSDate()),
    )),
    db.select({ startsAt: bookingSlots.startsAt, endsAt: bookingSlots.endsAt }).from(bookingSlots).where(and(
      lt(bookingSlots.startsAt, dayEnd.toJSDate()),
      gt(bookingSlots.endsAt, dayStart.toJSDate()),
      or(
        eq(bookingSlots.state, "confirmed"),
        and(eq(bookingSlots.state, "held"), gt(bookingSlots.expiresAt, now)),
      ),
    )),
    getGoogleBusyRanges(dayStart.toJSDate(), dayEnd.toJSDate()),
  ]);

  const slots = calculateAvailability({
    date,
    timezone: settings.timezone,
    durationMinutes: service.durationMinutes,
    intervalMinutes: settings.slotIntervalMinutes,
    minimumNoticeMinutes: settings.minimumNoticeMinutes,
    weeklyHours: hours.map((hoursRow) => ({
      weekday: hoursRow.weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      startsAtLocal: hoursRow.startsAtLocal,
      endsAtLocal: hoursRow.endsAtLocal,
    })),
    busyRanges: [...blocks, ...reserved, ...googleBusy].map((range) => ({
      startsAt: range.startsAt.toISOString(),
      endsAt: range.endsAt.toISOString(),
    })),
  });

  return { service, settings, slots };
}
