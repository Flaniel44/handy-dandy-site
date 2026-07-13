import Link from "next/link";
import { ForgotPasswordForm } from "../../components/password-reset-forms";

export default function ForgotPasswordPage() {
  return <main className="auth-page"><section className="auth-card"><p className="eyebrow">Account recovery</p><h1>Reset password</h1><p className="auth-intro">Enter your account email and we&apos;ll send you a secure reset link.</p><ForgotPasswordForm /><p><Link href="/login">Back to sign in</Link></p></section></main>;
}
