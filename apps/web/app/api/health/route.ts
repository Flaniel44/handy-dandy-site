import { getDb } from "../../../lib/db";
import { businessSettings } from "../../../lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDb().select({ id: businessSettings.id }).from(businessSettings).limit(1);
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Health check failed", error);
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
