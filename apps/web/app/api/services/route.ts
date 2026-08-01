import { getActiveServices } from "../../../lib/availability";
import { isLaunchOfferEnabled } from "../../../lib/booking-status";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const launchOfferEnabled = isLaunchOfferEnabled();
    const services = (await getActiveServices()).map((service) => ({
      ...service,
      priceCents: launchOfferEnabled ? 0 : service.priceCents,
    }));
    return Response.json({ services, launchOfferEnabled });
  } catch (error) {
    console.error("Unable to load services", error);
    return Response.json({ error: "Booking services are temporarily unavailable." }, { status: 503 });
  }
}
