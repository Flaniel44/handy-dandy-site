"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { landingSceneMarkup } from "./landing-scene-markup";

const STORAGE_KEY = "handy-dandy-house-powered";
const ROOM_CLASSES = ["lamp1", "lamp2", "lamp3", "lamp4"] as const;

export function LandingScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const bookingPathRef = useRef("/book");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me").then((response) => response.json()).then((body) => {
      bookingPathRef.current = body.user?.role === "customer" ? "/account" : "/book";
    }).catch(() => undefined);
  }, []);
  useEffect(() => {
    const container = containerRef.current;
    const root = container?.querySelector<HTMLElement>("#scene-root");
    const chain = root?.querySelector<SVGGElement>("[data-action='toggle-light']");
    if (!container || !root || !chain) return;

    const demosButton = root.querySelector<HTMLButtonElement>("[data-action='demos']");
    if (demosButton) demosButton.textContent = "What's Possible?";

    const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    hitArea.setAttribute("x", "280");
    hitArea.setAttribute("y", "-45");
    hitArea.setAttribute("width", "120");
    hitArea.setAttribute("height", "175");
    hitArea.setAttribute("rx", "30");
    hitArea.setAttribute("fill", "transparent");
    hitArea.setAttribute("pointer-events", "all");
    hitArea.setAttribute("aria-hidden", "true");
    chain.prepend(hitArea);

    let restored = false;
    try {
      restored = window.sessionStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      // The scene remains usable when browser storage is unavailable.
    }

    if (restored) root.classList.add("lit", "session-restored", "ambient-ready");

    let readyTimer: number | undefined;
    const setPowered = (powered: boolean) => {
      root.classList.toggle("lit", powered);
      chain.setAttribute("aria-label", powered ? "Turn the house lights off" : "Turn the house lights on");
      window.clearTimeout(readyTimer);
      if (powered && !root.classList.contains("session-restored")) {
        root.classList.remove("ambient-ready");
        readyTimer = window.setTimeout(() => root.classList.add("ambient-ready"), 1900);
      } else if (!powered) {
        root.classList.remove("session-restored", "ambient-ready");
      }
      try {
        if (powered) window.sessionStorage.setItem(STORAGE_KEY, "true");
        else window.sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // Persistence is an enhancement, not a requirement for the interaction.
      }
    };

    const activate = (action: string) => {
      if (action === "toggle-light") setPowered(!root.classList.contains("lit"));
      if (action === "book") router.push(bookingPathRef.current);
      if (action === "demos") router.push("/demos");
      if (action === "contact") window.location.href = "mailto:hello@example.com";
    };

    const actionFrom = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLElement>("[data-action]")?.dataset.action : undefined;

    const onClick = (event: MouseEvent) => {
      const action = actionFrom(event.target);
      if (action) activate(action);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const action = actionFrom(event.target);
      if (action && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        activate(action);
      }
    };

    let previousRoom = -1;
    const flickerRandomRoom = () => {
      if (!root.classList.contains("lit")) return;
      let room = Math.floor(Math.random() * ROOM_CLASSES.length);
      if (room === previousRoom) room = (room + 1) % ROOM_CLASSES.length;
      previousRoom = room;

      const lights = Array.from(root.querySelectorAll<SVGElement>(`.${ROOM_CLASSES[room]}`));
      const setRoomLevel = (opacity: number, transition = "opacity 45ms linear") => {
        lights.forEach((light) => {
          light.style.setProperty("transition", transition, "important");
          light.style.setProperty("opacity", String(opacity), "important");
        });
      };

      // An uneven brown-out: two hard drops and a final weak stumble before recovery.
      setRoomLevel(.42, "opacity 35ms linear");
      window.setTimeout(() => setRoomLevel(.82), 145);
      window.setTimeout(() => setRoomLevel(.3, "opacity 25ms linear"), 260);
      window.setTimeout(() => setRoomLevel(.68), 400);
      window.setTimeout(() => setRoomLevel(.48, "opacity 30ms linear"), 515);
      window.setTimeout(() => setRoomLevel(1, "opacity 160ms ease-in"), 620);
      window.setTimeout(() => lights.forEach((light) => {
        light.style.removeProperty("opacity");
        light.style.removeProperty("transition");
      }), 850);
    };

    const ambientTimer = window.setInterval(flickerRandomRoom, 9000);
    container.addEventListener("click", onClick);
    container.addEventListener("keydown", onKeyDown);

    return () => {
      container.removeEventListener("click", onClick);
      container.removeEventListener("keydown", onKeyDown);
      window.clearInterval(ambientTimer);
      if (readyTimer) window.clearTimeout(readyTimer);
    };
  }, [router]);

  return (
    <main className="landing-page">
      <div
        ref={containerRef}
        className="landing-scene-shell"
        dangerouslySetInnerHTML={{ __html: landingSceneMarkup }}
      />
      <style>{`
        .scene-root.lit .lamp { animation: lampFlicker 1s steps(1, end) forwards !important; }
        .scene-root.lit .lamp1 { animation-delay: .2s !important; }
        .scene-root.lit .lamp2 { animation-delay: .4s !important; }
        .scene-root.lit .lamp3 { animation-delay: .6s !important; }
        .scene-root.lit .lamp4 { animation-delay: .8s !important; }
        .scene-root.lit.ambient-ready .lamp { animation: none !important; }
        .scene-root.lit.session-restored .hide { animation: none !important; opacity: 1; }
        .scene-root .data-wire-flow { animation-duration: 1.85s !important; }
      `}</style>
    </main>
  );
}
