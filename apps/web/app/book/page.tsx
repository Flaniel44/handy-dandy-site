import Link from "next/link";

import { BookingForm } from "../../components/booking-form";

export default function BookPage() {
  return (
    <main className="booking-page">
      <header className="booking-header">
        <Link className="booking-brand" href="/">Handy Dandy</Link>
        <Link className="text-link" href="/">Back home</Link>
      </header>
      <section className="booking-intro">
        <p className="eyebrow">Book a consultation</p>
        <h1>Let&apos;s make your home work smarter.</h1>
        <p>Choose a convenient time, tell me a little about your home, and reserve your consultation.</p>
      </section>
      <BookingForm />
    </main>
  );
}
