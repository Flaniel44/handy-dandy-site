"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import type { AnimationEvent, MouseEvent, ReactNode } from "react";

type RouteTransitionDirection = "forward" | "back";
const DIRECTION_KEY = "digital-handyman-route-direction";
const SOURCE_KEY = "digital-handyman-route-source";
let activeScrollFrame: number | undefined;

function scrollToSection(section: HTMLElement) {
  if (activeScrollFrame !== undefined) window.cancelAnimationFrame(activeScrollFrame);

  const scroller = document.scrollingElement;
  if (!(scroller instanceof HTMLElement)) {
    section.scrollIntoView();
    return;
  }

  const startPosition = scroller.scrollTop;
  const scrollMargin = Number.parseFloat(window.getComputedStyle(section).scrollMarginTop) || 0;
  const requestedPosition = startPosition + section.getBoundingClientRect().top - scrollMargin;
  const maximumPosition = Math.max(0, scroller.scrollHeight - window.innerHeight);
  const endPosition = Math.min(maximumPosition, Math.max(0, requestedPosition));
  const distance = endPosition - startPosition;
  const duration = Math.min(950, Math.max(600, Math.abs(distance) * 0.42));
  const startedAt = window.performance.now();

  const animate = (currentTime: number) => {
    const progress = Math.min(1, (currentTime - startedAt) / duration);
    const easedProgress =
      progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    scroller.scrollTop = startPosition + distance * easedProgress;

    if (progress < 1) {
      activeScrollFrame = window.requestAnimationFrame(animate);
    } else {
      activeScrollFrame = undefined;
    }
  };

  activeScrollFrame = window.requestAnimationFrame(animate);
}

export function prepareRouteTransition(direction: RouteTransitionDirection) {
  window.sessionStorage.setItem(DIRECTION_KEY, direction);
  window.sessionStorage.setItem(SOURCE_KEY, window.location.pathname);
}

export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [direction, setDirection] = useState<RouteTransitionDirection>();

  useLayoutEffect(() => {
    const pendingDirection = window.sessionStorage.getItem(DIRECTION_KEY);
    const sourcePath = window.sessionStorage.getItem(SOURCE_KEY);
    const animationFrame = window.requestAnimationFrame(() => {
      if (
        sourcePath !== pathname &&
        (pendingDirection === "forward" || pendingDirection === "back")
      ) {
        setDirection(pendingDirection);
      } else {
        setDirection(undefined);
      }
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [pathname]);

  function finishTransition(event: AnimationEvent<HTMLDivElement>) {
    if (event.currentTarget !== event.target) return;
    window.sessionStorage.removeItem(DIRECTION_KEY);
    window.sessionStorage.removeItem(SOURCE_KEY);
    setDirection(undefined);
  }

  function handleNavigationClick(event: MouseEvent<HTMLDivElement>) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !(event.target instanceof Element)
    ) {
      return;
    }

    const link = event.target.closest<HTMLAnchorElement>("a[href]");
    if (!link || link.target === "_blank" || link.hasAttribute("download")) return;

    const destination = new URL(link.href, window.location.href);
    const isCurrentPage =
      destination.origin === window.location.origin &&
      destination.pathname === window.location.pathname &&
      destination.search === window.location.search;

    if (isCurrentPage && destination.hash) {
      const targetId = decodeURIComponent(destination.hash.slice(1));
      const section = document.getElementById(targetId);
      if (!section) return;

      event.preventDefault();
      scrollToSection(section);
      window.history.pushState(null, "", destination.hash);
      return;
    }

    if (link.matches(".site-home-link")) prepareRouteTransition("back");
  }

  return (
    <div
      key={pathname}
      className={`route-transition-frame${direction ? ` route-transition-${direction}` : ""}`}
      onAnimationEnd={finishTransition}
      onClickCapture={handleNavigationClick}
    >
      {children}
    </div>
  );
}
