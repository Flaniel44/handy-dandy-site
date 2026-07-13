import { DateTime } from "luxon";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetTestData } from "../../../../test/integration/database";

const SERVICE_ID = "22222222-2222-4222-8222-222222222222";
const auth = vi.hoisted(() => ({ isAdmin: false }));

vi.mock("../../../../lib/admin-auth", () => ({
  requireAdmin: vi.fn(() => auth.isAdmin ? { role: "admin", email: "admin@example.com" } : null),
}));

let testSql: ReturnType<typeof postgres>;
let listClients: typeof import("./route").GET;
let clientHistory: typeof import("./[id]/appointments/route").GET;

beforeAll(async () => {
  testSql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  ({ GET: listClients } = await import("./route"));
  ({ GET: clientHistory } = await import("./[id]/appointments/route"));
});

beforeEach(async () => {
  await resetTestData(testSql);
  auth.isAdmin = false;
});

afterAll(async () => {
  await testSql?.end();
});

describe("admin client list", () => {
  it("requires admin access for both the list and individual histories", async () => {
    expect((await listClients(clientListRequest())).status).toBe(401);
    expect((await clientHistory(new Request("http://localhost"), context("00000000-0000-4000-8000-000000000001"))).status).toBe(401);
  });

  it("returns correct page metadata, ordering, and appointment counts without eager histories", async () => {
    auth.isAdmin = true;
    const createdAt = DateTime.fromISO("2026-01-20T12:00:00Z");
    const customerIds: string[] = [];
    for (let index = 0; index < 12; index += 1) {
      customerIds.push(await seedCustomer(
        `Client ${String(index).padStart(2, "0")}`,
        `client${index}@example.com`,
        createdAt.minus({ minutes: index }).toJSDate(),
      ));
    }
    await seedAppointment(customerIds[0]!, futureTime(0), "confirmed", "First appointment");
    await seedAppointment(customerIds[0]!, futureTime(1), "completed", "Second appointment");
    await seedAppointment(customerIds[6]!, futureTime(2), "cancelled", "Another client appointment");

    const firstResponse = await listClients(clientListRequest(1, 5));
    const first = await firstResponse.json() as ClientListResponse;
    expect(first.pagination).toEqual({ page: 1, pageSize: 5, total: 12, totalPages: 3 });
    expect(first.clients.map((client) => client.name)).toEqual([
      "Client 00", "Client 01", "Client 02", "Client 03", "Client 04",
    ]);
    expect(first.clients[0]?.appointmentCount).toBe(2);
    expect(first.clients.every((client) => !("appointments" in client))).toBe(true);

    const second = await (await listClients(clientListRequest(2, 5))).json() as ClientListResponse;
    expect(second.clients.map((client) => client.name)).toEqual([
      "Client 05", "Client 06", "Client 07", "Client 08", "Client 09",
    ]);
    expect(second.clients[1]?.appointmentCount).toBe(1);
    const third = await (await listClients(clientListRequest(3, 5))).json() as ClientListResponse;
    expect(third.clients.map((client) => client.name)).toEqual(["Client 10", "Client 11"]);
  });

  it("uses a stable ID tiebreaker when clients share the same creation timestamp", async () => {
    auth.isAdmin = true;
    const createdAt = new Date("2026-01-20T12:00:00Z");
    for (let index = 1; index <= 6; index += 1) {
      const id = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
      await seedCustomer(`Tied ${index}`, `tied${index}@example.com`, createdAt, id);
    }

    const first = await (await listClients(clientListRequest(1, 5))).json() as ClientListResponse;
    const second = await (await listClients(clientListRequest(2, 5))).json() as ClientListResponse;
    expect([...first.clients, ...second.clients].map((client) => client.name)).toEqual([
      "Tied 6", "Tied 5", "Tied 4", "Tied 3", "Tied 2", "Tied 1",
    ]);
    expect(new Set([...first.clients, ...second.clients].map((client) => client.id)).size).toBe(6);
  });

  it("validates pagination limits and returns an empty page beyond the final page", async () => {
    auth.isAdmin = true;
    await seedCustomer("Only Client", "only@example.com", new Date());
    expect((await listClients(clientListRequest(0, 20))).status).toBe(400);
    expect((await listClients(clientListRequest(1, 4))).status).toBe(400);
    expect((await listClients(clientListRequest(1, 101))).status).toBe(400);
    expect((await listClients(new Request("http://localhost/api/admin/clients?page=word&pageSize=20"))).status).toBe(400);

    const beyond = await (await listClients(clientListRequest(9, 5))).json() as ClientListResponse;
    expect(beyond.clients).toEqual([]);
    expect(beyond.pagination).toEqual({ page: 9, pageSize: 5, total: 1, totalPages: 1 });
  });
});

