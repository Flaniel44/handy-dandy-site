import { redirect } from "next/navigation";
import Link from "next/link";

import { RegistrationForm } from "../../components/account-auth";
import { GoogleLoginLink } from "../../components/google-login-link";
import { getSession } from "../../lib/admin-auth";
import { googleLoginConfigured } from "../../lib/google-login";

export default async function CreateAccountPage() {
  if (await getSession()) redirect("/account");
  return <main className="auth-page"><section className="auth-card auth-card-wide"><p className="eyebrow">Your account</p><h1>Create account</h1>{googleLoginConfigured() && <><GoogleLoginLink /><div className="auth-divider"><span>or create one with a password</span></div></>}<RegistrationForm /><p>Already registered? <Link href="/login">Sign in</Link></p></section></main>;
}
