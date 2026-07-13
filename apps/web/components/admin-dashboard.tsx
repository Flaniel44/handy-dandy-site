"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Hours = { weekday: number; startsAtLocal: string; endsAtLocal: string };
type Block = { id: string; startsAt: string; endsAt: string; reason: string };
type Client = { id: string; name: string; email: string; phone?: string; appointmentCount: number };
type ClientPagination = { page: number; pageSize: number; total: number; totalPages: number };
type Appointment = { id: string; status: string; notes: string; startsAt: string; endsAt: string; customerName: string; customerEmail: string; customerPhone?: string; serviceName: string; source: string };
type Service = { id: string; name: string; description: string; durationMinutes: number; priceCents: number; active: boolean; sortOrder: number };
type CalendarEvent = { id: string; name: string; startsAt: string; endsAt: string; isAllDay: boolean; googleBusy: boolean; override: "available" | "unavailable" | null; blocksAvailability: boolean };
type CalendarStatus = { configured: boolean; connected: boolean; connection: { calendarId: string; updatedAt: string } | null; health?: { pending: number; failed: number; synced: number; lastSyncedAt: string | null }; events?: CalendarEvent[] };
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function AdminDashboard() {
  const router = useRouter();
  const [hours, setHours] = useState<Hours[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientPagination, setClientPagination] = useState<ClientPagination>({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [clientsLoading, setClientsLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [timezone, setTimezone] = useState("");
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus>({ configured: false, connected: false, connection: null });
  const [calendarSyncing, setCalendarSyncing] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const endpoints = ["/api/admin/working-hours", "/api/admin/blocks", "/api/admin/appointments", "/api/admin/services", "/api/admin/google-calendar"];
    const responses = await Promise.all(endpoints.map((url) => fetch(url)));
    if (responses.some((response) => response.status === 401)) { router.replace("/admin/login"); return; }
    const [hoursBody, blocksBody, appointmentsBody, servicesBody, calendarBody] = await Promise.all(responses.map((response) => response.json()));
    setHours((hoursBody.hours ?? []).map((item: Hours) => ({
      ...item,
      startsAtLocal: item.startsAtLocal.slice(0, 5),
      endsAtLocal: item.endsAtLocal.slice(0, 5),
    })));
    setTimezone(hoursBody.timezone ?? ""); setBlocks(blocksBody.blocks ?? []);
    setAppointments(appointmentsBody.appointments ?? []); setServices(servicesBody.services ?? []);
    setCalendarStatus(calendarBody);
  }, [router]);

  const loadClients = useCallback(async (page = 1) => {
    setClientsLoading(true);
    const response = await fetch(`/api/admin/clients?page=${page}&pageSize=20`, { cache: "no-store" });
    if (response.status === 401) { router.replace("/admin/login"); return; }
    const body = await response.json();
    if (response.ok) { setClients(body.clients ?? []); setClientPagination(body.pagination); }
    else setMessage(body.error ?? "Could not load clients.");
    setClientsLoading(false);
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); void loadClients(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load, loadClients]);

  async function saveHours() {
    const response = await fetch("/api/admin/working-hours", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hours }) });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Working hours saved." : body.error ?? "Could not save working hours.");
    if (response.ok) await load();
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
    if (response.ok) { event.currentTarget.reset(); await Promise.all([load(), loadClients(clientPagination.page)]); }
  }

  async function updateAppointment(id: string, notes: string, status: string) {
    const response = await fetch(`/api/admin/appointments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes, status }) });
    setMessage(response.ok ? "Appointment updated." : "Could not update appointment."); if (response.ok) await load();
  }

  async function addService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        description: form.get("description"),
        durationMinutes: Number(form.get("durationMinutes")),
        priceCents: Math.round(Number(form.get("priceDollars")) * 100),
        active: true,
      }),
    });
    const body = await response.json();
    setMessage(response.ok ? "Service created." : body.error ?? "Could not create service.");
    if (response.ok) { event.currentTarget.reset(); await load(); }
  }

  async function updateService(service: Service) {
    const response = await fetch(`/api/admin/services/${service.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: service.name,
        description: service.description,
        durationMinutes: service.durationMinutes,
        priceCents: service.priceCents,
        active: service.active,
      }),
    });
    const body = await response.json();
    setMessage(response.ok ? "Service saved." : body.error ?? "Could not save service.");
    if (response.ok) await load();
  }

  async function moveService(id: string, direction: -1 | 1) {
    const currentIndex = services.findIndex((service) => service.id === id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= services.length) return;
    const reordered = [...services];
    [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];
    setServices(reordered);
    const response = await fetch("/api/admin/services/order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: reordered.map((service) => service.id) }),
    });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Service order saved." : body.error ?? "Could not reorder services.");
    if (!response.ok) await load();
  }

  async function disconnectCalendar() {
    if (!window.confirm("Disconnect Google Calendar? Calendar events will no longer block booking availability.")) return;
    const response = await fetch("/api/admin/google-calendar", { method: "DELETE" });
    setMessage(response.ok ? "Google Calendar disconnected." : "Could not disconnect Google Calendar.");
    if (response.ok) await load();
  }

  async function syncCalendar() {
    setCalendarSyncing(true);
    const response = await fetch("/api/admin/google-calendar", { method: "POST" });
    const body = await response.json();
    setMessage(response.ok ? `Calendar sync complete: ${body.synced} synced, ${body.failed} failed.` : body.error ?? "Calendar sync failed.");
    setCalendarSyncing(false);
    await load();
  }

  async function setEventAvailability(eventId: string, mode: "available" | "unavailable") {
    const response = await fetch("/api/admin/google-calendar", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId, mode }) });
    const body = await response.json();
    setMessage(response.ok ? `Calendar event marked ${mode}.` : body.error ?? "Could not update event availability.");
    if (response.ok) await load();
  }

  const activeAppointmentGroups = groupAppointmentsByCustomer(appointments.filter((appointment) => !["completed", "cancelled"].includes(appointment.status)));
  const completedAppointments = appointments
    .filter((appointment) => appointment.status === "completed")
    .sort((first, second) => new Date(second.startsAt).getTime() - new Date(first.startsAt).getTime());
  const cancelledAppointments = appointments
    .filter((appointment) => appointment.status === "cancelled")
    .sort((first, second) => new Date(second.startsAt).getTime() - new Date(first.startsAt).getTime());

  return <main className="admin-page">
    <header className="admin-header"><div><p className="eyebrow">Administration</p><h1>Admin</h1></div></header>
    {message && <p className="admin-message" role="status">{message}</p>}

    <details className="admin-panel admin-collapsible-panel admin-working-panel"><summary><span><strong>Working hours</strong><small>Recurring availability in {timezone || "your business timezone"}.</small></span></summary><div className="collapsible-panel-heading"><button onClick={saveHours}>Save hours</button></div>
      <div className="hours-list">{DAYS.map((day, weekday) => { const row = hours.find((item) => item.weekday === weekday); return <div className="hours-row" key={day}>
        <label><input type="checkbox" checked={Boolean(row)} onChange={() => toggleDay(weekday)} /> {day}</label>
        {row ? <div><input type="time" value={row.startsAtLocal.slice(0, 5)} onChange={(event) => updateHours(weekday, "startsAtLocal", event.target.value)} /><span>to</span><input type="time" value={row.endsAtLocal.slice(0, 5)} onChange={(event) => updateHours(weekday, "endsAtLocal", event.target.value)} /></div> : <span>Closed</span>}
      </div>; })}</div>
    </details>

    <details className="admin-panel admin-collapsible-panel admin-services-panel"><summary><span><strong>Services</strong><small>Create, reorder, and configure the services clients can book.</small></span></summary>
      <form className="admin-grid-form service-create-form" onSubmit={addService}>
        <label>Name<input name="name" placeholder="General tech support" required minLength={2} maxLength={120} /></label>
        <label>Duration (minutes)<input name="durationMinutes" type="number" min="15" max="480" step="15" defaultValue="60" required /></label>
        <label>Price (CAD)<input name="priceDollars" type="number" min="0" max="100000" step="0.01" defaultValue="0.00" required /></label>
        <label className="wide">Description<textarea name="description" rows={2} maxLength={1000} placeholder="What this service includes" /></label>
        <button type="submit">Create service</button>
      </form>
      <div className="service-admin-list">{services.map((service, index) => <ServiceEditor key={service.id} service={service} save={updateService} canMoveUp={index > 0} canMoveDown={index < services.length - 1} moveUp={() => moveService(service.id, -1)} moveDown={() => moveService(service.id, 1)} />)}</div>
    </details>

    <section className="admin-panel admin-blocks-panel"><div className="admin-section-heading"><div><h2>Vacation and manual blocks</h2><p>Blocked periods are removed from public availability.</p></div></div>
      <form className="admin-inline-form" onSubmit={addBlock}><label>Starts<input name="startsAtLocal" type="datetime-local" required /></label><label>Ends<input name="endsAtLocal" type="datetime-local" required /></label><label>Reason<input name="reason" defaultValue="Vacation" required /></label><button type="submit">Add block</button></form>
      <div className="admin-list">{blocks.map((block) => <article key={block.id}><div><strong>{block.reason}</strong><p>{formatDate(block.startsAt)} → {formatDate(block.endsAt)}</p></div><button onClick={() => deleteBlock(block.id)}>Remove</button></article>)}</div>
    </section>

    <section className="admin-panel admin-calendar-panel"><div className="admin-section-heading"><div><h2>Google Calendar</h2><p>Timed events block availability and confirmed appointments sync back to your calendar.</p></div></div>
      <div className="calendar-connection">
        <div><strong>{calendarStatus.connected ? calendarStatus.health?.failed ? "Connected — attention needed" : "Connected" : "Not connected"}</strong><p>{calendarStatus.connected ? `Calendar: ${calendarStatus.connection?.calendarId}` : calendarStatus.configured ? "Connect the Google account that owns your business calendar." : "Complete the Google Calendar environment variables first."}</p>
          {calendarStatus.connected && <div className="calendar-health"><span>{calendarStatus.health?.synced ?? 0} synced</span><span>{calendarStatus.health?.pending ?? 0} pending</span><span className={calendarStatus.health?.failed ? "has-errors" : ""}>{calendarStatus.health?.failed ?? 0} failed</span><span>Last success: {calendarStatus.health?.lastSyncedAt ? formatDate(calendarStatus.health.lastSyncedAt) : "Not yet"}</span></div>}
        </div>
        <div className="calendar-actions">{calendarStatus.connected ? <><button disabled={calendarSyncing} onClick={syncCalendar}>{calendarSyncing ? "Syncing…" : "Sync now"}</button><button onClick={disconnectCalendar}>Disconnect</button></> : <a className={`admin-action-link${calendarStatus.configured ? "" : " disabled"}`} href={calendarStatus.configured ? "/api/admin/google-calendar/connect" : undefined}>Connect Google Calendar</a>}</div>
      </div>
      {calendarStatus.connected && <details className="calendar-events-list"><summary><span>Calendar availability events</span><small>{calendarStatus.events?.filter((event) => event.blocksAvailability).length ?? 0} blocking</small></summary>
        <div>{calendarStatus.events?.length ? calendarStatus.events.map((event) => <article key={event.id} className={event.blocksAvailability ? "is-blocking" : ""}><div><strong>{event.name}</strong><p>{formatCalendarEvent(event)}</p><small>{event.blocksAvailability ? "Unavailable for bookings" : "Available for bookings"}{event.override ? ` · Manual override: ${event.override}` : event.googleBusy ? " · Google: Busy" : " · Google: Free"}</small></div><button onClick={() => setEventAvailability(event.id, event.blocksAvailability ? "available" : "unavailable")}>{event.blocksAvailability ? "Become available" : "Become unavailable"}</button></article>) : <p className="empty-state">No Google Calendar events fall inside the current booking window.</p>}</div>
      </details>}
    </section>

    <details className="admin-panel admin-collapsible-panel admin-phone-panel"><summary><span><strong>Add a phone appointment</strong><small>Create a confirmed appointment for a phone-booked client.</small></span></summary>
      <form className="admin-grid-form" onSubmit={addAppointment}><label>Service<select name="serviceId" required>{services.filter((service) => service.active).map((service) => <option value={service.id} key={service.id}>{service.name}</option>)}</select></label><label>Date and time<input name="startsAtLocal" type="datetime-local" required /></label><label>Client name<input name="name" required /></label><label>Email<input name="email" type="email" required /></label><label>Phone<input name="phone" type="tel" inputMode="numeric" pattern="[0-9]*" onInput={(event) => { event.currentTarget.value = event.currentTarget.value.replace(/\D/g, ""); }} /></label><label className="wide">Notes<textarea name="notes" rows={3} /></label><button type="submit">Create appointment</button></form>
    </details>

    <section className="admin-panel admin-appointments-panel"><div className="admin-section-heading"><div><h2>Appointments</h2><p>{appointments.length} total appointments, grouped by client.</p></div></div>
      <div className="appointment-groups">
        {activeAppointmentGroups.length ? activeAppointmentGroups.map((group) => <section className="appointment-group" key={group.email}>
          <header><div><h3>{group.name}</h3><a href={`mailto:${group.email}`}>{group.email}</a></div><span>{group.appointments.length} appointment{group.appointments.length === 1 ? "" : "s"}</span></header>
          <div className="appointment-list">{group.appointments.map((appointment) => <AppointmentEditor key={appointment.id} appointment={appointment} save={updateAppointment} showCustomer={false} />)}</div>
        </section>) : <p className="empty-state">No current appointments.</p>}
      </div>
      <details className="appointment-archive">
        <summary><span>Completed appointments</span><small>{completedAppointments.length}</small></summary>
        {completedAppointments.length ? <div className="appointment-list">{completedAppointments.map((appointment) => <AppointmentEditor key={appointment.id} appointment={appointment} save={updateAppointment} />)}</div> : <p className="empty-state">No completed appointments yet.</p>}
      </details>
      <details className="appointment-archive">
        <summary><span>Cancelled appointments</span><small>{cancelledAppointments.length}</small></summary>
        {cancelledAppointments.length ? <div className="appointment-list">{cancelledAppointments.map((appointment) => <AppointmentEditor key={appointment.id} appointment={appointment} save={updateAppointment} />)}</div> : <p className="empty-state">No cancelled appointments yet.</p>}
      </details>
    </section>

    <section className="admin-panel admin-clients-panel"><div className="admin-section-heading"><div><h2>Clients</h2><p>Guest and phone-booked clients are tracked by email.</p></div></div>
      <div className="client-table" aria-busy={clientsLoading}>{clientsLoading ? <p className="empty-state">Loading clients…</p> : clients.map((client) => <ClientHistory key={client.id} client={client} save={updateAppointment} />)}</div>
      <div className="client-pagination"><button disabled={clientsLoading || clientPagination.page <= 1} onClick={() => loadClients(clientPagination.page - 1)}>Previous</button><span>Page {clientPagination.page} of {clientPagination.totalPages} · {clientPagination.total} clients</span><button disabled={clientsLoading || clientPagination.page >= clientPagination.totalPages} onClick={() => loadClients(clientPagination.page + 1)}>Next</button></div>
    </section>
  </main>;
}

