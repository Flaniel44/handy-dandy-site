import { afterEach, describe, expect, it, vi } from "vitest";

import { areNewBookingsEnabled, bookingsClosedResponse, BOOKINGS_CLOSED_MESSAGE } from "./booking-status";

describe("booking status", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("fails closed in production unless bookings are explicitly enabled", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BOOKINGS_ENABLED", "");
    expect(areNewBookingsEnabled()).toBe(false);

    vi.stubEnv("BOOKINGS_ENABLED", "true");
    expect(areNewBookingsEnabled()).toBe(true);
  });

  it("keeps development and tests enabled unless explicitly disabled", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("BOOKINGS_ENABLED", "");
    expect(areNewBookingsEnabled()).toBe(true);

    vi.stubEnv("BOOKINGS_ENABLED", "false");
    expect(areNewBookingsEnabled()).toBe(false);
  });

  it("returns a machine-readable temporary closure response", async () => {
    const response = bookingsClosedResponse();
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("3600");
    await expect(response.json()).resolves.toEqual({ error: BOOKINGS_CLOSED_MESSAGE, code: "BOOKINGS_CLOSED" });
  });
});
