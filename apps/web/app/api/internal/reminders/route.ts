import { timingSafeEqual } from "node:crypto";

import { sendDueAppointmentReminders } from "../../../../lib/reminders";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return Response.json(await sendDueAppointmentReminders());
  } catch (error) {
    console.error("Unable to process appointment reminders", error);
    return Response.json({ error: "Appointment reminders could not be processed." }, { status: 503 });
  }
}

function isAuthorized(request: Request) {
  const expected = process.env.REMINDER_CRON_SECRET;
  const received = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}
