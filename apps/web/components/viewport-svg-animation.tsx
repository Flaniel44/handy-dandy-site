"use client";

import { useEffect, useRef, useState } from "react";

export function ViewportSvgAnimation({ src, label }: { src: string; label: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [markup, setMarkup] = useState<string>();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.08 },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || markup) return;
    const controller = new AbortController();
    fetch(src, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load demo animation");
        return response.text();
      })
      .then(setMarkup)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error(error);
        }
      });
    return () => controller.abort();
  }, [isVisible, markup, src]);

  return (
    <div
      ref={containerRef}
      className="possibility-demo-animation"
      role="img"
      aria-label={label}
    >
      {isVisible && markup ? (
        <div
          className="possibility-demo-animation-svg"
          dangerouslySetInnerHTML={{ __html: markup }}
        />
      ) : null}
    </div>
  );
}
