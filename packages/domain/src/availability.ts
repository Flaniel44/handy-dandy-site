import { DateTime } from "luxon";

export type AvailabilityRange = Readonly<{ startsAt: string; endsAt: string }>;

export type AvailabilityHours = Readonly<{
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startsAtLocal: string;
  endsAtLocal: string;
}>;

export type AvailabilitySlot = AvailabilityRange & Readonly<{
  localDate: string;
  localTime: string;
  label: string;
}>;

export type AvailabilityInput = Readonly<{
  date: string;
  timezone: string;
  durationMinutes: number;
  intervalMinutes: number;
  minimumNoticeMinutes?: number;
  now?: string;
  weeklyHours: readonly AvailabilityHours[];
  busyRanges: readonly AvailabilityRange[];
}>;

export function calculateAvailability(input: AvailabilityInput): AvailabilitySlot[] {
  if (input.durationMinutes <= 0 || input.intervalMinutes <= 0) return [];

  const day = DateTime.fromISO(input.date, { zone: input.timezone }).startOf("day");
  if (!day.isValid || day.toISODate() !== input.date) return [];

  const weekday = (day.weekday % 7) as AvailabilityHours["weekday"];
  const workingRanges = input.weeklyHours.filter((hours) => hours.weekday === weekday);
  const now = DateTime.fromISO(input.now ?? DateTime.utc().toISO(), { setZone: true });
  const earliestStart = now.plus({ minutes: input.minimumNoticeMinutes ?? 0 }).toUTC();
  const busy = input.busyRanges
    .map((range) => ({
      start: DateTime.fromISO(range.startsAt, { setZone: true }).toUTC(),
      end: DateTime.fromISO(range.endsAt, { setZone: true }).toUTC(),
    }))
    .filter((range) => range.start.isValid && range.end.isValid);

  const slots: AvailabilitySlot[] = [];
  for (const hours of workingRanges) {
    const windowStart = localDateTime(input.date, hours.startsAtLocal, input.timezone);
    const windowEnd = localDateTime(input.date, hours.endsAtLocal, input.timezone);
    if (!windowStart || !windowEnd || windowEnd <= windowStart) continue;

    for (
      let candidate = windowStart;
      candidate.plus({ minutes: input.durationMinutes }) <= windowEnd;
      candidate = candidate.plus({ minutes: input.intervalMinutes })
    ) {
      const candidateEnd = candidate.plus({ minutes: input.durationMinutes });
      const startUtc = candidate.toUTC();
      const endUtc = candidateEnd.toUTC();
      if (startUtc < earliestStart) continue;
      if (busy.some((range) => startUtc < range.end && range.start < endUtc)) continue;

      slots.push({
        startsAt: startUtc.toISO()!,
        endsAt: endUtc.toISO()!,
        localDate: candidate.toISODate()!,
        localTime: candidate.toFormat("HH:mm"),
        label: candidate.toLocaleString(DateTime.TIME_SIMPLE),
      });
    }
  }

  return slots.sort((left, right) => left.startsAt.localeCompare(right.startsAt));
}

function localDateTime(date: string, time: string, timezone: string) {
  const normalizedTime = time.slice(0, 5);
  const value = DateTime.fromISO(`${date}T${normalizedTime}`, { zone: timezone });
  if (!value.isValid || value.toFormat("yyyy-MM-dd'T'HH:mm") !== `${date}T${normalizedTime}`) return null;
  return value;
}
