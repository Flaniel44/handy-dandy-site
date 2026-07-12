"use client";

import { FormEvent, useEffect, useState } from "react";

type Service = { id: string; name: string; description: string; durationMinutes: number; priceCents: number };
type Slot = { startsAt: string; endsAt: string; label: string };

export function BookingForm() {
  const [services, setServices] = useState<Service[]>([]); const [serviceId, setServiceId] = useState("");
  const [currentWeek] = useState(startOfWeek); const [week, setWeek] = useState(startOfWeek);
  const [availability, setAvailability] = useState<Record<string, Slot[]>>({});
  const [selected, setSelected] = useState<{ date: string; slot: Slot }>();
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [confirmation, setConfirmation] = useState<{ appointmentId: string }>();
  const dates = Array.from({ length: 7 }, (_, index) => addDays(week, index));

  useEffect(() => {
    fetch("/api/services").then(async (response) => {
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setServices(body.services); setServiceId(body.services[0]?.id ?? "");
    }).catch((reason) => { setError(reason.message ?? "Services are unavailable."); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!serviceId) return;
    const controller = new AbortController();
    Promise.all(Array.from({ length: 7 }, async (_, index) => {
      const dateText = formatDateInput(addDays(week, index));
      const response = await fetch(`/api/availability?date=${dateText}&serviceId=${serviceId}`, { signal: controller.signal });
      const body = await response.json(); return [dateText, body.slots ?? []] as const;
    })).then((entries) => setAvailability(Object.fromEntries(entries))).catch((reason) => {
      if (reason.name !== "AbortError") setError("Availability is temporarily unavailable.");
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [serviceId, week]);

  function changeWeek(amount: number) { setWeek((value) => addDays(value, amount * 7)); setSelected(undefined); setLoading(true); setError(""); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return; setLoading(true); setError(""); const form = new FormData(event.currentTarget);
    const response = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      serviceId, date: selected.date, startsAt: selected.slot.startsAt,
      name: form.get("name"), email: form.get("email"), notes: form.get("notes"),
    }) });
    const body = await response.json(); setLoading(false);
    if (!response.ok) return setError(body.error ?? "We could not create the appointment.");
    setConfirmation(body);
  }

  if (confirmation) return <section className="booking-card booking-success"><p className="eyebrow">Booking confirmed</p><h2>Your consultation is booked.</h2><p>No payment is required online. Your appointment reference is <strong>{confirmation.appointmentId}</strong>.</p></section>;
  const service = services.find((item) => item.id === serviceId);
  return <form className="booking-card" onSubmit={submit}>
    <div className="booking-step"><span>01</span><div><h2>Consultation</h2><p>Select the service you need.</p></div></div>
    <label>Service<select value={serviceId} onChange={(event) => { setServiceId(event.target.value); setSelected(undefined); setLoading(true); }}>{services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    {service && <p className="service-summary">{service.description} · {service.durationMinutes} minutes · ${(service.priceCents / 100).toFixed(2)}</p>}

    <div className="booking-step"><span>02</span><div><h2>Choose a time</h2><p>Browse one week at a time. Times use the business timezone.</p></div></div>
    <div className="week-controls"><button type="button" disabled={week.getTime() <= currentWeek.getTime()} onClick={() => changeWeek(-1)} aria-label="Previous week">←</button><strong>{dates[0].toLocaleDateString([], { month: "short", day: "numeric" })} – {dates[6].toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</strong><button type="button" onClick={() => changeWeek(1)} aria-label="Next week">→</button></div>
    <div className="weekly-availability" aria-busy={loading}>{dates.map((date) => { const dateText = formatDateInput(date); const slots = availability[dateText] ?? []; return <section key={dateText}><header><strong>{date.toLocaleDateString([], { weekday: "short" })}</strong><span>{date.toLocaleDateString([], { month: "short", day: "numeric" })}</span></header><div>{slots.length ? slots.map((slot) => <button type="button" className={selected?.slot.startsAt === slot.startsAt ? "is-selected" : ""} key={slot.startsAt} onClick={() => setSelected({ date: dateText, slot })}>{slot.label}</button>) : <small>No times</small>}</div></section>; })}</div>

    <div className="booking-step"><span>03</span><div><h2>Your details</h2><p>No account is required.</p></div></div>
    <div className="field-grid"><label>Name<input name="name" autoComplete="name" minLength={2} required /></label><label>Email<input name="email" type="email" autoComplete="email" required /></label></div>
    <label>Notes<textarea name="notes" rows={5} maxLength={2000} placeholder="What would you like help with?" /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="booking-submit" type="submit" disabled={!selected || loading}>{loading ? "Loading availability…" : selected ? `Book ${selected.slot.label}` : "Choose a time"}</button>
  </form>;
}

function startOfWeek() { const value = new Date(); value.setHours(0, 0, 0, 0); value.setDate(value.getDate() - ((value.getDay() + 6) % 7)); return value; }
function addDays(date: Date, amount: number) { const value = new Date(date); value.setDate(value.getDate() + amount); return value; }
function formatDateInput(date: Date) { return date.toLocaleDateString("en-CA"); }
