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

    const houseScene = root.querySelector<SVGGElement>(".house-scene");
    if (houseScene && !houseScene.querySelector(".robot-vacuum-runner")) {
      const vacuumStyles = document.createElement("style");
      vacuumStyles.textContent = `
        .robot-vacuum-runner {
          animation: vacuumPatrol 14s linear infinite;
          animation-play-state: paused;
        }
        .robot-vacuum-body {
          animation: vacuumFace 14s steps(1, end) infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
        .vacuum-wifi-wave {
          animation: vacuumWifi 2.4s ease-out infinite;
          animation-play-state: paused;
          fill: none;
          opacity: 0;
          stroke: #c7cad5;
          stroke-linecap: round;
          stroke-width: 1.8;
        }
        .vacuum-wifi-wave.wave-outer { animation-delay: .35s; }
        .scene-root.lit .robot-vacuum-runner,
        .scene-root.lit .vacuum-wifi-wave { animation-play-state: running; }
        @keyframes vacuumPatrol {
          0%, 8% { transform: translateX(0); }
          44%, 56% { transform: translateX(132px); }
          92%, 100% { transform: translateX(0); }
        }
        @keyframes vacuumFace {
          0%, 49.99% { transform: scaleX(1); }
          50%, 99.99% { transform: scaleX(-1); }
        }
        @keyframes vacuumWifi {
          0%, 15%, 100% { opacity: 0; transform: translateY(2px); }
          35%, 65% { opacity: .9; }
          82% { opacity: 0; transform: translateY(-3px); }
        }
      `;
      root.append(vacuumStyles);
      houseScene.insertAdjacentHTML(
        "beforeend",
        `<g transform="translate(317 385)">
          <g class="robot-vacuum-runner">
            <g class="robot-vacuum-body">
              <rect x="0" y="4" width="30" height="10" rx="2.5" fill="#151a2c" stroke="#7f77dd" stroke-width="2.2" />
              <path d="M2 5 Q15 1 28 5" fill="none" stroke="#7f77dd" stroke-width="1.6" />
              <rect x="11" y="2" width="8" height="3" rx="1.5" fill="#5a6080" />
              <circle cx="24" cy="8" r="1.6" fill="#f59842" />
            </g>
            <g transform="translate(15 0)">
              <path class="vacuum-wifi-wave" d="M-4 -4 Q0 -8 4 -4" />
              <path class="vacuum-wifi-wave wave-outer" d="M-8 -7 Q0 -15 8 -7" />
            </g>
          </g>
        </g>`,
      );
    }

    const demosButton = root.querySelector<HTMLButtonElement>("[data-action='demos']");
    if (demosButton) demosButton.textContent = "What's Possible?";

    const sceneSvg = root.querySelector<SVGSVGElement>(".stage > svg");
    const mobileScene = window.matchMedia("(max-width: 620px)");
    const syncSceneViewport = () => sceneSvg?.setAttribute("viewBox", mobileScene.matches ? "170 0 340 460" : "0 0 680 460");
    syncSceneViewport();
    mobileScene.addEventListener("change", syncSceneViewport);

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
    document.body.classList.toggle("landing-lights-off", !restored);

    let readyTimer: number | undefined;
    const setPowered = (powered: boolean) => {
      root.classList.toggle("lit", powered);
      document.body.classList.toggle("landing-lights-off", !powered);
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

    const beads = Array.from(chain.querySelectorAll<SVGCircleElement>(":scope > circle"));
    const handle = Array.from(chain.querySelectorAll<SVGRectElement>(":scope > rect")).find((rect) => rect !== hitArea);
    const points = [
      ...beads.map((bead) => ({ x: Number(bead.getAttribute("cx")), y: Number(bead.getAttribute("cy")), oldX: Number(bead.getAttribute("cx")), oldY: Number(bead.getAttribute("cy")) })),
      { x: 340, y: 103, oldX: 340, oldY: 103 },
    ];
    const restingPoints = points.map((point) => ({ x: point.x, y: point.y }));
    const segmentLengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
    let pullStartX: number | undefined;
    let pullStartY: number | undefined;
    let pullDistance = 0;
    let suppressTouchClick = false;
    let previousMouseX: number | undefined;
    let ropeFrame: number | undefined;
    let grabbed = false;
    let grabX = points.at(-1)!.x;
    let grabY = points.at(-1)!.y;
    let settledFrames = 0;
    let mousePull = false;

    const svgScale = () => {
      const svg = chain.ownerSVGElement;
      return svg ? svg.viewBox.baseVal.width / svg.getBoundingClientRect().width : 1;
    };

    const renderRope = () => {
      beads.forEach((bead, index) => {
        bead.setAttribute("cx", points[index].x.toFixed(2));
        bead.setAttribute("cy", points[index].y.toFixed(2));
      });
      if (!handle) return;
      const end = points.at(-1)!;
      const previous = points.at(-2)!;
      const angle = Math.atan2(end.y - previous.y, end.x - previous.x) * 180 / Math.PI - 90;
      handle.setAttribute("x", (end.x - 7).toFixed(2));
      handle.setAttribute("y", (end.y - 11).toFixed(2));
      handle.setAttribute("transform", `rotate(${angle} ${end.x} ${end.y})`);
    };

    const simulateRope = () => {
      let energy = 0;
      for (let index = 1; index < points.length; index += 1) {
        const point = points[index];
        if (grabbed && index === points.length - 1) {
          point.x = grabX; point.y = grabY; point.oldX = grabX; point.oldY = grabY;
          continue;
        }
        const velocityX = (point.x - point.oldX) * .985;
        const velocityY = (point.y - point.oldY) * .985;
        point.oldX = point.x; point.oldY = point.y;
        point.x += velocityX; point.y += velocityY + .16;
        energy += Math.abs(velocityX) + Math.abs(velocityY);
      }
      for (let iteration = 0; iteration < 7; iteration += 1) {
        points[0].x = restingPoints[0].x; points[0].y = restingPoints[0].y;
        for (let index = 0; index < segmentLengths.length; index += 1) {
          const first = points[index]; const second = points[index + 1];
          const dx = second.x - first.x; const dy = second.y - first.y;
          const distance = Math.hypot(dx, dy) || 1;
          const correction = (distance - segmentLengths[index]) / distance;
          const firstWeight = index === 0 ? 0 : 1;
          const secondWeight = grabbed && index + 1 === points.length - 1 ? 0 : 1;
          const weight = firstWeight + secondWeight || 1;
          first.x += dx * correction * firstWeight / weight; first.y += dy * correction * firstWeight / weight;
          second.x -= dx * correction * secondWeight / weight; second.y -= dy * correction * secondWeight / weight;
        }
        if (grabbed) { points.at(-1)!.x = grabX; points.at(-1)!.y = grabY; }
      }
      renderRope();
      settledFrames = !grabbed && energy < .025 ? settledFrames + 1 : 0;
      if (settledFrames > 12) {
        points.forEach((point, index) => Object.assign(point, { ...restingPoints[index], oldX: restingPoints[index].x, oldY: restingPoints[index].y }));
        renderRope(); ropeFrame = undefined; return;
      }
      ropeFrame = window.requestAnimationFrame(simulateRope);
    };

    const startRope = () => { if (ropeFrame === undefined) ropeFrame = window.requestAnimationFrame(simulateRope); };

    const onScenePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || grabbed) return;
      const bounds = chain.getBoundingClientRect();
      if (previousMouseX !== undefined && event.clientY >= bounds.top - 10 && event.clientY <= bounds.bottom + 20
        && event.clientX >= bounds.left - 40 && event.clientX <= bounds.right + 40) {
        const movement = event.clientX - previousMouseX;
        if (Math.abs(movement) > .4) {
          const relativeY = (event.clientY - bounds.top) / Math.max(1, bounds.height);
          const index = Math.max(1, Math.min(points.length - 1, Math.round(relativeY * (points.length - 1))));
          points[index].oldX -= movement * svgScale() * .32;
          startRope();
        }
      }
      previousMouseX = event.clientX;
    };

    const onPointerDown = (event: PointerEvent) => {
      const end = points.at(-1)!;
      pullStartX = event.clientX; pullStartY = event.clientY; pullDistance = 0; grabbed = true;
      mousePull = event.pointerType === "mouse";
      grabX = end.x; grabY = end.y + (mousePull ? 18 * svgScale() : 0);
      suppressTouchClick = event.pointerType !== "mouse";
      chain.setPointerCapture(event.pointerId); startRope();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!grabbed || pullStartX === undefined || pullStartY === undefined) return;
      event.preventDefault();
      const scale = svgScale();
      const downwardTravel = Math.max(0, event.clientY - pullStartY);
      pullDistance = Math.min(86, downwardTravel * .78);
      grabX = restingPoints.at(-1)!.x + (event.clientX - pullStartX) * scale * .65;
      grabY = restingPoints.at(-1)!.y + (mousePull ? 18 + pullDistance : pullDistance) * scale;
    };

    const releasePullChain = (event: PointerEvent) => {
      if (!grabbed) return;
      const shouldToggle = event.type === "pointerup" && event.pointerType !== "mouse" && pullDistance >= 42;
      grabbed = false; mousePull = false; pullStartX = undefined; pullStartY = undefined;
      if (chain.hasPointerCapture(event.pointerId)) chain.releasePointerCapture(event.pointerId);
      startRope();
      if (shouldToggle) setPowered(!root.classList.contains("lit"));
    };

    const onClick = (event: MouseEvent) => {
      const action = actionFrom(event.target);
      if (action === "toggle-light" && suppressTouchClick) {
        suppressTouchClick = false;
        return;
      }
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
    container.addEventListener("pointermove", onScenePointerMove);
    chain.addEventListener("pointerdown", onPointerDown);
    chain.addEventListener("pointermove", onPointerMove);
    chain.addEventListener("pointerup", releasePullChain);
    chain.addEventListener("pointercancel", releasePullChain);

    return () => {
      container.removeEventListener("click", onClick);
      container.removeEventListener("keydown", onKeyDown);
      container.removeEventListener("pointermove", onScenePointerMove);
      chain.removeEventListener("pointerdown", onPointerDown);
      chain.removeEventListener("pointermove", onPointerMove);
      chain.removeEventListener("pointerup", releasePullChain);
      chain.removeEventListener("pointercancel", releasePullChain);
      mobileScene.removeEventListener("change", syncSceneViewport);
      document.body.classList.remove("landing-lights-off");
      window.clearInterval(ambientTimer);
      if (ropeFrame !== undefined) window.cancelAnimationFrame(ropeFrame);
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
