"use client";

import { useEffect, useRef, useState } from "react";

function renderShadowAnimation(host: HTMLDivElement, markup?: string) {
  const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
  if (!markup) {
    shadow.replaceChildren();
    return;
  }

  const style = document.createElement("style");
  style.textContent = `
    :host { display: block; width: 100%; height: 100%; }
    svg { display: block; width: 100%; height: 100%; }
  `;
  const template = document.createElement("template");
  template.innerHTML = markup;
  shadow.replaceChildren(style, template.content.cloneNode(true));
}

function setupDeclarativeToggle(host: HTMLDivElement) {
  const root = host.shadowRoot?.querySelector<SVGElement>("[data-auto-toggle]");
  if (!root) return;

  const states = root.getAttribute("data-auto-toggle")?.trim().split(/\s+/) || [];
  if (states.length < 2) return;

  const toggle = () => {
    const currentIndex = states.indexOf(root.getAttribute("data-state") || "");
    root.setAttribute("data-state", states[(currentIndex + 1) % states.length]);
  };
  const control = root.querySelector("[data-auto-toggle-control]");
  control?.addEventListener("click", toggle);

  const requestedInterval = Number(root.getAttribute("data-auto-toggle-interval"));
  const interval = window.setInterval(
    toggle,
    Number.isFinite(requestedInterval) && requestedInterval >= 1000 ? requestedInterval : 7000,
  );

  return () => {
    window.clearInterval(interval);
    control?.removeEventListener("click", toggle);
  };
}

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

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;
    renderShadowAnimation(host, isVisible ? markup : undefined);
    if (isVisible && markup) return setupDeclarativeToggle(host);
  }, [isVisible, markup]);

  return (
    <div
      ref={containerRef}
      className="possibility-demo-animation"
      role="img"
      aria-label={label}
    />
  );
}
