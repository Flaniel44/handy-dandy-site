"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Hours = { weekday: number; startsAtLocal: string; endsAtLocal: string };
type Block = { id: string; startsAt: string; endsAt: string; reason: string };
type Client = { id: string; name: string; email: string; phone?: string; appointmentCount: number };
type Appointment = { id: string; status: string; notes: string; startsAt: string; endsAt: string; customerName: string; customerEmail: string; customerPhone?: string; serviceName: string; source: string };
type Service = { id: string; name: string };
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function AdminDashboard() {
  const router = useRouter();
  const [hours, setHours] = useState<Hours[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [timezone, setTimezone] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const endpoints = ["/api/admin/working-hours", "/api/admin/blocks", "/api/admin/clients", "/api/admin/appointments", "/api/services"];
    const responses = await Promise.all(endpoints.map((url) => fetch(url)));
    if (responses.some((response) => response.status === 401)) { router.replace("/admin/login"); return; }
    const [hoursBody, blocksBody, clientsBody, appointmentsBody, servicesBody] = await Promise.all(responses.map((response) => response.json()));
    setHours(hoursBody.hours ?? []); setTimezone(hoursBody.timezone ?? ""); setBlocks(blocksBody.blocks ?? []);
    setClients(clientsBody.clients ?? []); setAppointments(appointmentsBody.appointments ?? []); setServices(servicesBody.services ?? []);
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function saveHours() {
    const response = await fetch("/api/admin/working-hours", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hours }) });
    setMessage(response.ok ? "Working hours saved." : "Could not save working hours.");
  }

  function toggleDay(weekday: number) {
    setHours((current) => current.some((item) => item.weekday === weekday)
      ? current.filter((item) => item.weekday !== weekday)
      : [...current, { weekday, startsAtLocal: "09:00", endsAtLocal: "17:00" }]);
  }

  function updateHours(weekday: number, key: "startsAtLocal" | "endsAtLocal", value: string) {
    setHours((current) => current.map((item) => item.weekday === weekday ? { ...item, [key]: value } : item));
  }

  async function addBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/blocks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    setMessage(response.ok ? "Vacation block added." : (await response.json()).error); if (response.ok) { event.currentTarget.reset(); await load(); }
  }

  async function deleteBlock(id: string) {
    const response = await fetch(`/api/admin/blocks/${id}`, { method: "DELETE" });
    if (response.ok) await load();
  }

  async function addAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    const body = await response.json(); setMessage(response.ok ? "Phone appointment created." : body.error);
    if (response.ok) { event.currentTarget.reset(); await load(); }
  }

  async function updateAppointment(id: string, notes: string, status: string) {
    const response = await fetch(`/api/admin/appointments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes, status }) });
    setMessage(response.ok ? "Appointment updated." : "Could not update appointment."); if (response.ok) await load();
  }

  return <main className="admin-page">
    <header className="admin-header"><div><p className="eyebrow">Handy Dandy</p><h1>Admin</h1></div></header>
    {message && <p className="admin-message" role="status">{message}</p>}

    <section className="admin-panel"><div className="admin-section-heading"><div><h2>Working hours</h2><p>Recurring availability in {timezone || "your business timezone"}.</p></div><button onClick={saveHours}>Save hours</button></div>
      <div className="hours-list">{DAYS.map((day, weekday) => { const row = hours.find((item) => item.weekday === weekday); return <div className="hours-row" key={day}>
        <label><input type="checkbox" checked={Boolean(row)} onChange={() => toggleDay(weekday)} /> {day}</label>
        {row ? <div><input type="time" value={row.startsAtLocal.slice(0, 5)} onChange={(event) => updateHours(weekday, "startsAtLocal", event.target.value)} /><span>to</span><input type="time" value={row.endsAtLocal.slice(0, 5)} onChange={(event) => updateHours(weekday, "endsAtLocal", event.target.value)} /></div> : <span>Closed</span>}
      </div>; })}</div>
    </section>

    <section className="admin-panel"><div className="admin-section-heading"><div><h2>Vacation and manual blocks</h2><p>Blocked periods are removed from public availability.</p></div></div>
      <form className="admin-inline-form" onSubmit={addBlock}><label>Starts<input name="startsAtLocal" type="datetime-local" required /></label><label>Ends<input name="endsAtLocal" type="datetime-local" required /></label><label>Reason<input name="reason" defaultValue="Vacation" required /></label><button type="submit">Add block</button></form>
      <div className="admin-list">{blocks.map((block) => <article key={block.id}><div><strong>{block.reason}</strong><p>{formatDate(block.startsAt)} → {formatDate(block.endsAt)}</p></div><button onClick={() => deleteBlock(block.id)}>Remove</button></article>)}</div>
    </section>

    <section className="admin-panel"><div className="admin-section-heading"><div><h2>Add a phone appointment</h2><p>This creates a confirmed appointment without payment.</p></div></div>
      <form className="admin-grid-form" onSubmit={addAppointment}><label>Service<select name="serviceId" required>{services.map((service) => <option value={service.id} key={service.id}>{service.name}</option>)}</select></label><label>Date and time<input name="startsAtLocal" type="datetime-local" required /></label><label>Client name<input name="name" required /></label><label>Email<input name="email" type="email" required /></label><label>Phone<input name="phone" type="tel" inputMode="numeric" pattern="[0-9]*" onInput={(event) => { event.currentTarget.value = event.currentTarget.value.replace(/\D/g, ""); }} /></label><label className="wide">Notes<textarea name="notes" rows={3} /></label><button type="submit">Create appointment</button></form>
    </section>

    <section className="admin-panel"><div className="admin-section-heading"><div><h2>Appointments</h2><p>{appointments.length} total appointments.</p></div></div>
      <div className="appointment-list">{appointments.map((appointment) => <AppointmentEditor key={appointment.id} appointment={appointment} save={updateAppointment} />)}</div>
    </section>

    <section className="admin-panel"><div className="admin-section-heading"><div><h2>Clients</h2><p>Guest and phone-booked clients are tracked by email.</p></div></div>
      <div className="client-table">{clients.map((client) => <article key={client.id}><div><strong>{client.name}</strong><a href={`mailto:${client.email}`}>{client.email}</a>{client.phone && <a href={`tel:${client.phone}`}>{client.phone}</a>}</div><span>{client.appointmentCount} appointment{client.appointmentCount === 1 ? "" : "s"}</span></article>)}</div>
    </section>
  </main>;
}

function AppointmentEditor({ appointment, save }: { appointment: Appointment; save: (id: string, notes: string, status: string) => Promise<void> }) {
  const [notes, setNotes] = useState(appointment.notes); const [status, setStatus] = useState(appointment.status);
  return <article><div className="appointment-summary"><div><strong>{appointment.customerName}</strong><span>{appointment.serviceName} · {formatDate(appointment.startsAt)}</span><a href={`mailto:${appointment.customerEmail}`}>{appointment.customerEmail}</a></div><small>{appointment.source}</small></div>
    <div className="appointment-controls"><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="no_show">No show</option></select><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Appointment notes" /><button onClick={() => save(appointment.id, notes, status)}>Save</button></div>
  </article>;
}

function formatDate(value: string) { return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); }
