"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    const body = await response.json(); setBusy(false); if (!response.ok) return setError(body.error);
    router.replace(body.destination); router.refresh();
  }
  return <form className="auth-form" onSubmit={submit}><label>Email<input name="email" type="email" autoComplete="username" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label>{error && <p className="form-error">{error}</p>}<button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button></form>;
}

export function RegistrationForm() {
  const router = useRouter(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [country, setCountry] = useState("");
  const beginAddress = () => { if (!country) setCountry("Canada"); };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    const body = await response.json(); setBusy(false); if (!response.ok) return setError(body.error);
    router.replace("/account"); router.refresh();
  }
  return <form className="auth-form auth-grid" onSubmit={submit}><label>First name<input name="firstName" autoComplete="given-name" required /></label><label>Last name<input name="lastName" autoComplete="family-name" required /></label><label className="wide">Email<input name="email" type="email" autoComplete="email" required /></label><label className="wide">Password<input name="password" type="password" minLength={12} autoComplete="new-password" required /><small>At least 12 characters</small></label><label className="wide">Phone <em>optional</em><input name="phone" type="tel" inputMode="numeric" pattern="[0-9]*" autoComplete="tel" onInput={(event) => { event.currentTarget.value = event.currentTarget.value.replace(/\D/g, ""); }} /></label><label className="wide">Street number and street <em>optional</em><input name="streetAddress" autoComplete="street-address" onFocus={beginAddress} /></label><label>Unit <em>optional</em><input name="unit" autoComplete="address-line2" onFocus={beginAddress} /></label><label>City <em>optional</em><input name="city" autoComplete="address-level2" onFocus={beginAddress} /></label><label>Postal code <em>optional</em><input name="postalCode" autoComplete="postal-code" onFocus={beginAddress} /></label><label>Country <em>optional</em><input name="country" autoComplete="country-name" value={country} onFocus={beginAddress} onChange={(event) => setCountry(event.target.value)} /></label>{error && <p className="form-error wide">{error}</p>}<button className="wide" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button></form>;
}
