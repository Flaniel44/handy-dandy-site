import { z } from "zod";

import { getNextAvailableDate } from "../../../../lib/availability";

export const dynamic = "force-dynamic";

const querySchema = z.object({ serviceId: z.uuid() });

export async function GET(request: Request) {
  const parsed = querySchema.safeParse({ serviceId: new URL(request.url).searchParams.get("serviceId") });
  if (!parsed.success) return Response.json({ error: "A valid service is required." }, { status: 400 });

  try {
    const availability = await getNextAvailableDate(parsed.data.serviceId);
    if (!availability) return Response.json({ error: "Service not found." }, { status: 404 });
    return Response.json(availability, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to find the next available date", error);
    return Response.json({ error: "Availability is temporarily unavailable." }, { status: 503 });
  }
}
