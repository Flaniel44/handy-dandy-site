import { afterEach, describe, expect, it, vi } from "vitest";

import { publicUrl } from "./public-url";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("publicUrl", () => {
  it("uses the request origin during development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_URL", "https://whatisthis.place");

    expect(publicUrl(new Request("http://localhost:3000/api/auth/google/callback"), "/account").toString())
      .toBe("http://localhost:3000/account");
  });

  it("uses APP_URL instead of the internal container address in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://whatisthis.place");

    expect(publicUrl(new Request("http://0.0.0.0:3000/api/auth/google/callback"), "/account").toString())
      .toBe("https://whatisthis.place/account");
  });
});
