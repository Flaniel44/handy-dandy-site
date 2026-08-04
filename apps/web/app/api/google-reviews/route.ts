import { NextResponse } from "next/server";

const DEFAULT_REVIEWS_URL = "https://share.google/VD1C5gAPBzR7oXF0Y";
const FIELD_MASK = "displayName,rating,userRatingCount,googleMapsUri,reviews";

type GooglePlaceResponse = {
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: Array<{
    name?: string;
    relativePublishTimeDescription?: string;
    rating?: number;
    text?: { text?: string };
    googleMapsUri?: string;
    authorAttribution?: {
      displayName?: string;
      uri?: string;
      photoUri?: string;
    };
  }>;
};

export async function GET() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  const configuredReviewsUrl = process.env.NEXT_PUBLIC_GOOGLE_REVIEWS_URL || DEFAULT_REVIEWS_URL;
  const isProduction = process.env.NODE_ENV === "production";

  if (!apiKey || !placeId) {
    return NextResponse.json(
      {
        configured: false,
        placeName: "Digital HandyDan",
        rating: null,
        reviewCount: 0,
        reviewsUrl: configuredReviewsUrl,
        reviews: [],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en-CA`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        ...(isProduction ? { next: { revalidate: 21_600 } } : { cache: "no-store" as const }),
      },
    );

    if (!response.ok) {
      console.error("Google Places reviews request failed", response.status);
      throw new Error("Google Places request failed");
    }

    const place = await response.json() as GooglePlaceResponse;
    const reviews = (place.reviews ?? [])
      .filter((review) => review.text?.text)
      .map((review, index) => ({
        id: review.name || `review-${index}`,
        authorName: review.authorAttribution?.displayName || "Google reviewer",
        authorProfileUrl: review.authorAttribution?.uri || null,
        authorPhotoUrl: review.authorAttribution?.photoUri || null,
        rating: review.rating || 5,
        relativeDate: review.relativePublishTimeDescription || "",
        text: review.text?.text || "",
        sourceUrl: review.googleMapsUri || place.googleMapsUri || configuredReviewsUrl,
      }));

    return NextResponse.json(
      {
        configured: true,
        placeName: place.displayName?.text || "Digital HandyDan",
        rating: place.rating ?? null,
        reviewCount: place.userRatingCount ?? reviews.length,
        reviewsUrl: place.googleMapsUri || configuredReviewsUrl,
        reviews,
      },
      {
        headers: {
          "Cache-Control": isProduction
            ? "public, s-maxage=21600, stale-while-revalidate=86400"
            : "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Unable to load Google reviews", error);
    return NextResponse.json(
      {
        configured: true,
        placeName: "Digital HandyDan",
        rating: null,
        reviewCount: 0,
        reviewsUrl: configuredReviewsUrl,
        reviews: [],
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}
