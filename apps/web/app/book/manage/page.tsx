import Link from "next/link";

import { GuestAppointmentManager } from "../../../components/guest-appointment-manager";
import { GUEST_MANAGEMENT_TOKEN_PATTERN } from "../../../lib/guest-appointment-management";

export const dynamic = "force-dynamic";

export default async function ManageGuestAppointmentPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  return (
    <main className="booking-page guest-management-page">
      <section className="booking-intro">
        <p className="eyebrow">Your appointment</p>
        <h1>Need to make a change?</h1>
        <p>This private link lets you reschedule or cancel this appointment without creating an account.</p>
      </section>
      {GUEST_MANAGEMENT_TOKEN_PATTERN.test(token)
        ? <GuestAppointmentManager initialToken={token} />
        : <section className="booking-card booking-success"><p className="form-error">This private appointment link is incomplete or invalid.</p><p><Link href="/book">Book a new appointment</Link></p></section>}
    </main>
  );
}
