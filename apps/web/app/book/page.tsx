import Link from "next/link";

export default function BookPage() {
  return (
    <main className="simple-page">
      <p className="eyebrow">Booking</p>
      <h1>Let’s make your home work smarter.</h1>
      <p>
        Online scheduling is the next build slice. Soon you’ll choose a consultation,
        see live availability, and confirm securely with Stripe.
      </p>
      <a className="primary-button" href="mailto:hello@example.com?subject=Consultation request">
        Request a consultation
      </a>
      <Link className="text-link" href="/">Back home</Link>
    </main>
  );
}
