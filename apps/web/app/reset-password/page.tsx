import Link from "next/link";
import { ResetPasswordForm } from "../../components/password-reset-forms";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  return <main className="auth-page"><section className="auth-card"><p className="eyebrow">Account recovery</p><h1>Choose a password</h1>{token ? <ResetPasswordForm token={token} /> : <><p className="form-error">This reset link is incomplete.</p><p><Link href="/forgot-password">Request another link</Link></p></>}</section></main>;
}