function ServiceEditor({ service, save, canMoveUp, canMoveDown, moveUp, moveDown }: { service: Service; save: (service: Service) => Promise<void>; canMoveUp: boolean; canMoveDown: boolean; moveUp: () => void; moveDown: () => void }) {
  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description);
  const [durationMinutes, setDurationMinutes] = useState(String(service.durationMinutes));
  const [priceDollars, setPriceDollars] = useState((service.priceCents / 100).toFixed(2));
  const [active, setActive] = useState(service.active);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await save({
      ...service,
      name,
      description,
      durationMinutes: Number(durationMinutes),
      priceCents: Math.round(Number(priceDollars) * 100),
      active,
    });
  }

  return <form className={`service-admin-card${active ? "" : " is-disabled"}`} onSubmit={submit}>
    <label>Name<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={120} /></label>
    <label>Duration (minutes)<input type="number" min="15" max="480" step="15" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} required /></label>
    <label>Price (CAD)<input type="number" min="0" max="100000" step="0.01" value={priceDollars} onChange={(event) => setPriceDollars(event.target.value)} required /></label>
    <label className="service-active-toggle"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active and bookable</label>
    <div className="service-order-actions wide" aria-label={`Reorder ${service.name}`}><span>Booking menu order</span><button type="button" disabled={!canMoveUp} onClick={moveUp}>↑ Move up</button><button type="button" disabled={!canMoveDown} onClick={moveDown}>↓ Move down</button></div>
    <label className="wide">Description<textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} /></label>
    <button type="submit">Save service</button>
  </form>;
}

