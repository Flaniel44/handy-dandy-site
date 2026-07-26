import { describe, expect, it } from "vitest";

import { hasDatabaseErrorCode, isBookingConflictError } from "./errors";

describe("database error classification", () => {
  it.each(["23P01", "40P01", "40001"])(
    "treats PostgreSQL %s as a booking conflict",
    (code) => {
      expect(isBookingConflictError({ code })).toBe(true);
    },
  );

  it("finds a booking conflict wrapped by the database adapter", () => {
    const error = new Error("Query failed", {
      cause: { code: "23P01" },
    });

    expect(isBookingConflictError(error)).toBe(true);
    expect(hasDatabaseErrorCode(error, "23P01")).toBe(true);
  });

  it("does not hide unrelated database failures", () => {
    expect(isBookingConflictError({ code: "28P01" })).toBe(false);
    expect(isBookingConflictError(new Error("Connection unavailable"))).toBe(false);
  });
});
