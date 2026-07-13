import { requireAdmin } from "../../../../lib/admin-auth";
import { disconnectGoogleCalendar, getGoogleCalendarStatus, reconcileGoogleCalendar, setGoogleEventAvailability } from "../../../../lib/google-calendar";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await getGoogleCalendarStatus(), { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE() {
  if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await disconnectGoogleCalendar();
  return Response.json({ ok: true });
}

export async function POST() {
  if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try { return Response.json(await reconcileGoogleCalendar()); }
  catch (error) {
    console.error("Unable to reconcile Google Calendar", error);
    return Response.json({ error: error instanceof Error ? error.message : "Calendar sync failed." }, { status: 503 });
  }
}

const overrideSchema = z.object({ eventId: z.string().min(1).max(1024), mode: z.enum(["available", "unavailable"]) });

export async function PUT(request: Request) {
  if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = overrideSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid Calendar event override." }, { status: 400 });
  try { await setGoogleEventAvailability(parsed.data.eventId, parsed.data.mode); return Response.json({ ok: true }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not update Calendar availability." }, { status: 503 }); }
}
