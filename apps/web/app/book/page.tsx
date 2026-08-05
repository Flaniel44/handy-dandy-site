import type { Metadata } from "next";

import { BookingForm } from "../../components/booking-form";
import { areNewBookingsEnabled, isLaunchOfferEnabled } from "../../lib/booking-status";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Book a smart-home or technology consultation",
  description: "Book a Digital HandyDan consultation for smart-home planning, home automation, Wi-Fi help, device setup, or general technology support in Ottawa.",
  alternates: { canonical: "/book" },
  openGraph: {
    title: "Book an appointment with Digital HandyDan",
    description: "Choose a service and reserve a convenient consultation time.",
    url: "/book",
  },
};

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
