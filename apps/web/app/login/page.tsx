import { redirect } from "next/navigation";
import Link from "next/link";

import { LoginForm } from "../../components/account-auth";
import { getSession } from "../../lib/admin-auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const session = await getSession();
  if (session) redirect(session.role === "admin" ? "/admin" : "/account");
  const resetComplete = (await searchParams).reset === "success";
  return <main className="auth-page"><section className="auth-card"><p className="eyebrow">Welcome back</p><h1>Sign in</h1>{resetComplete && <p className="auth-success">Your password has been reset. Sign in with your new password.</p>}<LoginForm /><p>New here? <Link href="/create-account">Create an account</Link></p></section></main>;
}
