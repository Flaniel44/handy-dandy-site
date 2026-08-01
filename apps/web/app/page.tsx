import { LandingScene } from "../components/landing-scene";
import { isLaunchOfferEnabled } from "../lib/booking-status";

export const dynamic = "force-dynamic";

export default function Home() {
  return <LandingScene launchOfferEnabled={isLaunchOfferEnabled()} />;
}
