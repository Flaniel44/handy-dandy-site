"use client";

import { useEffect, useState } from "react";

const DEFAULT_GOOGLE_REVIEWS_URL = "https://share.google/VD1C5gAPBzR7oXF0Y";

type Review = {
  id: string;
  authorName: string;
  authorProfileUrl: string | null;
  authorPhotoUrl: string | null;
  rating: number;
  relativeDate: string;
  text: string;
  sourceUrl: string;
};

type ReviewsResponse = {
  configured: boolean;
  placeName: string;
  rating: number | null;
  reviewCount: number;
  reviewsUrl: string;
  reviews: Review[];
};

const EMPTY_REVIEWS: ReviewsResponse = {
  configured: false,
  placeName: "Digital Handyman",
  rating: null,
  reviewCount: 0,
  reviewsUrl: DEFAULT_GOOGLE_REVIEWS_URL,
  reviews: [],
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="review-stars" aria-label={`${rating} out of 5 stars`}>
      <span aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => index < Math.round(rating) ? "★" : "☆").join("")}
      </span>
    </span>
  );
}

export function GoogleReviews() {
  const [data, setData] = useState<ReviewsResponse>(EMPTY_REVIEWS);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/google-reviews", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Reviews unavailable")))
      .then((reviews: ReviewsResponse) => setData(reviews))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setData(EMPTY_REVIEWS);
        }
      });
    return () => controller.abort();
  }, []);

  const safeIndex = data.reviews.length ? activeIndex % data.reviews.length : 0;
  const review = data.reviews[safeIndex];
  const previous = () => setActiveIndex((safeIndex - 1 + data.reviews.length) % data.reviews.length);
  const next = () => setActiveIndex((safeIndex + 1) % data.reviews.length);

  return (
    <section id="google-reviews" className="landing-reviews" aria-labelledby="google-reviews-title">
      <div className="landing-reviews-heading">
        <div>
          <p className="eyebrow">Google Reviews</p>
          <h2 id="google-reviews-title">Kind words from clients.</h2>
        </div>
        {data.rating !== null && (
          <div className="reviews-summary">
            <strong>{data.rating.toFixed(1)}</strong>
            <Stars rating={data.rating} />
            <span>{data.reviewCount} {data.reviewCount === 1 ? "review" : "reviews"}</span>
          </div>
        )}
      </div>

      {review ? (
        <div className="reviews-carousel">
          <article className="review-card">
            <div className="review-author">
              {review.authorPhotoUrl ? (
                // Google supplies this image as part of the required reviewer attribution.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={review.authorPhotoUrl} alt="" />
              ) : (
                <span aria-hidden="true">{review.authorName.charAt(0)}</span>
              )}
              <div>
                {review.authorProfileUrl ? (
                  <a href={review.authorProfileUrl} target="_blank" rel="noreferrer">
                    {review.authorName}
                  </a>
                ) : (
                  <strong>{review.authorName}</strong>
                )}
                <small>{review.relativeDate}</small>
              </div>
            </div>
            <Stars rating={review.rating} />
            <blockquote>“{review.text}”</blockquote>
            <a className="review-source" href={review.sourceUrl} target="_blank" rel="noreferrer">
              Read this review on Google Maps <span aria-hidden="true">↗</span>
            </a>
          </article>

          {data.reviews.length > 1 && (
            <div className="reviews-carousel-controls">
              <button type="button" onClick={previous} aria-label="Previous review">←</button>
              <div aria-label={`Review ${safeIndex + 1} of ${data.reviews.length}`}>
                {data.reviews.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className={index === safeIndex ? "is-active" : ""}
                    onClick={() => setActiveIndex(index)}
                    aria-label={`Show review ${index + 1}`}
                    aria-current={index === safeIndex ? "true" : undefined}
                  />
                ))}
              </div>
              <button type="button" onClick={next} aria-label="Next review">→</button>
            </div>
          )}
          <p className="reviews-order-note">Reviews supplied by Google Maps and ordered by relevance.</p>
        </div>
      ) : (
        <div className="reviews-empty">
          <div className="landing-review-stars" aria-hidden="true">★★★★★</div>
          <h3>Reviews are coming soon.</h3>
          <p>Digital Handyman is just getting started. Be one of the first to share your experience.</p>
        </div>
      )}

      <a className="reviews-google-link" href={data.reviewsUrl} target="_blank" rel="noreferrer">
        View Digital Handyman on <span translate="no">Google Maps</span>
        <span aria-hidden="true">↗</span>
      </a>
    </section>
  );
}