describe("on-demand client appointment history", () => {
  it("validates client IDs and returns an empty history for a missing client", async () => {
    auth.isAdmin = true;
    expect((await clientHistory(new Request("http://localhost"), context("not-a-uuid"))).status).toBe(400);
    const missing = await clientHistory(new Request("http://localhost"), context("00000000-0000-4000-8000-000000000001"));
    expect(await missing.json()).toEqual({ appointments: [] });
  });

  it("returns only the selected client's appointments in newest-first order", async () => {
    auth.isAdmin = true;
    const ownerId = await seedCustomer("History Owner", "owner@example.com", new Date());
    const otherId = await seedCustomer("Other Client", "other@example.com", new Date());
    await seedAppointment(ownerId, futureTime(0), "completed", "Old completed note", "phone");
    await seedAppointment(ownerId, futureTime(3), "confirmed", "Upcoming note", "web");
    await seedAppointment(ownerId, futureTime(2), "cancelled", "Cancelled note", "web");
    await seedAppointment(otherId, futureTime(4), "confirmed", "Must not leak", "web");

    const response = await clientHistory(new Request("http://localhost"), context(ownerId));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json() as { appointments: Array<{
      status: string; notes: string; source: string; customerEmail: string; serviceName: string;
    }> };
    expect(body.appointments.map((appointment) => appointment.status)).toEqual(["confirmed", "cancelled", "completed"]);
    expect(body.appointments.map((appointment) => appointment.notes)).toEqual(["Upcoming note", "Cancelled note", "Old completed note"]);
    expect(body.appointments[2]?.source).toBe("phone");
    expect(body.appointments.every((appointment) => appointment.customerEmail === "owner@example.com")).toBe(true);
    expect(body.appointments.every((appointment) => appointment.serviceName === "Smart-home consultation")).toBe(true);
  });
});

async function seedCustomer(name: string, email: string, createdAt: Date, id?: string) {
  const [customer] = id
    ? await testSql<{ id: string }[]>`
        INSERT INTO customers (id, email, name, created_at) VALUES (${id}, ${email}, ${name}, ${createdAt}) RETURNING id
      `
    : await testSql<{ id: string }[]>`
        INSERT INTO customers (email, name, created_at) VALUES (${email}, ${name}, ${createdAt}) RETURNING id
      `;
  return customer.id;
}

async function seedAppointment(
  customerId: string,
  startsAt: DateTime,
  status: "confirmed" | "completed" | "cancelled",
  notes: string,
  source = "web",
) {
  const [slot] = await testSql<{ id: string }[]>`
    INSERT INTO booking_slots (service_id, starts_at, ends_at, state)
    VALUES (${SERVICE_ID}, ${startsAt.toUTC().toJSDate()}, ${startsAt.plus({ hours: 1 }).toUTC().toJSDate()}, ${status === "confirmed" ? "confirmed" : "released"})
    RETURNING id
  `;
  await testSql`
    INSERT INTO appointments (slot_id, customer_id, status, notes, source)
    VALUES (${slot.id}, ${customerId}, ${status}, ${notes}, ${source})
  `;
}

function futureTime(dayOffset: number) {
  return DateTime.now().setZone("America/Toronto").plus({ days: 10 + dayOffset }).startOf("day").set({ hour: 9 });
}

function clientListRequest(page = 1, pageSize = 20) {
  return new Request(`http://localhost/api/admin/clients?page=${page}&pageSize=${pageSize}`);
}

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

type ClientListResponse = {
  clients: Array<{ id: string; name: string; appointmentCount: number }>;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};