function ClientHistory({ client, save }: { client: Client; save: (id: string, notes: string, status: string) => Promise<void> }) {
  const [open, setOpen] = useState(false); const [appointments, setAppointments] = useState<Appointment[]>(); const [error, setError] = useState("");
  async function loadHistory() {
    setError(""); const response = await fetch(`/api/admin/clients/${client.id}/appointments`, { cache: "no-store" }); const body = await response.json();
    if (response.ok) setAppointments(body.appointments ?? []); else setError(body.error ?? "Could not load appointment history.");
  }
  async function saveAndReload(id: string, notes: string, status: string) { await save(id, notes, status); await loadHistory(); }
  return <details className="client-history" onToggle={(event) => { const nextOpen = event.currentTarget.open; setOpen(nextOpen); if (nextOpen && !appointments) void loadHistory(); }}><summary><div><strong>{client.name}</strong><a href={`mailto:${client.email}`} onClick={(event) => event.stopPropagation()}>{client.email}</a>{client.phone && <a href={`tel:${client.phone}`} onClick={(event) => event.stopPropagation()}>{client.phone}</a>}</div><span>{client.appointmentCount} appointment{client.appointmentCount === 1 ? "" : "s"}</span></summary>
    {open && <div className="client-appointment-history">{error ? <p className="form-error">{error}</p> : !appointments ? <p className="empty-state">Loading appointment history…</p> : appointments.length ? appointments.map((appointment) => <AppointmentEditor key={appointment.id} appointment={appointment} save={saveAndReload} showCustomer={false} />) : <p className="empty-state">No appointments found for this client.</p>}</div>}
  </details>;
}

