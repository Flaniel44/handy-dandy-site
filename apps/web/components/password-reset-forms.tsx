"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function ForgotPasswordForm() {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    const body = await response.json(); setMessage(body.message); setBusy(false);
  }
  return <form className="auth-form" onSubmit={submit}><label>Email<input name="email" type="email" autoComplete="email" required /></label>{message && <p className="auth-success" role="status">{message}</p>}<button disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button></form>;
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirmation")) { setBusy(false); setError("The passwords do not match."); return; }
    const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: form.get("password") }) });
    const body = await response.json(); setBusy(false); if (!response.ok) { setError(body.error); return; }
    router.replace("/login?reset=success");
  }
  return <form className="auth-form" onSubmit={submit}><label>New password<input name="password" type="password" minLength={12} autoComplete="new-password" required /><small>At least 12 characters</small></label><label>Confirm password<input name="confirmation" type="password" minLength={12} autoComplete="new-password" required /></label>{error && <p className="form-error">{error}</p>}<button disabled={busy}>{busy ? "Saving…" : "Save new password"}</button></form>;
}
