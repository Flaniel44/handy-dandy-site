import { redirect } from "next/navigation";

import { CustomerDashboard } from "../../components/customer-dashboard";
import { getSession } from "../../lib/admin-auth";
import { areNewBookingsEnabled } from "../../lib/booking-status";

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "admin") redirect("/admin");
  return <CustomerDashboard firstName={session.firstName} bookingsEnabled={areNewBookingsEnabled()} />;
}
