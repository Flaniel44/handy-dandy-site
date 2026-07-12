import { getActiveServices } from "../../../lib/availability";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ services: await getActiveServices() });
  } catch (error) {
    console.error("Unable to load services", error);
    return Response.json({ error: "Booking services are temporarily unavailable." }, { status: 503 });
  }
}
