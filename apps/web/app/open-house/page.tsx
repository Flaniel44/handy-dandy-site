import type { Metadata } from "next";

import { LandingScene } from "../../components/landing-scene";
import { isLaunchOfferEnabled } from "../../lib/booking-status";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Open house demo",
  description: "Interactive Digital HandyDan open house demonstration.",
  robots: { index: false, follow: false, noarchive: true },
};

export default function OpenHousePage() {
  return <LandingScene launchOfferEnabled={isLaunchOfferEnabled()} openHouseBridgeEnabled />;
}