function AppointmentEditor({ appointment, save, showCustomer = true }: { appointment: Appointment; save: (id: string, notes: string, status: string) => Promise<void>; showCustomer?: boolean }) {
  const [notes, setNotes] = useState(appointment.notes); const [status, setStatus] = useState(appointment.status);
  return <article><div className="appointment-summary"><div>{showCustomer && <strong>{appointment.customerName}</strong>}<span>{appointment.serviceName} · {formatDate(appointment.startsAt)}</span>{showCustomer && <a href={`mailto:${appointment.customerEmail}`}>{appointment.customerEmail}</a>}</div><small>{appointment.source}</small></div>
    <div className="appointment-controls"><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="no_show">No show</option></select><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Appointment notes" /><button onClick={() => save(appointment.id, notes, status)}>Save</button></div>
  </article>;
}

function groupAppointmentsByCustomer(items: Appointment[]) {
  const groups = new Map<string, { name: string; email: string; appointments: Appointment[] }>();
  for (const appointment of items) {
    const key = appointment.customerEmail.toLowerCase();
    const group = groups.get(key) ?? { name: appointment.customerName, email: appointment.customerEmail, appointments: [] };
    group.appointments.push(appointment);
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort((first, second) => first.name.localeCompare(second.name))
    .map((group) => ({ ...group, appointments: group.appointments.sort((first, second) => new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime()) }));
}

function formatDate(value: string) { return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); }
function formatCalendarEvent(event: CalendarEvent) {
  const start = new Date(event.startsAt); const end = new Date(event.endsAt);
  if (event.isAllDay) {
    const inclusiveEnd = new Date(end); inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);
    const startText = start.toLocaleDateString([], { dateStyle: "medium" }); const endText = inclusiveEnd.toLocaleDateString([], { dateStyle: "medium" });
    return startText === endText ? `All day · ${startText}` : `All day · ${startText} – ${endText}`;
  }
  return `${formatDate(event.startsAt)} – ${formatDate(event.endsAt)}`;
}
