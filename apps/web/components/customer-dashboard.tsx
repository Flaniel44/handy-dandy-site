"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ContactLinks } from "./contact-links";
import { AppointmentDetailsFields, emptyAppointmentDetails, type BookingAppointmentDetails } from "./appointment-details-fields";

type Appointment = { id: string; status: string; adminNotes: string; clientNotes: string; createdAt: string; startsAt: string; endsAt: string; serviceId: string; serviceName: string; appointmentMode: string; appointmentPhone: string | null; appointmentStreetAddress: string | null; appointmentUnit: string | null; appointmentCity: string | null; appointmentPostalCode: string | null; appointmentCountry: string | null };
type Service = { id: string; name: string; description: string; durationMinutes: number; priceCents: number };
type Slot = { startsAt: string; endsAt: string; label: string };
type Profile = { firstName: string; lastName: string; email: string; phone: string; streetAddress: string; unit: string; city: string; postalCode: string; country: string };

export function CustomerDashboard({ firstName, bookingsEnabled, launchOfferEnabled = false }: { firstName: string; bookingsEnabled: boolean; launchOfferEnabled?: boolean }) {
  const router = useRouter(); const [appointments, setAppointments] = useState<Appointment[]>([]); const [message, setMessage] = useState("");
  const [now] = useState(() => Date.now());
  const load = useCallback(async () => {
    const response = await fetch("/api/account/appointments", { cache: "no-store" });
    if (response.status === 401) return router.replace("/login");
    setAppointments((await response.json()).appointments ?? []);
  }, [router]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 6_000);
    return () => window.clearTimeout(timer);
  }, [message]);
  async function saveNotes(id: string, clientNotes: string) {
    const response = await fetch("/api/account/appointments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, clientNotes }) });
    setMessage(response.ok ? "Your notes were saved." : "Could not save your notes."); if (response.ok) await load();
  }
  async function cancelAppointment(id: string) {
    if (!window.confirm("Cancel this appointment? The time will become available to other clients.")) return;
    const response = await fetch(`/api/account/appointments/${id}`, { method: "DELETE" });
    const body = await response.json(); setMessage(response.ok ? "Your appointment was cancelled." : body.error ?? "Could not cancel the appointment.");
    if (response.ok) {
      setAppointments((items) => items.map((item) => item.id === id ? { ...item, status: "cancelled" } : item));
      await load();
    }
  }
  const upcoming = appointments.filter((item) => new Date(item.endsAt).getTime() >= now && ["pending_approval", "confirmed"].includes(item.status)).sort(sortByNewestBooking);
  const past = appointments.filter((item) => new Date(item.endsAt).getTime() < now || !["pending_approval", "confirmed"].includes(item.status)).sort(sortByNewestBooking);
  return <main className="account-page"><header className="account-header"><div><p className="eyebrow">Your account</p><h1>Greetings, {firstName}.</h1></div></header>
    {message && <div className="account-message" role="status"><span>{message}</span><button type="button" onClick={() => setMessage("")} aria-label="Dismiss notification">&times;</button></div>}
    {bookingsEnabled
      ? <AccountScheduler onBooked={load} onMessage={setMessage} launchOfferEnabled={launchOfferEnabled} />
      : <section className="account-panel scheduler-panel"><p className="eyebrow">Coming soon</p><h2>Online booking is not open yet.</h2><p>Please check back soon. Your existing appointments are still available below.</p></section>}
    <section className="account-panel"><h2>Upcoming appointments</h2>{upcoming.length === 0 ? <p className="empty-state">You have no upcoming appointments.</p> : <div className="customer-appointments">{upcoming.map((appointment) => <UpcomingAppointment key={appointment.id} appointment={appointment} save={saveNotes} cancel={cancelAppointment} onChanged={load} onMessage={setMessage} />)}</div>}</section>
    <section className="account-panel"><h2>Past appointments</h2>{past.length === 0 ? <p className="empty-state">Your appointment history will appear here.</p> : <div className="customer-appointments">{past.map((appointment) => <article key={appointment.id}><AppointmentHeading appointment={appointment} />{appointment.adminNotes && <div className="shared-notes"><strong>Notes from Digital Handyman</strong><p>{appointment.adminNotes}</p></div>}{appointment.clientNotes && <div className="shared-notes"><strong>Your notes</strong><p>{appointment.clientNotes}</p></div>}</article>)}</div>}</section>
    <CustomerProfile onMessage={setMessage} />
    <ContactLinks />
  </main>;
}

