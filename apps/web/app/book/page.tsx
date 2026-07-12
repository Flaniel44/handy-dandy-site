import { BookingForm } from "../../components/booking-form";

export default function BookPage() {
  return (
    <main className="booking-page">
      <section className="booking-intro">
        <p className="eyebrow">Book a consultation</p>
        <h1>Let&apos;s make your technology work for you.</h1>
        <p>Choose a convenient time, tell me what you need help with, and reserve your consultation.</p>
      </section>
      <BookingForm />
    </main>
  );
}
