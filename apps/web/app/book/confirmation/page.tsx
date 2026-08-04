import Link from "next/link";

const RESULTS = {
  requested: {
    eyebrow: "Request received",
    heading: "Your appointment is awaiting approval.",
    message: "Your requested time is being held. Digital Handyman will review it and email you when it is approved or declined.",
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
    message: "Please try the link again. If the problem continues, contact Digital Handyman for help.",
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
        <p><Link href={status === "requested" ? "/" : "/book"}>{status === "requested" ? "Return home" : "Return to booking"}</Link></p>
      </section>
    </main>
  );
}