function AccountScheduler({ onBooked, onMessage, launchOfferEnabled }: { onBooked: () => Promise<void>; onMessage: (message: string) => void; launchOfferEnabled: boolean }) {
  const [open, setOpen] = useState(false); const [services, setServices] = useState<Service[]>([]); const [serviceId, setServiceId] = useState("");
  const [currentWeek] = useState(startOfWeek); const [week, setWeek] = useState(startOfWeek);
  const [availability, setAvailability] = useState<Record<string, Slot[]>>({});
  const [timezone, setTimezone] = useState("");
  const [appointmentDetails, setAppointmentDetails] = useState<BookingAppointmentDetails>(emptyAppointmentDetails);
  const [selected, setSelected] = useState<{ date: string; slot: Slot }>(); const [notes, setNotes] = useState(""); const [loading, setLoading] = useState(false);
  const dates = Array.from({ length: 7 }, (_, index) => addDays(week, index));
  const service = services.find((item) => item.id === serviceId);

  useEffect(() => {
    if (!open || services.length) return;
    Promise.all([fetch("/api/services"), fetch("/api/account/profile")]).then(async ([servicesResponse, profileResponse]) => {
      const [servicesBody, profileBody] = await Promise.all([servicesResponse.json(), profileResponse.json()]);
      setServices(servicesBody.services ?? []); setServiceId(servicesBody.services?.[0]?.id ?? "");
      if (profileResponse.ok && profileBody.profile) setAppointmentDetails((current) => ({
        ...current,
        appointmentPhone: profileBody.profile.phone ?? "",
        appointmentStreetAddress: profileBody.profile.streetAddress ?? "",
        appointmentUnit: profileBody.profile.unit ?? "",
        appointmentCity: profileBody.profile.city ?? "",
        appointmentPostalCode: profileBody.profile.postalCode ?? "",
        appointmentCountry: profileBody.profile.country || "Canada",
      }));
    }).catch(() => onMessage("Could not load the appointment form."));
  }, [open, services.length, onMessage]);

  useEffect(() => {
    if (!open || !serviceId) return;
    const controller = new AbortController();
    Promise.all(Array.from({ length: 7 }, async (_, index) => {
      const dateText = formatDateInput(addDays(week, index));
      const response = await fetch(`/api/availability?date=${dateText}&serviceId=${serviceId}`, { signal: controller.signal });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Availability is temporarily unavailable.");
      return { dateText, slots: body.slots ?? [], timezone: body.timezone as string };
    })).then((entries) => { setAvailability(Object.fromEntries(entries.map((entry) => [entry.dateText, entry.slots]))); setTimezone(entries[0]?.timezone ?? ""); }).catch((error) => {
      if (error.name !== "AbortError") { setAvailability({}); onMessage(error.message ?? "Availability is temporarily unavailable."); }
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [open, serviceId, week, onMessage]);

  function changeWeek(amount: number) { setWeek((value) => addDays(value, amount * 7)); setSelected(undefined); setLoading(true); }
  async function book() {
    if (!selected) return;
    if (appointmentDetails.appointmentMode === "phone" && appointmentDetails.appointmentPhone.length < 7) return onMessage("Enter the phone number you would like me to call.");
    if (appointmentDetails.appointmentMode === "in_person" && (!appointmentDetails.appointmentStreetAddress || !appointmentDetails.appointmentCity || !appointmentDetails.appointmentPostalCode || !appointmentDetails.appointmentCountry)) return onMessage("Enter the complete address for the in-person appointment.");
    setLoading(true);
    const response = await fetch("/api/account/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceId, date: selected.date, startsAt: selected.slot.startsAt, clientNotes: notes, ...appointmentDetails }) });
    const body = await response.json(); setLoading(false);
    if (!response.ok) return onMessage(body.error ?? "Could not create the appointment.");
    onMessage("Your appointment request was sent for approval."); setOpen(false); setSelected(undefined); setNotes(""); await onBooked();
  }

  return <section className="account-panel scheduler-panel"><button className="scheduler-toggle" onClick={() => { setOpen((value) => !value); setLoading(!open); }}>{open ? "Close appointment scheduler" : "Schedule new appointment"}</button>{open && <div className="scheduler-content">
    {launchOfferEnabled && <aside className="launch-offer-note"><strong>Launch offer: your service is free.</strong><span>Honest feedback is welcome afterward, but a review is never required.</span></aside>}
    <label>Service<select value={serviceId} onChange={(event) => { setServiceId(event.target.value); setSelected(undefined); setLoading(true); }}>{services.map((item) => <option key={item.id} value={item.id}>{item.name}{item.priceCents === 0 ? " — Free" : ""}</option>)}</select></label>
    <p className="service-summary">{service ? `${service.description} · ${service.durationMinutes} minutes · ${service.priceCents === 0 ? "Free" : `$${(service.priceCents / 100).toFixed(2)}`} · ` : ""}Times use {timezone || "the business timezone"}.</p>
    <div className="week-controls"><button disabled={week.getTime() <= currentWeek.getTime()} onClick={() => changeWeek(-1)} aria-label="Previous week">←</button><strong>{dates[0].toLocaleDateString([], { month: "short", day: "numeric" })} – {dates[6].toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</strong><button onClick={() => changeWeek(1)} aria-label="Next week">→</button></div>
    <div className="weekly-availability" aria-busy={loading}>{dates.map((date) => { const dateText = formatDateInput(date); const slots = availability[dateText] ?? []; return <section key={dateText}><header><strong>{date.toLocaleDateString([], { weekday: "short" })}</strong><span>{date.toLocaleDateString([], { month: "short", day: "numeric" })}</span></header><div>{slots.length ? slots.map((slot) => <button className={selected?.slot.startsAt === slot.startsAt ? "is-selected" : ""} key={slot.startsAt} onClick={() => setSelected({ date: dateText, slot })}>{slot.label}</button>) : <small>No times</small>}</div></section>; })}</div>
    {selected && <div className="scheduler-confirm"><AppointmentDetailsFields value={appointmentDetails} onChange={setAppointmentDetails} /><label>Notes for this appointment<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label><button disabled={loading} onClick={book}>{loading ? "Scheduling…" : `Confirm ${selected.slot.label}`}</button></div>}
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

function UpcomingAppointment({ appointment, save, cancel, onChanged, onMessage }: { appointment: Appointment; save: (id: string, notes: string) => Promise<void>; cancel: (id: string) => Promise<void>; onChanged: () => Promise<void>; onMessage: (message: string) => void }) {
  const [notes, setNotes] = useState(appointment.clientNotes);
  return <article><AppointmentHeading appointment={appointment} /><AppointmentMeetingDetails appointment={appointment} />{appointment.adminNotes && <div className="shared-notes"><strong>Notes from Digital Handyman</strong><p>{appointment.adminNotes}</p></div>}<label>Your notes<textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Anything you want me to know before our appointment" /></label><button onClick={() => save(appointment.id, notes)}>Save notes</button><div className="appointment-change-actions"><AppointmentRescheduler appointment={appointment} onChanged={onChanged} onMessage={onMessage} /><button className="danger-button" onClick={() => cancel(appointment.id)}>Cancel appointment</button></div></article>;
}

function AppointmentMeetingDetails({ appointment }: { appointment: Appointment }) {
  const address = [[appointment.appointmentStreetAddress, appointment.appointmentUnit && `Unit ${appointment.appointmentUnit}`].filter(Boolean).join(", "), [appointment.appointmentCity, appointment.appointmentPostalCode].filter(Boolean).join(" "), appointment.appointmentCountry].filter(Boolean).join(", ");
  return <p className="appointment-meeting-details"><strong>{appointment.appointmentMode === "in_person" ? "In person" : "By phone"}</strong><span>{appointment.appointmentMode === "in_person" ? address : appointment.appointmentPhone}</span></p>;
}

function AppointmentRescheduler({ appointment, onChanged, onMessage }: { appointment: Appointment; onChanged: () => Promise<void>; onMessage: (message: string) => void }) {
  const [open, setOpen] = useState(false); const [currentWeek] = useState(startOfWeek); const [week, setWeek] = useState(startOfWeek);
  const [availability, setAvailability] = useState<Record<string, Slot[]>>({}); const [selected, setSelected] = useState<{ date: string; slot: Slot }>(); const [loading, setLoading] = useState(false);
  const [timezone, setTimezone] = useState("");
  const dates = Array.from({ length: 7 }, (_, index) => addDays(week, index));
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const weekDates = Array.from({ length: 7 }, (_, index) => addDays(week, index));
    Promise.all(weekDates.map(async (date) => {
      const dateText = formatDateInput(date);
      const response = await fetch(`/api/availability?date=${dateText}&serviceId=${appointment.serviceId}`, { signal: controller.signal });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Availability is temporarily unavailable.");
      return { dateText, slots: body.slots ?? [], timezone: body.timezone as string };
    })).then((entries) => { setAvailability(Object.fromEntries(entries.map((entry) => [entry.dateText, entry.slots]))); setTimezone(entries[0]?.timezone ?? ""); }).catch((error) => {
      if (error.name !== "AbortError") { setAvailability({}); onMessage(error.message ?? "Availability is temporarily unavailable."); }
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [open, week, appointment.serviceId, onMessage]);
  function changeWeek(amount: number) { setWeek((value) => addDays(value, amount * 7)); setSelected(undefined); }
  async function confirm() {
    if (!selected) return; setLoading(true);
    const response = await fetch(`/api/account/appointments/${appointment.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: selected.date, startsAt: selected.slot.startsAt }) });
    const body = await response.json(); setLoading(false);
    if (!response.ok) return onMessage(body.error ?? "Could not reschedule the appointment.");
    onMessage("Your appointment was rescheduled."); setOpen(false); setSelected(undefined); await onChanged();
  }
  return <div className="appointment-rescheduler"><button onClick={() => { setOpen((value) => !value); if (!open) setLoading(true); }}>{open ? "Close rescheduling" : "Reschedule"}</button>{open && <div className="reschedule-panel">
    <p className="service-summary">Times use {timezone || "the business timezone"}.</p>
    <div className="week-controls"><button disabled={week.getTime() <= currentWeek.getTime()} onClick={() => changeWeek(-1)} aria-label="Previous week">←</button><strong>{dates[0].toLocaleDateString([], { month: "short", day: "numeric" })} – {dates[6].toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</strong><button onClick={() => changeWeek(1)} aria-label="Next week">→</button></div>
    <div className="weekly-availability" aria-busy={loading}>{dates.map((date) => { const dateText = formatDateInput(date); const slots = availability[dateText] ?? []; return <section key={dateText}><header><strong>{date.toLocaleDateString([], { weekday: "short" })}</strong><span>{date.toLocaleDateString([], { month: "short", day: "numeric" })}</span></header><div>{slots.length ? slots.map((slot) => <button className={selected?.slot.startsAt === slot.startsAt ? "is-selected" : ""} key={slot.startsAt} onClick={() => setSelected({ date: dateText, slot })}>{slot.label}</button>) : <small>No times</small>}</div></section>; })}</div>
    {selected && <button className="reschedule-confirm" disabled={loading} onClick={confirm}>{loading ? "Rescheduling…" : `Move to ${selected.slot.label}`}</button>}
  </div>}</div>;
}
function AppointmentHeading({ appointment }: { appointment: Appointment }) { return <header><div><strong>{appointment.serviceName}</strong><time>{new Date(appointment.startsAt).toLocaleString([], { dateStyle: "full", timeStyle: "short" })}</time><small>Booked on {new Date(appointment.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</small></div><span>{appointment.status === "pending_approval" ? "awaiting approval" : appointment.status.replace("_", " ")}</span></header>; }
function sortByNewestBooking(first: Appointment, second: Appointment) { return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(); }
function startOfWeek() { const value = new Date(); value.setHours(0, 0, 0, 0); value.setDate(value.getDate() - ((value.getDay() + 6) % 7)); return value; }
function addDays(date: Date, amount: number) { const value = new Date(date); value.setDate(value.getDate() + amount); return value; }
function formatDateInput(date: Date) { return date.toLocaleDateString("en-CA"); }
