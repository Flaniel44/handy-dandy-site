import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

describe("GET /api/google-reviews", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns the empty state without calling Google when credentials are absent", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    vi.stubEnv("GOOGLE_PLACE_ID", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.configured).toBe(false);
    expect(body.reviews).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps Google Place reviews without exposing the API key", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "secret-key");
    vi.stubEnv("GOOGLE_PLACE_ID", "place-123");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      displayName: { text: "Digital HandyDan" },
      rating: 5,
      userRatingCount: 1,
      googleMapsUri: "https://maps.google.com/place",
      reviews: [{
        name: "places/place-123/reviews/review-1",
        rating: 5,
        text: { text: "Wonderful service." },
        relativePublishTimeDescription: "a week ago",
        googleMapsUri: "https://maps.google.com/review",
        authorAttribution: {
          displayName: "Test Client",
          uri: "https://maps.google.com/client",
          photoUri: "https://example.com/avatar.jpg",
        },
      }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET();
    const body = await response.json();

    expect(body.configured).toBe(true);
    expect(body.reviewCount).toBe(1);
    expect(body.reviews[0]).toMatchObject({
      authorName: "Test Client",
      rating: 5,
      text: "Wonderful service.",
      sourceUrl: "https://maps.google.com/review",
    });
    expect(JSON.stringify(body)).not.toContain("secret-key");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("places/place-123"),
      expect.objectContaining({
        cache: "no-store",
        headers: expect.objectContaining({ "X-Goog-Api-Key": "secret-key" }),
      }),
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
