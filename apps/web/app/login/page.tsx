import { redirect } from "next/navigation";
import Link from "next/link";

import { LoginForm } from "../../components/account-auth";
import { GoogleLoginLink } from "../../components/google-login-link";
import { getSession } from "../../lib/admin-auth";
import { googleLoginConfigured } from "../../lib/google-login";

const oauthErrors: Record<string, string> = {
  admin: "The administrator account must use its password.",
  cancelled: "Google sign-in was cancelled.",
  failed: "Google could not sign you in. Please try again.",
  invalid: "That Google sign-in request expired or was invalid. Please try again.",
  unavailable: "Google sign-in is temporarily unavailable.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string; oauth?: string }> }) {
  const session = await getSession();
  if (session) redirect(session.role === "admin" ? "/admin" : "/account");
  const params = await searchParams;
  const resetComplete = params.reset === "success";
  const oauthError = params.oauth ? oauthErrors[params.oauth] : undefined;
  return <main className="auth-page"><section className="auth-card"><p className="eyebrow">Welcome back</p><h1>Sign in</h1>{resetComplete && <p className="auth-success">Your password has been reset. Sign in with your new password.</p>}{oauthError && <p className="form-error">{oauthError}</p>}{googleLoginConfigured() && <><GoogleLoginLink /><div className="auth-divider"><span>or use your password</span></div></>}<LoginForm /><p>New here? <Link href="/create-account">Create an account</Link></p></section></main>;
}
