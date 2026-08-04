"use client";

import { useEffect, useRef, useState } from "react";

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
  placeName: "Digital HandyDan",
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
  const [carouselVisible, setCarouselVisible] = useState(false);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/google-reviews", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Reviews unavailable")))
      .then((reviews: ReviewsResponse) => setData(reviews))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setData(EMPTY_REVIEWS);
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel || data.reviews.length < 2) return;
    const observer = new IntersectionObserver(
      ([entry]) => setCarouselVisible(entry.isIntersecting && entry.intersectionRatio >= 0.35),
      { threshold: [0, 0.35, 1] },
    );
    observer.observe(carousel);
    return () => observer.disconnect();
  }, [data.reviews.length]);

  useEffect(() => {
    if (!carouselVisible || interactionPaused || userPaused || data.reviews.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % data.reviews.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeIndex, carouselVisible, data.reviews.length, interactionPaused, userPaused]);

  const safeIndex = data.reviews.length ? activeIndex % data.reviews.length : 0;
  const review = data.reviews[safeIndex];
  const previousIndex = data.reviews.length ? (safeIndex - 1 + data.reviews.length) % data.reviews.length : 0;
  const nextIndex = data.reviews.length ? (safeIndex + 1) % data.reviews.length : 0;
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
        <div
          ref={carouselRef}
          className="reviews-carousel"
          onMouseEnter={() => setInteractionPaused(true)}
          onMouseLeave={() => setInteractionPaused(false)}
          onFocusCapture={() => setInteractionPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInteractionPaused(false);
          }}
        >
          <div
            className="reviews-carousel-stage"
            aria-live="polite"
            onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
            onTouchEnd={(event) => {
              const startX = touchStartX.current;
              const endX = event.changedTouches[0]?.clientX;
              touchStartX.current = null;
              if (startX === null || endX === undefined || data.reviews.length < 2) return;
              const distance = endX - startX;
              if (Math.abs(distance) < 45) return;
              if (distance > 0) previous();
              else next();
            }}
          >
            {data.reviews.map((item, index) => {
              const isActive = index === safeIndex;
              const isPrevious = data.reviews.length > 2 && index === previousIndex;
              const isNext = data.reviews.length > 1 && index === nextIndex;
              const position = isActive
                ? "is-active"
                : isPrevious
                  ? "is-previous"
                  : isNext
                    ? "is-next"
                    : "is-hidden";

              return (
                <article key={item.id} className={`review-card ${position}`} aria-hidden={position === "is-hidden" || undefined}>
                  <div className="review-author">
                    {item.authorPhotoUrl ? (
                      // Google supplies this image as part of the required reviewer attribution.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.authorPhotoUrl} alt="" />
                    ) : (
                      <span aria-hidden="true">{item.authorName.charAt(0)}</span>
                    )}
                    <div>
                      {item.authorProfileUrl ? (
                        <a href={item.authorProfileUrl} target="_blank" rel="noreferrer" tabIndex={isActive ? 0 : -1}>
                          {item.authorName}
                        </a>
                      ) : (
                        <strong>{item.authorName}</strong>
                      )}
                      <small>{item.relativeDate}</small>
                    </div>
                  </div>
                  <Stars rating={item.rating} />
                  <blockquote>“{item.text}”</blockquote>
                  <a className="review-source" href={item.sourceUrl} target="_blank" rel="noreferrer" tabIndex={isActive ? 0 : -1}>
                    Read this review on Google Maps <span aria-hidden="true">↗</span>
                  </a>
                  {!isActive && (isPrevious || isNext) && (
                    <button
                      className="review-card-select"
                      type="button"
                      onClick={() => setActiveIndex(index)}
                      aria-label={`${isPrevious ? "Show previous" : "Show next"} review by ${item.authorName}`}
                    />
                  )}
                </article>
              );
            })}
          </div>

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
              <button
                type="button"
                className="reviews-autoplay-toggle"
                onClick={() => setUserPaused((paused) => !paused)}
                aria-label={userPaused ? "Resume automatic review rotation" : "Pause automatic review rotation"}
                aria-pressed={userPaused}
              >
                <span aria-hidden="true">{userPaused ? "▶" : "Ⅱ"}</span>
              </button>
            </div>
          )}
          <p className="reviews-order-note">Reviews supplied by Google Maps and ordered by relevance.</p>
        </div>
      ) : (
        <div className="reviews-empty">
          <div className="landing-review-stars" aria-hidden="true">★★★★★</div>
          <h3>Reviews are coming soon.</h3>
          <p>Digital HandyDan is just getting started. Be one of the first to share your experience.</p>
        </div>
      )}

      <a className="reviews-google-link" href={data.reviewsUrl} target="_blank" rel="noreferrer">
        View Digital HandyDan on <span translate="no">Google Maps</span>
        <span aria-hidden="true">↗</span>
      </a>
    </section>
  );
}
