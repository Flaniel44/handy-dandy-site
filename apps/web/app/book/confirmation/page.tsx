import Link from "next/link";

const RESULTS = {
  confirmed: {
    eyebrow: "Booking confirmed",
    heading: "Your appointment is booked.",
    message: "Your appointment has been added to the calendar. A confirmation email is on its way.",
  },
  expired: {
    eyebrow: "Hold expired",
    heading: "That time was not confirmed.",
    message: "The 15-minute hold has expired. Please choose a new available time.",
  },
  invalid: {
    eyebrow: "Invalid link",
    heading: "This confirmation link cannot be used.",
    message: "It may have already been used or the link may be incomplete.",
  },
  failed: {
    eyebrow: "Something went wrong",
    heading: "The appointment could not be confirmed.",
    message: "Please try the link again. If the problem continues, contact Handy Dandy for help.",
  },
} as const;

export default async function BookingConfirmationPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const status = (await searchParams).status;
  const result = status && status in RESULTS
    ? RESULTS[status as keyof typeof RESULTS]
    : RESULTS.invalid;
  return (
    <main className="booking-page">
      <section className="booking-card booking-success">
        <p className="eyebrow">{result.eyebrow}</p>
        <h1>{result.heading}</h1>
        <p>{result.message}</p>
        <p><Link href={status === "confirmed" ? "/" : "/book"}>{status === "confirmed" ? "Return home" : "Return to booking"}</Link></p>
      </section>
    </main>
  );
}
