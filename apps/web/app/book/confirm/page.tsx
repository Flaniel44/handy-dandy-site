import Link from "next/link";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export default async function ConfirmBookingPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const validToken = TOKEN_PATTERN.test(token);
  return (
    <main className="booking-page">
      <section className="booking-card booking-success">
        <p className="eyebrow">One final step</p>
        <h1>Confirm your appointment</h1>
        {validToken ? <>
          <p>Press the button below to confirm the time held for you. Opening this page alone does not add anything to the calendar.</p>
          <form action="/api/bookings/confirm" method="post">
            <input type="hidden" name="token" value={token} />
            <button className="booking-submit" type="submit">Confirm appointment</button>
          </form>
        </> : <>
          <p className="form-error">This confirmation link is incomplete or invalid.</p>
          <p><Link href="/book">Return to booking</Link></p>
        </>}
      </section>
    </main>
  );
}
