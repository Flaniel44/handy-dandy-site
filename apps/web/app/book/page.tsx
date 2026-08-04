import { BookingForm } from "../../components/booking-form";
import { areNewBookingsEnabled, isLaunchOfferEnabled } from "../../lib/booking-status";

export const dynamic = "force-dynamic";

export default function BookPage() {
  const bookingsEnabled = areNewBookingsEnabled();
  const launchOfferEnabled = isLaunchOfferEnabled();
  return (
    <main className="booking-page">
      <section className="booking-intro">
        <p className="eyebrow">Book a consultation</p>
        <h1>Let&apos;s make your technology work for you.</h1>
        <p>{launchOfferEnabled ? "For a limited time, every service is free while Digital HandyDan gets started." : "Choose a convenient time, tell me what you need help with, and reserve your consultation."}</p>
      </section>
      <BookingForm bookingsEnabled={bookingsEnabled} launchOfferEnabled={launchOfferEnabled} />
    </main>
  );
}
