"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Appointment = {
  id: string;
  status: string;
  serviceId: string;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  clientNotes: string;
  customerName: string;
  customerEmail: string;
  appointmentMode: string;
  appointmentPhone: string | null;
  appointmentStreetAddress: string | null;
  appointmentUnit: string | null;
  appointmentCity: string | null;
  appointmentPostalCode: string | null;
  appointmentCountry: string | null;
  canManage: boolean;
};
type Slot = { startsAt: string; endsAt: string; label: string };

export function GuestAppointmentManager({ initialToken }: { initialToken: string }) {
  const [token, setToken] = useState(initialToken);
  const [appointment, setAppointment] = useState<Appointment>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [rescheduling, setRescheduling] = useState(false);
  const [currentWeek] = useState(startOfWeek);
  const [week, setWeek] = useState(startOfWeek);
  const [availability, setAvailability] = useState<Record<string, Slot[]>>({});
  const [timezone, setTimezone] = useState("");
  const [selected, setSelected] = useState<{ date: string; slot: Slot }>();
  const dates = Array.from({ length: 7 }, (_, index) => addDays(week, index));

  useEffect(() => {
    const controller = new AbortController();
    fetchManagedAppointment(token, controller.signal).then(setAppointment)
      .catch((reason) => { if (reason.name !== "AbortError") setError(reason.message ?? "This appointment could not be loaded."); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    if (!rescheduling || !appointment) return;
    const controller = new AbortController();
    const weekDates = Array.from({ length: 7 }, (_, index) => addDays(week, index));
    Promise.all(weekDates.map(async (date) => {
      const dateText = formatDateInput(date);
      const response = await fetch(`/api/availability?date=${dateText}&serviceId=${appointment.serviceId}`, { signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Availability is temporarily unavailable.");
      return { dateText, slots: body.slots ?? [], timezone: body.timezone as string };
    })).then((entries) => {
      setAvailability(Object.fromEntries(entries.map((entry) => [entry.dateText, entry.slots])));
      setTimezone(entries[0]?.timezone ?? "");
    }).catch((reason) => {
      if (reason.name !== "AbortError") setError(reason.message ?? "Availability is temporarily unavailable.");
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [appointment, rescheduling, week]);

  function changeWeek(amount: number) {
    setWeek((value) => addDays(value, amount * 7)); setSelected(undefined); setMessage(""); setError(""); setLoading(true);
  }

  function toggleRescheduling() {
    const opening = !rescheduling;
    setRescheduling(opening); setSelected(undefined); setError("");
    if (opening) setLoading(true);
  }

  async function reschedule() {
    if (!selected) return;
    setLoading(true); setError(""); setMessage("");
    const response = await fetch("/api/bookings/manage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-Appointment-Token": token },
      body: JSON.stringify({ date: selected.date, startsAt: selected.slot.startsAt }),
    });
    const body = await response.json();
    if (!response.ok) { setLoading(false); return setError(body.error ?? "The appointment could not be rescheduled."); }
    const nextToken = body.token as string;
    setToken(nextToken);
    window.history.replaceState(null, "", `/book/manage?token=${encodeURIComponent(nextToken)}`);
    setSelected(undefined); setRescheduling(false); setMessage("Your appointment was rescheduled. A confirmation email is on its way.");
  }

  async function cancel() {
    if (!window.confirm("Cancel this appointment? The time will be released for someone else to book.")) return;
    setLoading(true); setError(""); setMessage("");
    const response = await fetch("/api/bookings/manage", { method: "DELETE", headers: { "X-Appointment-Token": token } });
    const body = await response.json();
    setLoading(false);
    if (!response.ok) return setError(body.error ?? "The appointment could not be cancelled.");
    setAppointment((current) => current ? { ...current, status: "cancelled", canManage: false } : current);
    setRescheduling(false); setMessage("Your appointment was cancelled. A confirmation email is on its way.");
  }

  if (loading && !appointment) return <section className="booking-card"><p>Loading your appointment…</p></section>;
  if (error && !appointment) return <section className="booking-card booking-success"><p className="form-error">{error}</p><p><Link href="/book">Book a new appointment</Link></p></section>;
  if (!appointment) return null;
  const cancelled = appointment.status === "cancelled";
  const appointmentAddress = [[appointment.appointmentStreetAddress, appointment.appointmentUnit && `Unit ${appointment.appointmentUnit}`].filter(Boolean).join(", "), [appointment.appointmentCity, appointment.appointmentPostalCode].filter(Boolean).join(" "), appointment.appointmentCountry].filter(Boolean).join(", ");

  return <section className="booking-card guest-appointment-card">
    {message && <p className="auth-success" role="status">{message}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="guest-appointment-summary">
      <div><span>Service</span><strong>{appointment.serviceName}</strong></div>
      <div><span>Date and time</span><strong>{formatAppointment(appointment.startsAt, appointment.endsAt)}</strong></div>
      <div><span>Booked for</span><strong>{appointment.customerName} · {appointment.customerEmail}</strong></div>
      <div><span>Appointment format</span><strong>{appointment.appointmentMode === "in_person" ? `In person · ${appointmentAddress}` : `By phone · ${appointment.appointmentPhone ?? "Phone not provided"}`}</strong></div>
      {appointment.clientNotes && <div><span>Your notes</span><strong>{appointment.clientNotes}</strong></div>}
      <div><span>Status</span><strong className="guest-appointment-status">{appointment.status === "pending_approval" ? "Awaiting approval" : appointment.status.replace("_", " ")}</strong></div>
    </div>

    {cancelled ? <div className="guest-management-finished"><p>This appointment has been cancelled and its time is available again.</p><Link className="booking-submit" href="/book">Choose another appointment time</Link></div> : appointment.canManage ? <>
      <div className="appointment-change-actions guest-management-actions">
        <button type="button" onClick={toggleRescheduling}>{rescheduling ? "Close rescheduling" : "Reschedule appointment"}</button>
        <button type="button" className="danger-button" disabled={loading} onClick={cancel}>Cancel appointment</button>
      </div>
      {rescheduling && <div className="reschedule-panel guest-reschedule-panel">
        <p className="service-summary">Choose a new time. Times use {timezone || "the business timezone"}.</p>
        <div className="week-controls"><button type="button" disabled={week.getTime() <= currentWeek.getTime()} onClick={() => changeWeek(-1)} aria-label="Previous week">←</button><strong>{dates[0].toLocaleDateString([], { month: "short", day: "numeric" })} – {dates[6].toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</strong><button type="button" onClick={() => changeWeek(1)} aria-label="Next week">→</button></div>
        <div className="weekly-availability" aria-busy={loading}>{dates.map((date) => { const dateText = formatDateInput(date); const slots = availability[dateText] ?? []; return <section key={dateText}><header><strong>{date.toLocaleDateString([], { weekday: "short" })}</strong><span>{date.toLocaleDateString([], { month: "short", day: "numeric" })}</span></header><div>{slots.length ? slots.map((slot) => <button type="button" className={selected?.slot.startsAt === slot.startsAt ? "is-selected" : ""} key={slot.startsAt} onClick={() => setSelected({ date: dateText, slot })}>{slot.label}</button>) : <small>No times</small>}</div></section>; })}</div>
        {selected && <button type="button" className="reschedule-confirm" disabled={loading} onClick={reschedule}>{loading ? "Rescheduling…" : `Move to ${selected.slot.label}`}</button>}
      </div>}
    </> : <div className="guest-management-finished"><p>This appointment is too close to its start time to change online. Please reply to your confirmation email if you need help.</p></div>}
  </section>;
}

function startOfWeek() { const value = new Date(); value.setHours(0, 0, 0, 0); value.setDate(value.getDate() - ((value.getDay() + 6) % 7)); return value; }
function addDays(date: Date, amount: number) { const value = new Date(date); value.setDate(value.getDate() + amount); return value; }
function formatDateInput(date: Date) { return date.toLocaleDateString("en-CA"); }
function formatAppointment(startsAt: string, endsAt: string) {
  const start = new Date(startsAt); const end = new Date(endsAt);
  return `${start.toLocaleDateString([], { dateStyle: "full" })} · ${start.toLocaleTimeString([], { timeStyle: "short" })}–${end.toLocaleTimeString([], { timeStyle: "short" })}`;
}

async function fetchManagedAppointment(token: string, signal?: AbortSignal) {
  const response = await fetch("/api/bookings/manage", { headers: { "X-Appointment-Token": token }, cache: "no-store", signal });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "This appointment could not be loaded.");
  return body.appointment as Appointment;
}
