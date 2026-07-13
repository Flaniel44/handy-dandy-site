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
      const actions = containerRef.current?.querySelector<HTMLElement>(".cta-row");
      const existingAdminButton = actions?.querySelector<HTMLButtonElement>("[data-action='admin']");

      if (body.user?.role === "admin" && actions && !existingAdminButton) {
        const adminButton = document.createElement("button");
        adminButton.type = "button";
        adminButton.dataset.action = "admin";
        adminButton.textContent = "Admin";
        actions.append(adminButton);
      } else if (body.user?.role !== "admin") {
        existingAdminButton?.remove();
      }
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
        .camera-wifi-wave {
          animation: cameraWifi 3.2s ease-out infinite;
          animation-play-state: paused;
          fill: none;
          opacity: 0;
          stroke: #c7cad5;
          stroke-linecap: round;
          stroke-width: 1.15;
        }
        .camera-wifi-wave.wave-outer { animation-delay: .32s; }
        .scene-root.lit .camera-wifi-wave { animation-play-state: running; }
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
        @keyframes cameraWifi {
          0%, 18%, 100% { opacity: 0; transform: translateY(1px); }
          38%, 62% { opacity: .82; }
          80% { opacity: 0; transform: translateY(-2px); }
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
        </g>
        <g class="tracking-camera bathroom-camera" transform="translate(483 306) scale(1.15)">
          <rect x="0" y="7" width="4" height="17" rx="1.5" fill="#5a6080" />
          <path d="M4 17 H8 L12 13" fill="none" stroke="#7f77dd" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
          <g class="camera-aim">
            <path d="M12 13 L16 7 H29 Q32 7 32 10 V16 Q32 19 29 19 H16 Z" fill="#7f77dd" />
            <rect x="29" y="10" width="5" height="6" rx="1.4" fill="#151a2c" stroke="#7f77dd" stroke-width="1.2" />
            <circle cx="31.5" cy="13" r="1.25" fill="#080a12" />
            <circle cx="18" cy="11" r="1.2" fill="#f59842" />
          </g>
          <circle cx="12" cy="13" r="3.5" fill="#5a6080" stroke="#a9adb8" stroke-width="1.4" />
          <circle cx="12" cy="13" r="1.25" fill="#232b47" />
          <g transform="translate(15 1)">
            <path class="camera-wifi-wave" d="M-2.5 -1.5 Q0 -4 2.5 -1.5" />
            <path class="camera-wifi-wave wave-outer" d="M-5 -3 Q0 -8 5 -3" />
          </g>
        </g>
        <g class="tracking-camera bedroom-camera" transform="translate(197 306) scale(-1.15 1.15)">
          <rect x="0" y="7" width="4" height="17" rx="1.5" fill="#5a6080" />
          <path d="M4 17 H8 L12 13" fill="none" stroke="#7f77dd" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
          <g class="camera-aim">
            <path d="M12 13 L16 7 H29 Q32 7 32 10 V16 Q32 19 29 19 H16 Z" fill="#7f77dd" />
            <rect x="29" y="10" width="5" height="6" rx="1.4" fill="#151a2c" stroke="#7f77dd" stroke-width="1.2" />
            <circle cx="31.5" cy="13" r="1.25" fill="#080a12" />
            <circle cx="18" cy="11" r="1.2" fill="#f59842" />
          </g>
          <circle cx="12" cy="13" r="3.5" fill="#5a6080" stroke="#a9adb8" stroke-width="1.4" />
          <circle cx="12" cy="13" r="1.25" fill="#232b47" />
          <g transform="translate(15 1)">
            <path class="camera-wifi-wave" d="M-2.5 -1.5 Q0 -4 2.5 -1.5" />
            <path class="camera-wifi-wave wave-outer" d="M-5 -3 Q0 -8 5 -3" />
          </g>
        </g>`,
      );
    }

    const demosButton = root.querySelector<HTMLButtonElement>("[data-action='demos']");
    if (demosButton) demosButton.textContent = "What's Possible?";

    const sceneSvg = root.querySelector<SVGSVGElement>(".stage > svg");
    let chainHint = sceneSvg?.querySelector<SVGGElement>(".chain-hint");
    if (sceneSvg && !chainHint) {
      chainHint = document.createElementNS("http://www.w3.org/2000/svg", "g");
      chainHint.setAttribute("class", "chain-hint");
      chainHint.setAttribute("aria-hidden", "true");
      chainHint.innerHTML = `
        <text x="390" y="67" transform="rotate(-5 390 67)">(pull me)</text>
        <path d="M389 75 C374 77 359 85 350 101" />
        <path d="M350 101 L351 91 M350 101 L360 97" />
      `;
      sceneSvg.append(chainHint);
    }
    const cameraTrackers = Array.from(root.querySelectorAll<SVGGElement>(".tracking-camera")).map((camera, index) => ({
      camera,
      aim: camera.querySelector<SVGGElement>(".camera-aim"),
      currentAngle: 0,
      targetAngle: 0,
      trackingUntil: 0,
      phase: index * Math.PI * .75,
    }));
    const mobileScene = window.matchMedia("(max-width: 620px)");
    const syncSceneViewport = () => sceneSvg?.setAttribute("viewBox", mobileScene.matches ? "170 0 340 460" : "0 0 680 460");
    syncSceneViewport();
    mobileScene.addEventListener("change", syncSceneViewport);

    let hitArea = chain.querySelector<SVGRectElement>(":scope > rect[data-chain-hit-area]");
    if (!hitArea) {
      hitArea = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      hitArea.setAttribute("data-chain-hit-area", "true");
      hitArea.setAttribute("x", "307");
      hitArea.setAttribute("y", "-45");
      hitArea.setAttribute("width", "66");
      hitArea.setAttribute("height", "175");
      hitArea.setAttribute("rx", "30");
      hitArea.setAttribute("fill", "transparent");
      hitArea.setAttribute("pointer-events", "all");
      hitArea.setAttribute("aria-hidden", "true");
      chain.prepend(hitArea);
    }

    let restored = false;
    try {
      restored = window.sessionStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      // The scene remains usable when browser storage is unavailable.
    }

    if (restored) root.classList.add("lit", "session-restored", "ambient-ready");
    document.body.classList.toggle("landing-lights-off", !restored);

    let readyTimer: number | undefined;
    let hintTimer: number | undefined;
    if (!restored) hintTimer = window.setTimeout(() => root.classList.add("chain-hint-visible"), 10_000);
    const setPowered = (powered: boolean) => {
      root.classList.toggle("lit", powered);
      document.body.classList.toggle("landing-lights-off", !powered);
      chain.setAttribute("aria-label", powered ? "Turn the house lights off" : "Turn the house lights on");
      window.clearTimeout(readyTimer);
      if (powered) {
        window.clearTimeout(hintTimer);
        root.classList.remove("chain-hint-visible");
      }
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
      if (action === "admin") router.push("/admin");
      if (action === "contact") window.location.href = "mailto:hello@example.com";
    };

    const actionFrom = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLElement>("[data-action]")?.dataset.action : undefined;

    const beads = Array.from(chain.querySelectorAll<SVGCircleElement>(":scope > circle"));
    const handle = chain.querySelector<SVGRectElement>(":scope > rect:not([data-chain-hit-area])");
    const points = [
      ...beads.map((_, index) => {
        const x = 340;
        const y = -40 + index * 11;
        return { x, y, oldX: x, oldY: y };
      }),
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
    let gravityX = 0;
    let gravityY = 1;
    let motionListening = false;
    let motionPermissionRequested = false;
    let cameraFrame: number | undefined;

    const animateCameras = (time: number) => {
      cameraTrackers.forEach((tracker) => {
        if (!tracker.aim) return;
        const desiredAngle = time < tracker.trackingUntil ? tracker.targetAngle : Math.sin(time / 1500 + tracker.phase) * 12;
        tracker.currentAngle += (desiredAngle - tracker.currentAngle) * .075;
        tracker.aim.setAttribute("transform", `rotate(${tracker.currentAngle.toFixed(2)} 12 13)`);
      });
      cameraFrame = window.requestAnimationFrame(animateCameras);
    };
    cameraFrame = window.requestAnimationFrame(animateCameras);

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
        point.x += velocityX + gravityX * .16;
        point.y += velocityY + gravityY * .16;
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
        if (!motionListening) points.forEach((point, index) => Object.assign(point, { ...restingPoints[index], oldX: restingPoints[index].x, oldY: restingPoints[index].y }));
        renderRope(); ropeFrame = undefined; return;
      }
      ropeFrame = window.requestAnimationFrame(simulateRope);
    };

    const startRope = () => { if (ropeFrame === undefined) ropeFrame = window.requestAnimationFrame(simulateRope); };

    const onDeviceMotion = (event: DeviceMotionEvent) => {
      const acceleration = event.accelerationIncludingGravity;
      if (acceleration?.x == null || acceleration.y == null) return;
      const rawX = Math.max(-1.2, Math.min(1.2, acceleration.x / 9.81));
      const rawY = Math.max(-1.2, Math.min(1.2, -acceleration.y / 9.81));
      const orientation = ((screen.orientation?.angle ?? 0) * Math.PI) / 180;
      const screenX = rawX * Math.cos(orientation) + rawY * Math.sin(orientation);
      const screenY = -rawX * Math.sin(orientation) + rawY * Math.cos(orientation);
      gravityX = gravityX * .82 + screenX * .18;
      gravityY = gravityY * .82 + screenY * .18;
      startRope();
    };

    const startMotionTracking = async () => {
      if (!mobileScene.matches || motionListening || motionPermissionRequested || typeof window.DeviceMotionEvent === "undefined") return;
      motionPermissionRequested = true;
      const motionEvent = window.DeviceMotionEvent as typeof DeviceMotionEvent & { requestPermission?: () => Promise<"granted" | "denied"> };
      try {
        const permission = motionEvent.requestPermission ? await motionEvent.requestPermission() : "granted";
        if (permission === "granted") {
          window.addEventListener("devicemotion", onDeviceMotion);
          motionListening = true;
        }
      } catch {
        // Fixed downward gravity remains available when motion access is denied.
      }
    };

    if (mobileScene.matches && typeof window.DeviceMotionEvent !== "undefined"
      && !(window.DeviceMotionEvent as typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> }).requestPermission) {
      void startMotionTracking();
    }

    const onScenePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse") {
        cameraTrackers.forEach((tracker) => {
          const { camera } = tracker;
          const matrix = camera.getScreenCTM();
          if (!matrix || !tracker.aim) return;
          const target = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
          const targetAngle = Math.atan2(target.y - 13, target.x - 12) * 180 / Math.PI;
          const insideVisionCone = target.x > 12 && targetAngle >= -50 && targetAngle <= 50;
          if (insideVisionCone) {
            tracker.targetAngle = Math.max(-38, Math.min(42, targetAngle));
            tracker.trackingUntil = performance.now() + 1400;
          } else {
            tracker.trackingUntil = 0;
          }
        });
      }
      if (event.pointerType !== "mouse" || grabbed) return;
      const svg = chain.ownerSVGElement;
      const matrix = svg?.getScreenCTM();
      if (previousMouseX !== undefined && matrix) {
        const cursor = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
        let closestIndex = 1;
        let closestDistance = Number.POSITIVE_INFINITY;
        points.forEach((point, index) => {
          if (index === 0) return;
          const distance = Math.hypot(cursor.x - point.x, cursor.y - point.y);
          if (distance < closestDistance) { closestDistance = distance; closestIndex = index; }
        });
        const movement = event.clientX - previousMouseX;
        if (closestDistance <= 12 && Math.abs(movement) > .4) {
          points[closestIndex].oldX -= movement * svgScale() * .32;
          startRope();
        }
      }
      previousMouseX = event.clientX;
    };

    const resetCameraAim = () => cameraTrackers.forEach((tracker) => { tracker.trackingUntil = 0; });

    const onPointerDown = (event: PointerEvent) => {
      void startMotionTracking();
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
    container.addEventListener("pointerleave", resetCameraAim);
    chain.addEventListener("pointerdown", onPointerDown);
    chain.addEventListener("pointermove", onPointerMove);
    chain.addEventListener("pointerup", releasePullChain);
    chain.addEventListener("pointercancel", releasePullChain);

    return () => {
      container.removeEventListener("click", onClick);
      container.removeEventListener("keydown", onKeyDown);
      container.removeEventListener("pointermove", onScenePointerMove);
      container.removeEventListener("pointerleave", resetCameraAim);
      chain.removeEventListener("pointerdown", onPointerDown);
      chain.removeEventListener("pointermove", onPointerMove);
      chain.removeEventListener("pointerup", releasePullChain);
      chain.removeEventListener("pointercancel", releasePullChain);
      mobileScene.removeEventListener("change", syncSceneViewport);
      if (motionListening) window.removeEventListener("devicemotion", onDeviceMotion);
      document.body.classList.remove("landing-lights-off");
      window.clearInterval(ambientTimer);
      if (ropeFrame !== undefined) window.cancelAnimationFrame(ropeFrame);
      if (readyTimer) window.clearTimeout(readyTimer);
      if (hintTimer) window.clearTimeout(hintTimer);
      if (cameraFrame !== undefined) window.cancelAnimationFrame(cameraFrame);
      chainHint?.remove();
    };
  });

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
        .scene-root .chain-hint {
          opacity: 0;
          pointer-events: none;
          transition: opacity .45s ease;
        }
        .scene-root.chain-hint-visible:not(.lit) .chain-hint { opacity: .82; }
        .scene-root .chain-hint text {
          fill: #d7d1c5;
          font-family: "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive;
          font-size: 17px;
          font-weight: 600;
          letter-spacing: .02em;
        }
        .scene-root .chain-hint path {
          fill: none;
          stroke: #d7d1c5;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 2;
        }
      `}</style>
    </main>
  );
}
