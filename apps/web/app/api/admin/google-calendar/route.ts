import { requireAdmin } from "../../../../lib/admin-auth";
import { disconnectGoogleCalendar, getGoogleCalendarStatus } from "../../../../lib/google-calendar";

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
