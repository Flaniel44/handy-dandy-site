"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Appointment = { id: string; status: string; adminNotes: string; clientNotes: string; startsAt: string; endsAt: string; serviceName: string };
type Service = { id: string; name: string; durationMinutes: number };
type Slot = { startsAt: string; endsAt: string; label: string };
type Profile = { firstName: string; lastName: string; email: string; phone: string; streetAddress: string; unit: string; city: string; postalCode: string; country: string };

export function CustomerDashboard({ firstName }: { firstName: string }) {
  const router = useRouter(); const [appointments, setAppointments] = useState<Appointment[]>([]); const [message, setMessage] = useState("");
  const [now] = useState(() => Date.now());
  const load = useCallback(async () => {
    const response = await fetch("/api/account/appointments");
    if (response.status === 401) return router.replace("/login");
    setAppointments((await response.json()).appointments ?? []);
  }, [router]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  async function saveNotes(id: string, clientNotes: string) {
    const response = await fetch("/api/account/appointments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, clientNotes }) });
    setMessage(response.ok ? "Your notes were saved." : "Could not save your notes."); if (response.ok) await load();
  }
  const upcoming = appointments.filter((item) => new Date(item.endsAt).getTime() >= now && item.status !== "cancelled").reverse();
  const past = appointments.filter((item) => new Date(item.endsAt).getTime() < now || item.status === "cancelled");
  return <main className="account-page"><header className="account-header"><div><p className="eyebrow">Your account</p><h1>Greetings, {firstName}.</h1></div></header>
    {message && <p className="admin-message">{message}</p>}
    <AccountScheduler onBooked={load} onMessage={setMessage} />
    <section className="account-panel"><h2>Upcoming appointments</h2>{upcoming.length === 0 ? <p className="empty-state">You have no upcoming appointments.</p> : <div className="customer-appointments">{upcoming.map((appointment) => <UpcomingAppointment key={appointment.id} appointment={appointment} save={saveNotes} />)}</div>}</section>
    <section className="account-panel"><h2>Past appointments</h2>{past.length === 0 ? <p className="empty-state">Your appointment history will appear here.</p> : <div className="customer-appointments">{past.map((appointment) => <article key={appointment.id}><AppointmentHeading appointment={appointment} />{appointment.adminNotes && <div className="shared-notes"><strong>Notes from Handy Dandy</strong><p>{appointment.adminNotes}</p></div>}{appointment.clientNotes && <div className="shared-notes"><strong>Your notes</strong><p>{appointment.clientNotes}</p></div>}</article>)}</div>}</section>
    <CustomerProfile onMessage={setMessage} />
    <section className="account-contact"><h2>Contact me</h2><div><a href={process.env.NEXT_PUBLIC_WHATSAPP_URL || "#"} aria-label="WhatsApp"><span aria-hidden="true">◉</span>WhatsApp</a><a href={`mailto:${process.env.NEXT_PUBLIC_BUSINESS_EMAIL || "hello@example.com"}`} aria-label="Email"><span aria-hidden="true">✉</span>Email</a><a href={process.env.NEXT_PUBLIC_MESSENGER_URL || "#"} aria-label="Facebook Messenger"><span aria-hidden="true">f</span>Facebook</a></div></section>
  </main>;
}

function AccountScheduler({ onBooked, onMessage }: { onBooked: () => Promise<void>; onMessage: (message: string) => void }) {
  const [open, setOpen] = useState(false); const [services, setServices] = useState<Service[]>([]); const [serviceId, setServiceId] = useState("");
  const [currentWeek] = useState(startOfWeek); const [week, setWeek] = useState(startOfWeek);
  const [availability, setAvailability] = useState<Record<string, Slot[]>>({});
  const [selected, setSelected] = useState<{ date: string; slot: Slot }>(); const [notes, setNotes] = useState(""); const [loading, setLoading] = useState(false);
  const dates = Array.from({ length: 7 }, (_, index) => addDays(week, index));

  useEffect(() => {
    if (!open || services.length) return;
    fetch("/api/services").then((response) => response.json()).then((body) => { setServices(body.services ?? []); setServiceId(body.services?.[0]?.id ?? ""); });
  }, [open, services.length]);

  useEffect(() => {
    if (!open || !serviceId) return;
    const controller = new AbortController();
    Promise.all(Array.from({ length: 7 }, async (_, index) => {
      const dateText = formatDateInput(addDays(week, index));
      const response = await fetch(`/api/availability?date=${dateText}&serviceId=${serviceId}`, { signal: controller.signal });
      const body = await response.json(); return [dateText, body.slots ?? []] as const;
    })).then((entries) => setAvailability(Object.fromEntries(entries))).catch(() => undefined).finally(() => setLoading(false));
    return () => controller.abort();
  }, [open, serviceId, week]);

  function changeWeek(amount: number) { setWeek((value) => addDays(value, amount * 7)); setSelected(undefined); setLoading(true); }
  async function book() {
    if (!selected) return; setLoading(true);
    const response = await fetch("/api/account/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceId, date: selected.date, startsAt: selected.slot.startsAt, clientNotes: notes }) });
    const body = await response.json(); setLoading(false);
    if (!response.ok) return onMessage(body.error ?? "Could not create the appointment.");
    onMessage("Your appointment was scheduled."); setOpen(false); setSelected(undefined); setNotes(""); await onBooked();
  }

  return <section className="account-panel scheduler-panel"><button className="scheduler-toggle" onClick={() => { setOpen((value) => !value); setLoading(!open); }}>{open ? "Close appointment scheduler" : "Schedule new appointment"}</button>{open && <div className="scheduler-content">
    <label>Service<select value={serviceId} onChange={(event) => { setServiceId(event.target.value); setSelected(undefined); setLoading(true); }}>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
    <div className="week-controls"><button disabled={week.getTime() <= currentWeek.getTime()} onClick={() => changeWeek(-1)} aria-label="Previous week">←</button><strong>{dates[0].toLocaleDateString([], { month: "short", day: "numeric" })} – {dates[6].toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</strong><button onClick={() => changeWeek(1)} aria-label="Next week">→</button></div>
    <div className="weekly-availability" aria-busy={loading}>{dates.map((date) => { const dateText = formatDateInput(date); const slots = availability[dateText] ?? []; return <section key={dateText}><header><strong>{date.toLocaleDateString([], { weekday: "short" })}</strong><span>{date.toLocaleDateString([], { month: "short", day: "numeric" })}</span></header><div>{slots.length ? slots.map((slot) => <button className={selected?.slot.startsAt === slot.startsAt ? "is-selected" : ""} key={slot.startsAt} onClick={() => setSelected({ date: dateText, slot })}>{slot.label}</button>) : <small>No times</small>}</div></section>; })}</div>
    {selected && <div className="scheduler-confirm"><label>Notes for this appointment<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label><button disabled={loading} onClick={book}>{loading ? "Scheduling…" : `Confirm ${selected.slot.label}`}</button></div>}
  </div>}</section>;
}

function CustomerProfile({ onMessage }: { onMessage: (message: string) => void }) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [profile, setProfile] = useState<Profile>();
  useEffect(() => {
    if (!open || profile) return;
    fetch("/api/account/profile").then((response) => response.json()).then((body) => setProfile({
      firstName: body.profile?.firstName ?? "", lastName: body.profile?.lastName ?? "", email: body.profile?.email ?? "",
      phone: body.profile?.phone ?? "", streetAddress: body.profile?.streetAddress ?? "", unit: body.profile?.unit ?? "",
      city: body.profile?.city ?? "", postalCode: body.profile?.postalCode ?? "", country: body.profile?.country ?? "",
    }));
  }, [open, profile]);
  if (!open) return <section className="profile-toggle-panel"><button onClick={() => setOpen(true)}>Edit profile</button></section>;
  if (!profile) return <section className="profile-toggle-panel"><button disabled>Loading profile…</button></section>;
  const update = (key: keyof Profile, value: string) => setProfile((current) => current ? { ...current, [key]: value } : current);
  const beginAddress = () => { if (!profile.country) update("country", "Canada"); };
  async function save() {
    const response = await fetch("/api/account/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
    const body = await response.json(); onMessage(response.ok ? "Your profile was updated." : body.error ?? "Could not update your profile."); if (response.ok) router.refresh();
  }
  return <section className="account-panel"><div className="profile-heading"><h2>Edit profile</h2><button onClick={() => setOpen(false)}>Close</button></div><div className="profile-grid">
    <label>First name<input value={profile.firstName} onChange={(event) => update("firstName", event.target.value)} /></label><label>Last name<input value={profile.lastName} onChange={(event) => update("lastName", event.target.value)} /></label>
    <label className="wide">Email <small>Cannot be changed</small><input value={profile.email} readOnly disabled /></label><label className="wide">Phone<input type="tel" inputMode="numeric" pattern="[0-9]*" value={profile.phone} onChange={(event) => update("phone", event.target.value.replace(/\D/g, ""))} /></label>
    <label className="wide">Street number and street<input value={profile.streetAddress} onFocus={beginAddress} onChange={(event) => update("streetAddress", event.target.value)} /></label><label>Unit<input value={profile.unit} onFocus={beginAddress} onChange={(event) => update("unit", event.target.value)} /></label><label>City<input value={profile.city} onFocus={beginAddress} onChange={(event) => update("city", event.target.value)} /></label><label>Postal code<input value={profile.postalCode} onFocus={beginAddress} onChange={(event) => update("postalCode", event.target.value)} /></label><label>Country<input value={profile.country} onFocus={beginAddress} onChange={(event) => update("country", event.target.value)} /></label>
    <button className="wide" onClick={save}>Save profile</button>
  </div></section>;
}

function UpcomingAppointment({ appointment, save }: { appointment: Appointment; save: (id: string, notes: string) => Promise<void> }) {
  const [notes, setNotes] = useState(appointment.clientNotes);
  return <article><AppointmentHeading appointment={appointment} />{appointment.adminNotes && <div className="shared-notes"><strong>Notes from Handy Dandy</strong><p>{appointment.adminNotes}</p></div>}<label>Your notes<textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Anything you want me to know before our appointment" /></label><button onClick={() => save(appointment.id, notes)}>Save notes</button></article>;
}
function AppointmentHeading({ appointment }: { appointment: Appointment }) { return <header><div><strong>{appointment.serviceName}</strong><time>{new Date(appointment.startsAt).toLocaleString([], { dateStyle: "full", timeStyle: "short" })}</time></div><span>{appointment.status.replace("_", " ")}</span></header>; }
function startOfWeek() { const value = new Date(); value.setHours(0, 0, 0, 0); value.setDate(value.getDate() - ((value.getDay() + 6) % 7)); return value; }
function addDays(date: Date, amount: number) { const value = new Date(date); value.setDate(value.getDate() + amount); return value; }
function formatDateInput(date: Date) { return date.toLocaleDateString("en-CA"); }
