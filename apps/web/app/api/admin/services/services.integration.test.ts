import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetTestData } from "../../../../test/integration/database";

const SMART_HOME_SERVICE_ID = "22222222-2222-4222-8222-222222222222";
const TECH_SUPPORT_SERVICE_ID = "33333333-3333-4333-8333-333333333333";
const auth = vi.hoisted(() => ({ isAdmin: false }));

vi.mock("server-only", () => ({}));
vi.mock("../../../../lib/admin-auth", () => ({
  requireAdmin: vi.fn(() => auth.isAdmin ? { role: "admin", email: "admin@example.com" } : null),
}));
vi.mock("../../../../lib/google-calendar", () => ({ getGoogleBusyRanges: vi.fn().mockResolvedValue([]) }));

let testSql: ReturnType<typeof postgres>;
let listAdminServices: typeof import("./route").GET;
let createService: typeof import("./route").POST;
let updateService: typeof import("./[id]/route").PATCH;
let reorderServices: typeof import("./order/route").PUT;
let listPublicServices: typeof import("../../services/route").GET;

beforeAll(async () => {
  testSql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  ({ GET: listAdminServices, POST: createService } = await import("./route"));
  ({ PATCH: updateService } = await import("./[id]/route"));
  ({ PUT: reorderServices } = await import("./order/route"));
  ({ GET: listPublicServices } = await import("../../services/route"));
});

beforeEach(async () => {
  await resetTestData(testSql);
  auth.isAdmin = false;
});

afterAll(async () => {
  await testSql?.end();
});

