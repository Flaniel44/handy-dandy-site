import { z } from "zod";

import { getAvailabilityForDate } from "../../../lib/availability";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  date: z.iso.date(),
  serviceId: z.uuid(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ date: url.searchParams.get("date"), serviceId: url.searchParams.get("serviceId") });
  if (!parsed.success) return Response.json({ error: "A valid date and service are required." }, { status: 400 });

  try {
    const availability = await getAvailabilityForDate(parsed.data.date, parsed.data.serviceId);
    if (!availability) return Response.json({ error: "Service not found." }, { status: 404 });
    return Response.json({
      date: parsed.data.date,
      timezone: availability.settings.timezone,
      service: {
        id: availability.service.id,
        name: availability.service.name,
        durationMinutes: availability.service.durationMinutes,
      },
      slots: availability.slots,
    });
  } catch (error) {
    console.error("Unable to calculate availability", error);
    return Response.json({ error: "Availability is temporarily unavailable." }, { status: 503 });
  }
}
