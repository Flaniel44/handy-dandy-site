import { redirect } from "next/navigation";
import Link from "next/link";

import { RegistrationForm } from "../../components/account-auth";
import { getSession } from "../../lib/admin-auth";

export default async function CreateAccountPage() {
  if (await getSession()) redirect("/account");
  return <main className="auth-page"><section className="auth-card auth-card-wide"><Link className="booking-brand" href="/">Handy Dandy</Link><p className="eyebrow">Your account</p><h1>Create account</h1><RegistrationForm /><p>Already registered? <Link href="/login">Sign in</Link></p></section></main>;
}