describe("admin service management", () => {
  it("requires admin access to list, create, edit, or reorder services", async () => {
    expect((await listAdminServices()).status).toBe(401);
    expect((await createService(serviceRequest())).status).toBe(401);
    expect((await updateService(serviceRequest({ active: false }), context(SMART_HOME_SERVICE_ID))).status).toBe(401);
    expect((await reorderServices(orderRequest([SMART_HOME_SERVICE_ID, TECH_SUPPORT_SERVICE_ID]))).status).toBe(401);
  });

  it("lists active and disabled services with private no-store caching", async () => {
    auth.isAdmin = true;
    await testSql`UPDATE services SET active = false WHERE id = ${SMART_HOME_SERVICE_ID}`;
    const response = await listAdminServices();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json() as { services: Array<{ name: string; active: boolean; durationMinutes: number; priceCents: number }> };
    expect(body.services).toHaveLength(2);
    expect(body.services.find((service) => service.name === "Smart-home consultation")).toMatchObject({
      active: false, durationMinutes: 60, priceCents: 12500,
    });
  });

  it("creates a service and exposes it through the public catalog when active", async () => {
    auth.isAdmin = true;
    const response = await createService(serviceRequest());
    expect(response.status).toBe(201);
    const { service } = await response.json() as { service: { id: string; name: string; active: boolean; priceCents: number; sortOrder: number } };
    expect(service).toMatchObject({ name: "Home network tune-up", active: true, priceCents: 9900, sortOrder: 2 });

    const publicBody = await (await listPublicServices()).json() as { services: Array<{ id: string }> };
    expect(publicBody.services.some((item) => item.id === service.id)).toBe(true);
  });

  it("persists admin ordering and uses it in the public booking catalog", async () => {
    auth.isAdmin = true;
    const response = await reorderServices(orderRequest([TECH_SUPPORT_SERVICE_ID, SMART_HOME_SERVICE_ID]));
    expect(response.status).toBe(200);

    const adminBody = await (await listAdminServices()).json() as { services: Array<{ id: string; sortOrder: number }> };
    expect(adminBody.services.map((service) => service.id)).toEqual([TECH_SUPPORT_SERVICE_ID, SMART_HOME_SERVICE_ID]);
    expect(adminBody.services.map((service) => service.sortOrder)).toEqual([0, 1]);

    const publicBody = await (await listPublicServices()).json() as { services: Array<{ id: string }> };
    expect(publicBody.services.map((service) => service.id)).toEqual([TECH_SUPPORT_SERVICE_ID, SMART_HOME_SERVICE_ID]);
  });

  it("rejects incomplete, duplicate, or invalid service orders", async () => {
    auth.isAdmin = true;
    expect((await reorderServices(orderRequest([SMART_HOME_SERVICE_ID]))).status).toBe(400);
    expect((await reorderServices(orderRequest([SMART_HOME_SERVICE_ID, SMART_HOME_SERVICE_ID]))).status).toBe(400);
    expect((await reorderServices(orderRequest([SMART_HOME_SERVICE_ID, "not-a-uuid"]))).status).toBe(400);
  });

  it("updates duration, price, description, name, and active state without deleting the service", async () => {
    auth.isAdmin = true;
    const response = await updateService(jsonRequest("/api/admin/services/id", {
      name: "Smart Home Planning",
      description: "Plan devices, automations, and networking.",
      durationMinutes: 90,
      priceCents: 15000,
      active: false,
    }, "PATCH"), context(SMART_HOME_SERVICE_ID));
    expect(response.status).toBe(200);

    const [saved] = await testSql<{ name: string; description: string; duration_minutes: number; price_cents: number; active: boolean }[]>`
      SELECT name, description, duration_minutes, price_cents, active FROM services WHERE id = ${SMART_HOME_SERVICE_ID}
    `;
    expect(saved).toEqual({
      name: "Smart Home Planning", description: "Plan devices, automations, and networking.",
      duration_minutes: 90, price_cents: 15000, active: false,
    });
    const publicBody = await (await listPublicServices()).json() as { services: Array<{ id: string }> };
    expect(publicBody.services.some((item) => item.id === SMART_HOME_SERVICE_ID)).toBe(false);
  });

  it("validates service IDs, durations, prices, names, and empty updates", async () => {
    auth.isAdmin = true;
    expect((await createService(serviceRequest({ name: "x" }))).status).toBe(400);
    expect((await createService(serviceRequest({ durationMinutes: 14 }))).status).toBe(400);
    expect((await createService(serviceRequest({ durationMinutes: 481 }))).status).toBe(400);
    expect((await createService(serviceRequest({ priceCents: -1 }))).status).toBe(400);
    expect((await createService(serviceRequest({ priceCents: 12.5 }))).status).toBe(400);
    expect((await updateService(jsonRequest("/api/admin/services/id", {}, "PATCH"), context(SMART_HOME_SERVICE_ID))).status).toBe(400);
    expect((await updateService(serviceRequest({ active: false }), context("not-a-uuid"))).status).toBe(400);
    expect((await updateService(serviceRequest({ active: false }), context("00000000-0000-4000-8000-000000000099"))).status).toBe(404);
  });

  it("preserves historical appointments when their service is disabled", async () => {
    auth.isAdmin = true;
    const [customer] = await testSql<{ id: string }[]>`
      INSERT INTO customers (email, name) VALUES ('history@example.com', 'History Customer') RETURNING id
    `;
    const [slot] = await testSql<{ id: string }[]>`
      INSERT INTO booking_slots (service_id, starts_at, ends_at, state)
      VALUES (${SMART_HOME_SERVICE_ID}, '2026-08-20T13:00:00Z', '2026-08-20T14:00:00Z', 'released') RETURNING id
    `;
    await testSql`
      INSERT INTO appointments (slot_id, customer_id, status) VALUES (${slot.id}, ${customer.id}, 'completed')
    `;
    expect((await updateService(serviceRequest({ active: false }), context(SMART_HOME_SERVICE_ID))).status).toBe(200);
    const [{ count }] = await testSql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM appointments a
      JOIN booking_slots bs ON bs.id = a.slot_id
      JOIN services s ON s.id = bs.service_id
      WHERE s.id = ${SMART_HOME_SERVICE_ID} AND s.active = false
    `;
    expect(count).toBe(1);
  });
});

function serviceRequest(overrides: Record<string, unknown> = {}) {
  return jsonRequest("/api/admin/services", {
    name: "Home network tune-up",
    description: "Improve Wi-Fi coverage and reliability.",
    durationMinutes: 60,
    priceCents: 9900,
    active: true,
    ...overrides,
  }, "POST");
}

function jsonRequest(path: string, body: unknown, method: string) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function orderRequest(orderedIds: string[]) {
  return jsonRequest("/api/admin/services/order", { orderedIds }, "PUT");
}

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}
