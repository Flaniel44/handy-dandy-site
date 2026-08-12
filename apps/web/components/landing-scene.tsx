"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { readDemoUnitPreference, setDemoUnitPreference } from "../lib/demo-unit";
import { ContactLinks } from "./contact-links";
import { GoogleReviews } from "./google-reviews";
import { LandingMarketingSections, LandingQuestionCta } from "./landing-marketing-sections";
import { landingSceneMarkup } from "./landing-scene-markup";
import { prepareRouteTransition } from "./route-transition";

const STORAGE_KEY = "handy-dandy-house-powered";
const DEVICE_STORAGE_KEY = "handy-dandy-device-power";
const POWER_STATE_TTL_MS = 24 * 60 * 60 * 1000;
const ROOM_CLASSES = ["lamp1", "lamp2", "lamp3", "lamp4"] as const;
const DEVICE_CONFIG = [
  {
    roomClass: "lamp1",
    label: "bedroom lamp",
    sourceSelector: 'g[transform="translate(262,244) scale(2.4)"]',
    hitArea: { x: -2, y: -4, width: 28, height: 32 },
    wireIndexes: [0],
    nodeIndex: 0,
  },
  {
    roomClass: "lamp2",
    label: "bathroom light",
    sourceSelector: 'g[transform="translate(407,208) scale(1.4)"]',
    hitArea: { x: -5, y: -4, width: 34, height: 32 },
    wireIndexes: [1, 2],
    nodeIndex: 1,
  },
  {
    roomClass: "lamp3",
    label: "kitchen chandelier",
    sourceSelector: 'g[transform="translate(237,300) scale(1.5)"]',
    hitArea: { x: -7, y: -5, width: 38, height: 35 },
    wireIndexes: [3],
    nodeIndex: 2,
  },
  {
    roomClass: "lamp4",
    label: "living room TV",
    sourceSelector: 'g[transform="translate(403,342) scale(1.7)"]',
    hitArea: { x: -7, y: -5, width: 38, height: 34 },
    wireIndexes: [4],
    nodeIndex: 3,
  },
] as const;

type LandingSceneProps = {
  launchOfferEnabled?: boolean;
  openHouseBridgeEnabled?: boolean;
};

export function LandingScene({ launchOfferEnabled = false, openHouseBridgeEnabled = false }: LandingSceneProps) {
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

    const stage = root.querySelector<HTMLElement>(".stage");
    let stageLogo = stage?.querySelector<HTMLImageElement>(".landing-stage-logo");
    if (stage && !stageLogo) {
      stageLogo = document.createElement("img");
      stageLogo.className = "landing-stage-logo";
      stageLogo.src = "/apple-icon.png";
      stageLogo.alt = "Digital HandyDan logo";
      stageLogo.draggable = false;
      stage.prepend(stageLogo);
    }

    let demoUnitHoldTimer: number | undefined;
    let demoUnitNoticeTimer: number | undefined;
    const cancelDemoUnitHold = () => window.clearTimeout(demoUnitHoldTimer);
    const showDemoUnitNotice = (enabled: boolean) => {
      if (!stage) return;
      stage.querySelector(".demo-unit-notice")?.remove();
      const notice = document.createElement("div");
      notice.className = "demo-unit-notice";
      notice.textContent = enabled ? "Demo unit mode enabled" : "Demo unit mode disabled";
      stage.append(notice);
      window.clearTimeout(demoUnitNoticeTimer);
      demoUnitNoticeTimer = window.setTimeout(() => notice.remove(), 2800);
    };
    const toggleDemoUnitMode = () => {
      const enabled = !readDemoUnitPreference();
      setDemoUnitPreference(enabled);
      if (enabled) {
        bookingPathRef.current = "/book";
        container.querySelector("[data-action='admin']")?.remove();
        void fetch("/api/auth/logout", { method: "POST" });
      }
      showDemoUnitNotice(enabled);
    };
    const startDemoUnitHold = (event: PointerEvent) => {
      event.preventDefault();
      cancelDemoUnitHold();
      demoUnitHoldTimer = window.setTimeout(toggleDemoUnitMode, 5000);
    };
    stageLogo?.addEventListener("pointerdown", startDemoUnitHold);
    stageLogo?.addEventListener("pointerup", cancelDemoUnitHold);
    stageLogo?.addEventListener("pointercancel", cancelDemoUnitHold);
    stageLogo?.addEventListener("pointerleave", cancelDemoUnitHold);
    stageLogo?.addEventListener("contextmenu", (event) => event.preventDefault());

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
        .robot-vacuum-runner {
          cursor: pointer;
          outline: none;
        }
        .robot-vacuum-runner:focus-visible .robot-vacuum-body {
          filter: drop-shadow(0 0 5px #40c4ff);
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
        .interactive-wifi {
          cursor: pointer;
          outline: none;
          transform-box: fill-box;
          transform-origin: center;
          transition: transform .28s cubic-bezier(.2, .8, .2, 1);
        }
        .interactive-wifi[data-wifi-level="1"] { transform: scale(1.22); }
        .interactive-wifi[data-wifi-level="2"] { transform: scale(1.46); }
        .interactive-wifi[data-wifi-level="3"] { transform: scale(1.72); }
        .interactive-wifi:focus-visible .wifi-wave,
        .interactive-wifi:focus-visible .vacuum-wifi-wave,
        .interactive-wifi:focus-visible .camera-wifi-wave {
          stroke: #f4a04f;
        }
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
          <g class="robot-vacuum-runner" role="button" tabindex="0" aria-label="Speed up robot vacuum">
            <rect x="-10" y="-18" width="50" height="35" rx="10" fill="transparent" pointer-events="all" aria-hidden="true" />
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

    const wifiWaveSelector = ".wifi-wave, .vacuum-wifi-wave, .camera-wifi-wave";
    const unwrappedWifiParents = new Set<SVGElement>();
    root.querySelectorAll<SVGElement>(wifiWaveSelector).forEach((wave) => {
      if (!wave.closest(".interactive-wifi") && wave.parentElement instanceof SVGElement) {
        unwrappedWifiParents.add(wave.parentElement);
      }
    });
    unwrappedWifiParents.forEach((parent) => {
      const waves = Array.from(parent.children).filter(
        (child): child is SVGElement => child instanceof SVGElement && child.matches(wifiWaveSelector),
      );
      if (waves.length === 0) return;

      const wrapper = document.createElementNS("http://www.w3.org/2000/svg", "g");
      wrapper.classList.add("interactive-wifi");
      wrapper.dataset.wifiLevel = "0";
      wrapper.setAttribute("role", "button");
      wrapper.setAttribute("tabindex", "0");
      wrapper.setAttribute("aria-label", "Grow Wi-Fi signal");
      parent.insertBefore(wrapper, waves[0]);
      waves.forEach((wave) => wrapper.append(wave));

      const bounds = wrapper.getBBox();
      const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      hitArea.setAttribute("data-wifi-hit-area", "true");
      hitArea.setAttribute("x", String(bounds.x - 9));
      hitArea.setAttribute("y", String(bounds.y - 9));
      hitArea.setAttribute("width", String(bounds.width + 18));
      hitArea.setAttribute("height", String(bounds.height + 18));
      hitArea.setAttribute("rx", "8");
      hitArea.setAttribute("fill", "transparent");
      hitArea.setAttribute("pointer-events", "all");
      hitArea.setAttribute("aria-hidden", "true");
      wrapper.prepend(hitArea);
    });

    const demosButton = root.querySelector<HTMLButtonElement>("[data-action='demos']");
    if (demosButton) demosButton.textContent = "What's Possible?";
    const bookButton = root.querySelector<HTMLButtonElement>("[data-action='book']");
    if (bookButton) bookButton.textContent = "Book an appointment";
    const businessName = root.querySelector<HTMLElement>(".name-ph");
    if (businessName) businessName.textContent = "Digital HandyDan";
    const actions = root.querySelector<HTMLElement>(".cta-row");
    let reviewJump = root.querySelector<HTMLAnchorElement>(".landing-review-jump");
    if (actions && !reviewJump) {
      reviewJump = document.createElement("a");
      reviewJump.className = "landing-review-jump hide";
      reviewJump.href = "#home-possibilities";
      reviewJump.innerHTML = `
        <span>Scroll to learn about the process</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4v15m-6-6 6 6 6-6" />
        </svg>
      `;
      actions.insertAdjacentElement("afterend", reviewJump);
    }

    const sceneSvg = root.querySelector<SVGSVGElement>(".stage > svg");
    // The SVG title creates a native browser tooltip that follows the mouse
    // around the interactive scene. The surrounding page already provides
    // accessible context, so keep the description but suppress that tooltip.
    sceneSvg?.querySelector(":scope > title")?.remove();
    const wireFlows = Array.from(root.querySelectorAll<SVGPathElement>(".data-wire-flow"));
    const dataNodes = Array.from(root.querySelectorAll<SVGCircleElement>(".data-node > circle"));
    let disabledDevices = new Set<string>();
    try {
      const savedDevices = JSON.parse(window.sessionStorage.getItem(DEVICE_STORAGE_KEY) ?? "[]");
      if (Array.isArray(savedDevices)) {
        disabledDevices = new Set(savedDevices.filter((room): room is string => typeof room === "string"));
      }
    } catch {
      // Individual device state can safely reset if browser storage is unavailable.
    }

    const persistDeviceState = () => {
      try {
        window.sessionStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify([...disabledDevices]));
      } catch {
        // Persistence is an enhancement, not a requirement for the interaction.
      }
    };

    const setDevicePowered = (roomClass: string, powered: boolean) => {
      root.classList.toggle(`device-off-${roomClass}`, !powered);
      const source = root.querySelector<SVGGElement>(`[data-device-toggle="${roomClass}"]`);
      source?.setAttribute("aria-pressed", String(powered));
      source?.setAttribute("aria-label", `${powered ? "Turn off" : "Turn on"} ${source.dataset.deviceLabel ?? "light"}`);
      if (powered) disabledDevices.delete(roomClass);
      else disabledDevices.add(roomClass);
      persistDeviceState();
    };

    const television = houseScene?.querySelector<SVGGElement>(
      'g[transform="translate(403,342) scale(1.7)"]',
    );
    if (television && !television.querySelector(".tv-movie-content")) {
      television.insertAdjacentHTML(
        "afterbegin",
        `<g class="tv-movie-content" pointer-events="none" aria-hidden="true">
          <rect x="3.2" y="5.1" width="17.6" height="11.8" rx="1" fill="#11182b" />
          <rect class="tv-movie-sky" x="3.6" y="5.5" width="16.8" height="7.2" rx=".65" fill="#40558d" />
          <circle class="tv-movie-sun" cx="17.5" cy="8.1" r="1.15" fill="#ffd180" />
          <path d="M3.6 12.6 L7.4 9.7 L10.3 12 L13.2 8.9 L17.1 12.6 H20.4 V16.5 H3.6 Z" fill="#273253" />
          <g class="tv-movie-car">
            <rect x="4.8" y="13.3" width="4.4" height="1.55" rx=".45" fill="#ff8a65" />
            <path d="M5.8 13.3 L6.55 12.45 H8.05 L8.65 13.3" fill="#ffccbc" />
            <circle cx="5.9" cy="15" r=".45" fill="#0b0d16" />
            <circle cx="8.25" cy="15" r=".45" fill="#0b0d16" />
          </g>
        </g>
        <g class="tv-device-wifi" pointer-events="none" aria-hidden="true">
          <path d="M8 1 Q12 -3 16 1" />
          <path d="M5.5 -1 Q12 -7.5 18.5 -1" />
          <circle cx="12" cy="2.2" r=".8" />
        </g>`,
      );
    }

    const bathtub = houseScene?.querySelector<SVGGElement>(
      'g[transform="translate(415,262) scale(1.6)"]',
    );
    if (bathtub && !bathtub.querySelector(".shower-effects")) {
      bathtub.classList.add("interactive-shower");
      bathtub.setAttribute("role", "button");
      bathtub.setAttribute("tabindex", "0");
      bathtub.setAttribute("aria-pressed", "true");
      bathtub.setAttribute("aria-label", "Stop shower water and steam");
      bathtub.insertAdjacentHTML(
        "afterbegin",
        `<rect class="shower-click-target" x="-4" y="-7" width="32" height="33" rx="5" fill="transparent" pointer-events="all" aria-hidden="true" />
        <g class="shower-effects" pointer-events="none" aria-hidden="true">
          <g class="shower-steam">
            <path class="steam-one" d="M5.5 12 C3.5 9.5 7.5 8.2 5.8 5.2" />
            <path class="steam-two" d="M10.5 12 C8.2 9.2 12.3 7.8 10.4 4.3" />
            <path class="steam-three" d="M18.2 12.2 C16 9.8 19.7 8.2 18.1 5.4" />
          </g>
          <g class="shower-water">
            <path d="M14 7 L10.5 10.9" />
            <path d="M14.4 7.2 L11.7 11.5" />
            <path d="M14.8 7.5 L12.9 12" />
          </g>
          <g class="shower-splashes">
            <circle cx="10.4" cy="11.3" r=".55" />
            <circle cx="11.7" cy="11.9" r=".48" />
            <circle cx="13" cy="12.4" r=".42" />
          </g>
        </g>`,
      );
    }

    const sleeper = houseScene?.querySelector<SVGGElement>(
      'g[transform="translate(203,261) scale(1.8)"]',
    );
    if (sleeper && !sleeper.querySelector(".sleep-effects")) {
      sleeper.classList.add("interactive-sleeper");
      sleeper.setAttribute("role", "button");
      sleeper.setAttribute("tabindex", "0");
      sleeper.setAttribute("aria-label", "Wake sleeping person");
      sleeper.insertAdjacentHTML(
        "beforeend",
        `<g class="sleep-effects" pointer-events="none" aria-hidden="true">
          <g class="sleep-zs">
            <text class="sleep-z sleep-z-one" x="8.5" y="5.5">z</text>
            <text class="sleep-z sleep-z-two" x="11.8" y="1.7">z</text>
            <text class="sleep-z sleep-z-three" x="15.7" y="-2.6">Z</text>
          </g>
          <text class="sleep-exclamation" x="7.2" y="4.3">!</text>
        </g>
        <rect class="sleep-click-target" x="0" y="3" width="24" height="20" rx="5" fill="transparent" pointer-events="all" aria-hidden="true" />`,
      );
    }
    let sleeperWakeTimer: number | undefined;

    DEVICE_CONFIG.forEach(({ roomClass, label, sourceSelector, hitArea, wireIndexes, nodeIndex }) => {
      const source = houseScene?.querySelector<SVGGElement>(sourceSelector);
      if (!source) return;

      source.classList.add("device-toggle-source");
      source.dataset.deviceToggle = roomClass;
      source.dataset.deviceLabel = label;
      source.setAttribute("role", "button");
      source.setAttribute("tabindex", "0");

      let clickTarget = source.querySelector<SVGRectElement>(":scope > .device-click-target");
      if (!clickTarget) {
        clickTarget = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        clickTarget.setAttribute("class", "device-click-target");
        clickTarget.setAttribute("fill", "transparent");
        clickTarget.setAttribute("pointer-events", "all");
        clickTarget.setAttribute("aria-hidden", "true");
        source.prepend(clickTarget);
      }
      clickTarget.setAttribute("x", String(hitArea.x));
      clickTarget.setAttribute("y", String(hitArea.y));
      clickTarget.setAttribute("width", String(hitArea.width));
      clickTarget.setAttribute("height", String(hitArea.height));
      clickTarget.setAttribute("rx", "3");

      root.querySelectorAll<SVGElement>(`.${roomClass}`).forEach((light) => {
        light.classList.add("device-room-illumination");
      });
      source.querySelectorAll<SVGElement>(`.${roomClass}`).forEach((light) => {
        light.classList.remove("device-room-illumination");
      });
      wireIndexes.forEach((index) => wireFlows[index]?.classList.add(`device-wire-${roomClass}`));
      dataNodes[nodeIndex]?.classList.add(`device-node-${roomClass}`);
      setDevicePowered(roomClass, !disabledDevices.has(roomClass));
    });

    let chainHint = sceneSvg?.querySelector<SVGGElement>(".chain-hint");
    if (sceneSvg && !chainHint) {
      chainHint = document.createElementNS("http://www.w3.org/2000/svg", "g");
      chainHint.setAttribute("class", "chain-hint");
      chainHint.setAttribute("aria-hidden", "true");
      chainHint.innerHTML = `
        <text x="424" y="20" transform="rotate(-5 424 20)">(pull me)</text>
        <path d="M423 28 C405 30 380 36 363 43" />
        <path d="M363 43 L370 34 M363 43 L374 45" />
      `;
      sceneSvg.append(chainHint);
    }
    const trackingCameras = Array.from(root.querySelectorAll<SVGGElement>(".tracking-camera"));
    trackingCameras.forEach((camera) => {
      const aim = camera.querySelector<SVGGElement>(".camera-aim");
      if (aim && !aim.querySelector(".camera-vision-cone")) {
        aim.insertAdjacentHTML(
          "afterbegin",
          `<path class="camera-vision-cone" d="M31 10 L150 -44 L150 70 L31 16 Z" pointer-events="none" aria-hidden="true" />`,
        );
      }
      if (!camera.querySelector(".camera-snapshot-reticle")) {
        camera.insertAdjacentHTML(
          "beforeend",
          `<g class="camera-snapshot-reticle" pointer-events="none" aria-hidden="true">
            <rect x="-13" y="-13" width="26" height="26" rx="2" />
            <path d="M-6.5 -13 H-13 V-6.5 M6.5 -13 H13 V-6.5 M13 6.5 V13 H6.5 M-6.5 13 H-13 V6.5" />
          </g>`,
        );
      }
    });
    const cameraTrackers = trackingCameras.map((camera, index) => ({
      camera,
      aim: camera.querySelector<SVGGElement>(".camera-aim"),
      cone: camera.querySelector<SVGPathElement>(".camera-vision-cone"),
      reticle: camera.querySelector<SVGGElement>(".camera-snapshot-reticle"),
      currentAngle: 0,
      targetAngle: 0,
      pointerX: 0,
      pointerY: 0,
      isTracking: false,
      trackingStartedAt: 0,
      snapshotTaken: false,
      flashUntil: 0,
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
      const savedState = window.localStorage.getItem(STORAGE_KEY);
      if (savedState) {
        const parsed = JSON.parse(savedState) as { powered?: unknown; expiresAt?: unknown };
        if (typeof parsed.powered === "boolean" && typeof parsed.expiresAt === "number" && parsed.expiresAt > Date.now()) {
          restored = parsed.powered;
        } else {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      } else if (window.sessionStorage.getItem(STORAGE_KEY) === "true") {
        // Preserve the powered state for visitors who loaded the previous
        // sessionStorage-based version before this update was deployed.
        restored = true;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ powered: true, expiresAt: Date.now() + POWER_STATE_TTL_MS }));
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // The scene remains usable when browser storage is unavailable.
    }

    const landingPage = container.closest<HTMLElement>(".landing-page");
    const syncPoweredContent = (powered: boolean) => {
      landingPage?.classList.toggle("landing-content-hidden", !powered);
    };
    const syncOpenHouseLight = (powered: boolean) => {
      if (!openHouseBridgeEnabled || window.parent === window) return;
      window.parent.postMessage({ type: "digital-handydan:power-state", powered }, "*");
    };

    if (restored) root.classList.add("lit", "session-restored", "ambient-ready", "sign-powered");
    syncPoweredContent(restored);
    syncOpenHouseLight(restored);

    let readyTimer: number | undefined;
    let hintTimer: number | undefined;
    const scheduleChainHint = () => {
      window.clearTimeout(hintTimer);
      root.classList.remove("chain-hint-visible");
      hintTimer = window.setTimeout(() => root.classList.add("chain-hint-visible"), 10_000);
    };
    if (!restored) scheduleChainHint();
    const setPowered = (powered: boolean) => {
      root.classList.toggle("lit", powered);
      syncPoweredContent(powered);
      syncOpenHouseLight(powered);
      chain.setAttribute("aria-label", powered ? "Turn the house lights off" : "Turn the house lights on");
      window.clearTimeout(readyTimer);
      if (powered) {
        window.clearTimeout(hintTimer);
        root.classList.remove("chain-hint-visible");
      } else {
        scheduleChainHint();
      }
      if (powered && !root.classList.contains("session-restored")) {
        root.classList.remove("ambient-ready");
        root.classList.add("sign-powered");
        readyTimer = window.setTimeout(() => root.classList.add("ambient-ready"), 1900);
      } else if (!powered) {
        root.classList.remove("session-restored", "ambient-ready", "sign-powered");
      }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ powered, expiresAt: Date.now() + POWER_STATE_TTL_MS }));
        window.sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // Persistence is an enhancement, not a requirement for the interaction.
      }
    };

    const activate = (action: string) => {
      if (action === "toggle-light") setPowered(!root.classList.contains("lit"));
      if (action === "book") {
        prepareRouteTransition("forward");
        router.push(bookingPathRef.current);
      }
      if (action === "demos") {
        prepareRouteTransition("forward");
        router.push("/demos");
      }
      if (action === "admin") {
        prepareRouteTransition("forward");
        router.push("/admin");
      }
      if (action === "contact") window.location.href = "mailto:dan@digitalhandydan.ca";
    };

    const toggleDeviceFrom = (target: EventTarget | null) => {
      if (!(target instanceof Element) || !root.classList.contains("lit")) return false;
      const source = target.closest<SVGGElement>("[data-device-toggle]");
      const roomClass = source?.dataset.deviceToggle;
      if (!source || !roomClass) return false;
      setDevicePowered(roomClass, disabledDevices.has(roomClass));
      return true;
    };

    const toggleShowerFrom = (target: EventTarget | null) => {
      if (!(target instanceof Element) || !root.classList.contains("lit")) return false;
      const shower = target.closest<SVGGElement>(".interactive-shower");
      if (!shower) return false;

      const isRunning = !shower.classList.toggle("shower-stopped");
      shower.setAttribute("aria-pressed", String(isRunning));
      shower.setAttribute(
        "aria-label",
        isRunning ? "Stop shower water and steam" : "Start shower water and steam",
      );
      return true;
    };

    const wakeSleeperFrom = (target: EventTarget | null) => {
      if (!(target instanceof Element) || !root.classList.contains("lit")) return false;
      const sleepingPerson = target.closest<SVGGElement>(".interactive-sleeper");
      if (!sleepingPerson) return false;

      window.clearTimeout(sleeperWakeTimer);
      sleepingPerson.classList.remove("sleeper-awake");
      sleepingPerson.getBBox();
      sleepingPerson.classList.add("sleeper-awake");
      sleepingPerson.setAttribute("aria-label", "Sleeping person is awake");
      sleeperWakeTimer = window.setTimeout(() => {
        sleepingPerson.classList.remove("sleeper-awake");
        sleepingPerson.setAttribute("aria-label", "Wake sleeping person");
      }, 1350);
      return true;
    };

    const growWifiFrom = (target: EventTarget | null) => {
      if (!(target instanceof Element) || !root.classList.contains("lit")) return false;
      const wifi = target.closest<SVGGElement>(".interactive-wifi");
      if (!wifi) return false;
      const currentLevel = Number.parseInt(wifi.dataset.wifiLevel || "0", 10);
      const nextLevel = currentLevel >= 3 ? 0 : currentLevel + 1;
      wifi.dataset.wifiLevel = String(nextLevel);
      wifi.setAttribute(
        "aria-label",
        nextLevel === 3
          ? "Wi-Fi signal at maximum size. Activate to reset"
          : nextLevel === 0
            ? "Grow Wi-Fi signal"
            : `Wi-Fi signal size ${nextLevel} of 3. Activate to grow`,
      );
      return true;
    };

    const speedUpVacuumFrom = (target: EventTarget | null) => {
      if (!(target instanceof Element) || !root.classList.contains("lit")) return false;
      const vacuum = target.closest<SVGGElement>(".robot-vacuum-runner");
      if (!vacuum) return false;

      const currentLevel = Number.parseInt(vacuum.dataset.vacuumSpeedLevel || "0", 10);
      const nextLevel = currentLevel >= 3 ? 0 : currentLevel + 1;
      const playbackRates = [1, 2, 3.5, 5];
      vacuum.dataset.vacuumSpeedLevel = String(nextLevel);
      const vacuumBody = vacuum.querySelector<SVGGElement>(".robot-vacuum-body");
      [...vacuum.getAnimations(), ...(vacuumBody?.getAnimations() || [])].forEach((animation) => {
        animation.updatePlaybackRate(playbackRates[nextLevel]);
      });
      vacuum.setAttribute(
        "aria-label",
        nextLevel === 3
          ? "Robot vacuum at maximum speed. Activate to reset"
          : nextLevel === 0
            ? "Robot vacuum at normal speed. Activate to speed up"
            : `Robot vacuum speed level ${nextLevel} of 3. Activate to speed up`,
      );
      return true;
    };

    const actionFrom = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLElement>("[data-action]")?.dataset.action : undefined;

    const chainExtensionBeadCount = 7;
    const firstOriginalBead = chain.querySelector<SVGCircleElement>(":scope > circle:not([data-chain-extension-bead])");
    if (firstOriginalBead && !chain.querySelector(":scope > circle[data-chain-extension-bead]")) {
      for (let index = 0; index < chainExtensionBeadCount; index += 1) {
        const bead = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        bead.setAttribute("data-chain-extension-bead", "true");
        bead.setAttribute("cx", "340");
        bead.setAttribute("cy", String(-117 + index * 11));
        bead.setAttribute("r", "3.5");
        bead.setAttribute("fill", "#a9adb8");
        chain.insertBefore(bead, firstOriginalBead);
      }
    }
    const beads = Array.from(chain.querySelectorAll<SVGCircleElement>(":scope > circle"));
    const handle = chain.querySelector<SVGRectElement>(":scope > rect:not([data-chain-hit-area])");
    const retractedChainStartY = -40 - chainExtensionBeadCount * 11;
    const points = [
      ...beads.map((_, index) => {
        const x = 340;
        const y = retractedChainStartY + index * 11;
        return { x, y, oldX: x, oldY: y };
      }),
      { x: 340, y: 103, oldX: 340, oldY: 103 },
    ];
    const restingPoints = points.map((point) => ({ x: point.x, y: point.y }));
    const segmentLengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
    const retractedAnchorY = restingPoints[0].y;
    const extendedAnchorY = -40;
    let currentAnchorY = root.classList.contains("lit") ? retractedAnchorY : extendedAnchorY;
    const initialChainOffset = currentAnchorY - retractedAnchorY;
    if (initialChainOffset !== 0) {
      points.forEach((point) => {
        point.y += initialChainOffset;
        point.oldY += initialChainOffset;
      });
    }
    let pullStartX: number | undefined;
    let pullStartY: number | undefined;
    let pullBaseX: number | undefined;
    let pullBaseY: number | undefined;
    let pullStartedAt: number | undefined;
    let pullDistance = 0;
    let suppressChainClick = false;
    let previousPointerX: number | undefined;
    let ropeFrame: number | undefined;
    let previousRopeTime: number | undefined;
    let ropeAccumulator = 0;
    let grabbed = false;
    let grabX = points.at(-1)!.x;
    let grabY = points.at(-1)!.y;
    let ambientSwingPhase = 0;
    let cameraFrame: number | undefined;

    const animateCameras = (time: number) => {
      cameraTrackers.forEach((tracker) => {
        if (!tracker.aim) return;
        const desiredAngle = tracker.isTracking
          ? tracker.targetAngle
          : Math.sin(time / 1500 + tracker.phase) * 12;
        tracker.currentAngle += (desiredAngle - tracker.currentAngle) * .075;
        tracker.aim.setAttribute("transform", `rotate(${tracker.currentAngle.toFixed(2)} 12 13)`);

        if (tracker.isTracking && tracker.cone) {
          // The cone lives inside the rotating camera head. Counter-rotate the
          // pointer first so its far edge remains centred on the cursor even
          // while the camera is smoothly catching up with it.
          const inverseAngle = -tracker.currentAngle * Math.PI / 180;
          const pointerDx = tracker.pointerX - 12;
          const pointerDy = tracker.pointerY - 13;
          const targetX = 12 + pointerDx * Math.cos(inverseAngle) - pointerDy * Math.sin(inverseAngle);
          const targetY = 13 + pointerDx * Math.sin(inverseAngle) + pointerDy * Math.cos(inverseAngle);
          const originX = 31.5;
          const originY = 13;
          const dx = targetX - originX;
          const dy = targetY - originY;
          const distance = Math.max(1, Math.hypot(dx, dy));
          const unitX = dx / distance;
          const unitY = dy / distance;
          const perpendicularX = -unitY;
          const perpendicularY = unitX;
          const nearHalfWidth = 2.5;
          const farHalfWidth = Math.max(9, Math.min(34, distance * .25));
          const farX = targetX + unitX * 5;
          const farY = targetY + unitY * 5;
          tracker.cone.setAttribute(
            "d",
            `M${(originX + perpendicularX * nearHalfWidth).toFixed(2)} ${(originY + perpendicularY * nearHalfWidth).toFixed(2)} ` +
            `L${(farX + perpendicularX * farHalfWidth).toFixed(2)} ${(farY + perpendicularY * farHalfWidth).toFixed(2)} ` +
            `L${(farX - perpendicularX * farHalfWidth).toFixed(2)} ${(farY - perpendicularY * farHalfWidth).toFixed(2)} ` +
            `L${(originX - perpendicularX * nearHalfWidth).toFixed(2)} ${(originY - perpendicularY * nearHalfWidth).toFixed(2)} Z`,
          );
        }

        if (tracker.isTracking && !tracker.snapshotTaken && time - tracker.trackingStartedAt >= 3000) {
          tracker.snapshotTaken = true;
          tracker.flashUntil = time + 480;
          tracker.reticle?.classList.add("snapshot-captured");
        }
        if (tracker.flashUntil > 0 && time >= tracker.flashUntil) {
          tracker.flashUntil = 0;
          tracker.reticle?.classList.remove("snapshot-captured");
        }
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
      const powered = root.classList.contains("lit");
      const hitAreaHalfWidth = powered ? 37 : 56;
      const hitAreaBottomPadding = powered ? 30 : 90;
      hitArea?.setAttribute("x", String(340 - hitAreaHalfWidth));
      hitArea?.setAttribute("width", String(hitAreaHalfWidth * 2));
      hitArea?.setAttribute("height", Math.max(175, end.y + hitAreaBottomPadding - (-45)).toFixed(2));
      handle.setAttribute("x", (end.x - 7).toFixed(2));
      handle.setAttribute("y", (end.y - 11).toFixed(2));
      handle.setAttribute("transform", `rotate(${angle} ${end.x} ${end.y})`);
    };

    const stepRopePhysics = () => {
      const ambientSwinging = !grabbed;
      const targetAnchorY = root.classList.contains("lit") ? retractedAnchorY : extendedAnchorY;
      currentAnchorY += (targetAnchorY - currentAnchorY) * .055;
      // Drive near the rope's natural pendulum frequency so the motion stays
      // visible after damping and constraint passes have done their work.
      ambientSwingPhase += .038;
      const ambientDrive = ambientSwinging ? Math.sin(ambientSwingPhase) * .035 : 0;
      for (let index = 1; index < points.length; index += 1) {
        const point = points[index];
        if (grabbed && index === points.length - 1) {
          point.x = grabX; point.y = grabY; point.oldX = grabX; point.oldY = grabY;
          continue;
        }
        const velocityX = (point.x - point.oldX) * .986;
        const velocityY = (point.y - point.oldY) * .986;
        point.oldX = point.x; point.oldY = point.y;
        point.x += velocityX + ambientDrive * (index / (points.length - 1));
        point.y += velocityY + .25;
      }
      for (let iteration = 0; iteration < 7; iteration += 1) {
        points[0].x = restingPoints[0].x; points[0].y = currentAnchorY;
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
    };

    const physicsStepMs = 1000 / 60;
    const simulateRope = (time: number) => {
      if (previousRopeTime === undefined) previousRopeTime = time - physicsStepMs;
      ropeAccumulator += Math.min(100, Math.max(0, time - previousRopeTime));
      previousRopeTime = time;

      let steps = 0;
      while (ropeAccumulator >= physicsStepMs && steps < 6) {
        stepRopePhysics();
        ropeAccumulator -= physicsStepMs;
        steps += 1;
      }

      renderRope();
      ropeFrame = window.requestAnimationFrame(simulateRope);
    };

    const startRope = () => {
      if (ropeFrame !== undefined) return;
      previousRopeTime = undefined;
      ropeAccumulator = 0;
      ropeFrame = window.requestAnimationFrame(simulateRope);
    };

    const nudgeRope = (direction = 1) => {
      if (grabbed) return;
      points.forEach((point, index) => {
        if (index === 0) return;
        point.oldX -= direction * 6 * (index / (points.length - 1));
      });
      startRope();
    };

    // A small initial impulse lets the joint simulation open with a natural,
    // decaying sway instead of a perfectly static chain.
    nudgeRope();

    const onScenePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse") {
        cameraTrackers.forEach((tracker) => {
          const { camera } = tracker;
          const matrix = camera.getScreenCTM();
          if (!matrix || !tracker.aim) return;
          // A pointer's hotspot is at the arrow tip, not its visual centre.
          const target = new DOMPoint(event.clientX + 6, event.clientY + 8).matrixTransform(matrix.inverse());
          const targetAngle = Math.atan2(target.y - 13, target.x - 12) * 180 / Math.PI;
          const insideVisionCone = target.x > 12 && targetAngle >= -50 && targetAngle <= 50;
          if (insideVisionCone) {
            if (!tracker.isTracking) {
              tracker.isTracking = true;
              tracker.trackingStartedAt = performance.now();
              tracker.snapshotTaken = false;
              tracker.flashUntil = 0;
              tracker.camera.classList.add("camera-tracking");
              tracker.reticle?.classList.remove("snapshot-captured");
            }
            tracker.targetAngle = Math.max(-38, Math.min(42, targetAngle));
            tracker.pointerX = target.x;
            tracker.pointerY = target.y;
            tracker.reticle?.setAttribute(
              "transform",
              `translate(${target.x.toFixed(2)} ${target.y.toFixed(2)})`,
            );
          } else {
            tracker.isTracking = false;
            tracker.trackingStartedAt = 0;
            tracker.snapshotTaken = false;
            tracker.flashUntil = 0;
            tracker.camera.classList.remove("camera-tracking");
            tracker.reticle?.classList.remove("snapshot-captured");
          }
        });
      }
      if (grabbed) return;
      const svg = chain.ownerSVGElement;
      const matrix = svg?.getScreenCTM();
      if (previousPointerX !== undefined && matrix) {
        const cursor = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
        let closestIndex = 1;
        let closestDistance = Number.POSITIVE_INFINITY;
        points.forEach((point, index) => {
          if (index === 0) return;
          const distance = Math.hypot(cursor.x - point.x, cursor.y - point.y);
          if (distance < closestDistance) { closestDistance = distance; closestIndex = index; }
        });
        const movement = event.clientX - previousPointerX;
        if (closestDistance <= 12 && Math.abs(movement) > .4) {
          points[closestIndex].oldX -= movement * svgScale() * (event.pointerType === "mouse" ? .62 : .2);
          startRope();
        }
      }
      previousPointerX = event.clientX;
    };

    const onScenePointerDown = (event: PointerEvent) => { previousPointerX = event.clientX; };
    const onScenePointerEnd = () => { previousPointerX = undefined; };

    const resetCameraAim = () => cameraTrackers.forEach((tracker) => {
      tracker.isTracking = false;
      tracker.trackingStartedAt = 0;
      tracker.snapshotTaken = false;
      tracker.flashUntil = 0;
      tracker.camera.classList.remove("camera-tracking");
      tracker.reticle?.classList.remove("snapshot-captured");
    });

    const onPointerDown = (event: PointerEvent) => {
      const end = points.at(-1)!;
      pullStartX = event.clientX; pullStartY = event.clientY; pullStartedAt = performance.now(); pullDistance = 0; grabbed = true;
      pullBaseX = end.x; pullBaseY = end.y;
      // Give taps the same visible mechanical pull as mouse presses. Further
      // touch movement adds to this initial travel for the drag-to-pull gesture.
      grabX = end.x; grabY = end.y + 18 * svgScale();
      suppressChainClick = event.pointerType !== "mouse";
      chain.setPointerCapture(event.pointerId); startRope();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!grabbed || pullStartX === undefined || pullStartY === undefined) return;
      event.preventDefault();
      const scale = svgScale();
      const downwardTravel = Math.max(0, event.clientY - pullStartY);
      pullDistance = Math.min(86, downwardTravel * .78);
      grabX = (pullBaseX ?? restingPoints.at(-1)!.x) + (event.clientX - pullStartX) * scale * .65;
      grabY = (pullBaseY ?? restingPoints.at(-1)!.y) + (18 + pullDistance) * scale;
    };

    const releasePullChain = (event: PointerEvent) => {
      if (!grabbed) return;
      const totalTravel = pullStartX === undefined || pullStartY === undefined
        ? Number.POSITIVE_INFINITY
        : Math.hypot(event.clientX - pullStartX, event.clientY - pullStartY);
      const pressDuration = pullStartedAt === undefined ? Number.POSITIVE_INFINITY : performance.now() - pullStartedAt;
      const isTap = totalTravel <= 18 && pressDuration <= 700;
      const isIntentionalPull = pullDistance >= 30;
      const shouldToggle = event.type === "pointerup" && (isTap || isIntentionalPull);
      grabbed = false; pullStartX = undefined; pullStartY = undefined; pullBaseX = undefined; pullBaseY = undefined; pullStartedAt = undefined;
      if (chain.hasPointerCapture(event.pointerId)) chain.releasePointerCapture(event.pointerId);
      startRope();
      if (shouldToggle) {
        suppressChainClick = true;
        setPowered(!root.classList.contains("lit"));
      }
    };

    const onClick = (event: MouseEvent) => {
      if (speedUpVacuumFrom(event.target)) return;
      if (growWifiFrom(event.target)) return;
      if (wakeSleeperFrom(event.target)) return;
      if (toggleShowerFrom(event.target)) return;
      if (toggleDeviceFrom(event.target)) return;
      const action = actionFrom(event.target);
      if (action === "toggle-light" && suppressChainClick) {
        suppressChainClick = false;
        return;
      }
      if (action) activate(action);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key === "Enter" || event.key === " ") && event.target instanceof Element && event.target.closest(".interactive-sleeper")) {
        event.preventDefault();
        wakeSleeperFrom(event.target);
        return;
      }
      if ((event.key === "Enter" || event.key === " ") && event.target instanceof Element && event.target.closest(".interactive-shower")) {
        event.preventDefault();
        toggleShowerFrom(event.target);
        return;
      }
      if ((event.key === "Enter" || event.key === " ") && event.target instanceof Element && event.target.closest(".robot-vacuum-runner")) {
        event.preventDefault();
        speedUpVacuumFrom(event.target);
        return;
      }
      if ((event.key === "Enter" || event.key === " ") && event.target instanceof Element && event.target.closest(".interactive-wifi")) {
        event.preventDefault();
        growWifiFrom(event.target);
        return;
      }
      if ((event.key === "Enter" || event.key === " ") && event.target instanceof Element && event.target.closest("[data-device-toggle]")) {
        event.preventDefault();
        toggleDeviceFrom(event.target);
        return;
      }
      const action = actionFrom(event.target);
      if (action && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        activate(action);
      }
    };

    let previousRoom = -1;
    const flickerRandomRoom = () => {
      if (!root.classList.contains("lit")) return;
      const availableRooms = ROOM_CLASSES
        .map((_, index) => index)
        .filter((index) => !disabledDevices.has(ROOM_CLASSES[index]));
      if (availableRooms.length === 0) return;
      let room = availableRooms[Math.floor(Math.random() * availableRooms.length)];
      if (room === previousRoom && availableRooms.length > 1) {
        room = availableRooms[(availableRooms.indexOf(room) + 1) % availableRooms.length];
      }
      previousRoom = room;

      const lights = Array.from(root.querySelectorAll<SVGElement>(`.${ROOM_CLASSES[room]}`));
      const setRoomLevel = (opacity: number, transition = "opacity 45ms linear") => {
        if (disabledDevices.has(ROOM_CLASSES[room])) {
          lights.forEach((light) => {
            light.style.removeProperty("opacity");
            light.style.removeProperty("transition");
          });
          return;
        }
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
    container.addEventListener("pointerdown", onScenePointerDown);
    container.addEventListener("pointermove", onScenePointerMove);
    container.addEventListener("pointerup", onScenePointerEnd);
    container.addEventListener("pointercancel", onScenePointerEnd);
    container.addEventListener("pointerleave", resetCameraAim);
    chain.addEventListener("pointerdown", onPointerDown);
    chain.addEventListener("pointermove", onPointerMove);
    chain.addEventListener("pointerup", releasePullChain);
    chain.addEventListener("pointercancel", releasePullChain);

    return () => {
      container.removeEventListener("click", onClick);
      container.removeEventListener("keydown", onKeyDown);
      container.removeEventListener("pointerdown", onScenePointerDown);
      container.removeEventListener("pointermove", onScenePointerMove);
      container.removeEventListener("pointerup", onScenePointerEnd);
      container.removeEventListener("pointercancel", onScenePointerEnd);
      container.removeEventListener("pointerleave", resetCameraAim);
      chain.removeEventListener("pointerdown", onPointerDown);
      chain.removeEventListener("pointermove", onPointerMove);
      chain.removeEventListener("pointerup", releasePullChain);
      chain.removeEventListener("pointercancel", releasePullChain);
      mobileScene.removeEventListener("change", syncSceneViewport);
      window.clearInterval(ambientTimer);
      if (ropeFrame !== undefined) window.cancelAnimationFrame(ropeFrame);
      if (readyTimer) window.clearTimeout(readyTimer);
      if (hintTimer) window.clearTimeout(hintTimer);
      if (cameraFrame !== undefined) window.cancelAnimationFrame(cameraFrame);
      if (sleeperWakeTimer !== undefined) window.clearTimeout(sleeperWakeTimer);
      window.clearTimeout(demoUnitHoldTimer);
      window.clearTimeout(demoUnitNoticeTimer);
      stageLogo?.remove();
      chainHint?.remove();
      reviewJump?.remove();
    };
  });

  return (
    <main className="landing-page landing-content-hidden">
      <section className="landing-hero" aria-label="Digital HandyDan">
        <div
          ref={containerRef}
          className="landing-scene-shell"
          dangerouslySetInnerHTML={{
            __html: landingSceneMarkup
              .replace(">Handy Dandy</p>", ">Digital HandyDan</p>")
              .replace(
                '<div class="stage">',
                `${launchOfferEnabled ? '<div class="landing-launch-badge">Launch offer · Services are free</div>' : ''}<h1 class="landing-brand-sign" data-text="Digital HandyDan">Digital HandyDan</h1><div class="stage">`,
              ),
          }}
        />
      </section>
      <div className="landing-powered-content">
        <LandingMarketingSections />
        <GoogleReviews />
        <LandingQuestionCta />
        <footer className="landing-footer">
          <ContactLinks className="landing-contact" title="Let’s get connected" />
          <p>© {new Date().getFullYear()} Digital HandyDan</p>
        </footer>
      </div>
      <style>{`
        .landing-page.landing-content-hidden .landing-powered-content {
          display: none;
        }
        /* Demo-inspired material illustration treatment for the interactive house. */
        .scene-root .stage {
          border: 1px solid #303752;
          isolation: isolate;
          background:
            linear-gradient(#8279e50d 1px, transparent 1px),
            linear-gradient(90deg, #8279e50d 1px, transparent 1px),
            radial-gradient(circle at 50% 72%, #5c55aa24 0, transparent 42%),
            linear-gradient(145deg, #111526 0%, #0b0d16 72%) !important;
          background-size: 28px 28px, 28px 28px, auto, auto !important;
        }
        .scene-root .stage > svg {
          position: relative;
          z-index: 6;
          overflow: visible;
        }
        .scene-root .captions {
          position: relative;
          z-index: 2;
        }
        .scene-root .landing-stage-logo {
          position: absolute;
          z-index: 4;
          left: 14px;
          bottom: 14px;
          width: clamp(42px, 8vw, 58px);
          height: auto;
          border: 1px solid #8279e555;
          border-radius: 10px;
          box-shadow: 0 0 18px #6259c344;
          opacity: .72;
          cursor: default;
          pointer-events: auto;
          touch-action: none;
          user-select: none;
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          transition: opacity .5s ease, filter .5s ease;
        }
        .scene-root.lit .landing-stage-logo {
          opacity: .94;
          filter: brightness(1.08);
        }
        .scene-root .demo-unit-notice {
          position: absolute;
          z-index: 12;
          left: 50%;
          bottom: 18px;
          translate: -50% 0;
          padding: 9px 13px;
          border: 1px solid #8279e588;
          border-radius: 8px;
          background: #0b0d16ed;
          box-shadow: 0 0 24px #6259c355;
          color: #f3eee6;
          font-size: .78rem;
          font-weight: 700;
          white-space: nowrap;
          pointer-events: none;
        }
        .scene-root.lit .stage {
          background:
            linear-gradient(#9189f016 1px, transparent 1px),
            linear-gradient(90deg, #9189f016 1px, transparent 1px),
            radial-gradient(circle at 50% 68%, #6f67c83d 0, transparent 46%),
            linear-gradient(145deg, #1a2037 0%, #101426 72%) !important;
          background-size: 28px 28px, 28px 28px, auto, auto !important;
        }
        .scene-root .house-scene {
          filter: drop-shadow(0 12px 12px #0007);
        }
        .scene-root .house-scene > polygon[points="195,205 340,120 485,205"] {
          fill: #3c3489;
          stroke: #8279e5;
          stroke-width: 7px;
          stroke-linejoin: round;
        }
        .scene-root .house-scene > rect[mask="url(#wallWindowGaps)"] {
          rx: 14px;
          fill: #1b2139;
          stroke: #5a6080;
          stroke-width: 8px;
        }
        .scene-root .house-scene > rect[fill="#28304c"] {
          fill: #303752;
        }
        .scene-root .house-scene > rect.lamp {
          rx: 6px;
          stroke: #454c70;
          stroke-width: 2px;
        }
        .scene-root .house-scene [fill="#7f77dd"] {
          fill: #6861b8;
        }
        .scene-root .house-scene [stroke="#7f77dd"] {
          stroke: #8279e5;
        }
        .scene-root .house-scene [fill="#5c55aa"] {
          fill: #3c3489;
        }
        .scene-root .house-scene g[transform="translate(203,261) scale(1.8)"] path {
          fill: #5c55aa;
        }
        .scene-root .house-scene g[transform="translate(415,262) scale(1.6)"] path,
        .scene-root .house-scene g[transform="translate(380,273) scale(1)"] :is(path, polygon, rect) {
          fill: #b8b7dc;
        }
        .scene-root .house-scene g[transform="translate(210,359) scale(1.7)"] path {
          fill: #b8b7dc;
          stroke: #6c70a0;
          stroke-width: .8px;
        }
        .scene-root .house-scene g[transform="translate(255,361) scale(1.6) translate(24 0) scale(-1 1)"] path {
          fill: #716ac5;
        }
        .scene-root .house-scene g[transform="translate(348,364) scale(2,1.5)"] path {
          fill: #3a4468;
          stroke: #686f9c;
          stroke-width: .75px;
        }
        .scene-root .house-scene > rect.keep-width {
          fill: #5a6080;
        }
        .scene-root .data-wire-base {
          stroke: #454c70;
          stroke-width: 3px;
          opacity: .9;
        }
        .scene-root .antenna-stem {
          stroke: #a9adb8;
          stroke-width: 4px;
        }
        .scene-root .antenna-tip {
          fill: #c7cad5;
        }
        .scene-root .wifi-wave,
        .scene-root .vacuum-wifi-wave,
        .scene-root .camera-wifi-wave {
          stroke: #40c4ff;
        }
        .scene-root .robot-vacuum-body rect:first-child {
          fill: #232b47;
          stroke: #8279e5;
        }
        .scene-root .tracking-camera .camera-aim > path {
          fill: #6861b8;
        }
        .scene-root .tracking-camera .camera-aim > rect {
          fill: #232b47;
          stroke: #8279e5;
        }
        .scene-root .camera-vision-cone {
          fill: #ff1744 !important;
          filter: drop-shadow(0 0 5px #ff174455);
          opacity: 0;
          transition: opacity .18s ease;
        }
        .scene-root .tracking-camera.camera-tracking .camera-vision-cone {
          opacity: .2;
        }
        .scene-root .camera-snapshot-reticle {
          opacity: 0;
          transition: opacity .14s ease;
        }
        .scene-root .tracking-camera.camera-tracking .camera-snapshot-reticle {
          opacity: .9;
        }
        .scene-root .camera-snapshot-reticle rect {
          fill: transparent;
          stroke: none;
        }
        .scene-root .camera-snapshot-reticle path {
          fill: none;
          filter: drop-shadow(0 0 2px #000a);
          stroke: #ffffff;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 1.65px;
        }
        .scene-root .camera-snapshot-reticle.snapshot-captured rect {
          animation: cameraSnapshotFlash .48s ease-out;
        }
        .scene-root .camera-snapshot-reticle.snapshot-captured path {
          animation: cameraSnapshotMarksFlash .48s ease-out;
        }
        @keyframes cameraSnapshotFlash {
          0% { fill: transparent; }
          16%, 42% { fill: #ffffff; }
          100% { fill: transparent; }
        }
        @keyframes cameraSnapshotMarksFlash {
          0% { opacity: 1; }
          16%, 42% { opacity: 0; }
          100% { opacity: 1; }
        }
        .scene-root .tv-movie-content {
          opacity: 1;
          transition: opacity .2s ease;
        }
        .scene-root .tv-movie-sky {
          animation: tvMovieSky 8s steps(1, end) infinite;
        }
        .scene-root .tv-movie-sun {
          animation: tvMovieSun 8s ease-in-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
        .scene-root .tv-movie-car {
          animation: tvMovieCar 4.8s linear infinite;
        }
        .scene-root .tv-device-wifi {
          animation: tvWifiPulse 3.6s ease-in-out infinite;
          fill: none;
          opacity: .48;
          stroke: #8ed8ff;
          stroke-linecap: round;
          stroke-width: 1.05px;
        }
        .scene-root .tv-device-wifi circle {
          fill: #8ed8ff;
          stroke: none;
        }
        .scene-root .interactive-shower {
          cursor: pointer;
          outline: none;
        }
        .scene-root .interactive-sleeper {
          cursor: pointer;
          outline: none;
        }
        .scene-root .interactive-sleeper:focus-visible {
          filter: drop-shadow(0 0 4px #b388ff);
        }
        .scene-root .sleep-zs {
          opacity: 1;
          transition: opacity .1s linear;
        }
        .scene-root .sleep-z {
          animation: sleepingZ 2.7s ease-in-out infinite;
          fill: #b9b4ff;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 4.6px;
          font-weight: 800;
          opacity: 0;
        }
        .scene-root .sleep-z-two {
          animation-delay: -.9s;
          font-size: 5.3px;
        }
        .scene-root .sleep-z-three {
          animation-delay: -1.8s;
          font-size: 6px;
        }
        .scene-root .sleep-exclamation {
          fill: #ffd180;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 8px;
          font-weight: 900;
          opacity: 0;
          text-anchor: middle;
          transform-box: fill-box;
          transform-origin: center bottom;
        }
        .scene-root .interactive-sleeper.sleeper-awake .sleep-zs {
          opacity: 0;
        }
        .scene-root .interactive-sleeper.sleeper-awake .sleep-z {
          animation-play-state: paused;
        }
        .scene-root .interactive-sleeper.sleeper-awake .sleep-exclamation {
          animation: sleeperWakePop 1.35s cubic-bezier(.2, .8, .2, 1);
        }
        @keyframes sleepingZ {
          0% { opacity: 0; transform: translate(0, 1.5px) scale(.8); }
          24%, 68% { opacity: .8; }
          100% { opacity: 0; transform: translate(2px, -3.5px) scale(1.08); }
        }
        @keyframes sleeperWakePop {
          0% { opacity: 0; transform: translateY(2px) scale(.45); }
          16% { opacity: 1; transform: translateY(-1px) scale(1.25); }
          42%, 72% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-2px) scale(.82); }
        }
        .scene-root .interactive-shower:focus-visible {
          filter: drop-shadow(0 0 4px #8ed8ff);
        }
        .scene-root .shower-water path {
          animation: showerWaterFlow .62s linear infinite;
          fill: none !important;
          stroke: #8ed8ff;
          stroke-dasharray: 1.3 1.5;
          stroke-linecap: round;
          stroke-width: 1.15px;
        }
        .scene-root .shower-water path:nth-child(2) { animation-delay: -.2s; }
        .scene-root .shower-water path:nth-child(3) { animation-delay: -.4s; }
        .scene-root .shower-splashes circle {
          animation: showerSplash 1.15s ease-out infinite;
          fill: #b3e5fc;
          transform-box: fill-box;
          transform-origin: center;
        }
        .scene-root .shower-splashes circle:nth-child(2) { animation-delay: -.38s; }
        .scene-root .shower-splashes circle:nth-child(3) { animation-delay: -.76s; }
        .scene-root .shower-steam path {
          animation: showerSteam 2.7s ease-in-out infinite;
          fill: none !important;
          opacity: 0;
          stroke: #e4e5f4;
          stroke-linecap: round;
          stroke-width: 1.25px;
          transform-box: fill-box;
          transform-origin: center bottom;
        }
        .scene-root .shower-steam .steam-two { animation-delay: -.9s; }
        .scene-root .shower-steam .steam-three { animation-delay: -1.8s; }
        .scene-root .interactive-shower.shower-stopped .shower-effects {
          opacity: 0;
        }
        .scene-root .interactive-shower.shower-stopped .shower-effects * {
          animation-play-state: paused !important;
        }
        @keyframes showerWaterFlow {
          to { stroke-dashoffset: -5.6; }
        }
        @keyframes showerSplash {
          0% { opacity: 0; transform: translateY(0) scale(.55); }
          28% { opacity: .95; }
          100% { opacity: 0; transform: translateY(-2.2px) scale(1.2); }
        }
        @keyframes showerSteam {
          0% { opacity: 0; transform: translateY(2px) scale(.85); }
          30%, 68% { opacity: .52; }
          100% { opacity: 0; transform: translateY(-4px) scale(1.08); }
        }
        .scene-root.device-off-lamp4 .tv-movie-content,
        .scene-root.device-off-lamp4 .tv-device-wifi {
          opacity: 0 !important;
        }
        .scene-root.device-off-lamp4 .tv-movie-content *,
        .scene-root.device-off-lamp4 .tv-device-wifi {
          animation-play-state: paused !important;
        }
        @keyframes tvMovieCar {
          0% { opacity: 0; transform: translateX(-2px); }
          10%, 82% { opacity: 1; }
          100% { opacity: 0; transform: translateX(10px); }
        }
        @keyframes tvMovieSky {
          0%, 48% { fill: #40558d; }
          50%, 98% { fill: #643f78; }
        }
        @keyframes tvMovieSun {
          0%, 100% { opacity: .9; transform: scale(1); }
          50% { opacity: .55; transform: scale(.72); }
        }
        @keyframes tvWifiPulse {
          0%, 100% { opacity: .28; }
          50% { opacity: .62; }
        }
        .scene-root.lit .lamp { animation: lampFlicker 1s steps(1, end) forwards !important; }
        .scene-root.lit .lamp1 { animation-delay: .2s !important; }
        .scene-root.lit .lamp2 { animation-delay: .4s !important; }
        .scene-root.lit .lamp3 { animation-delay: .6s !important; }
        .scene-root.lit .lamp4 { animation-delay: .8s !important; }
        .scene-root.lit.ambient-ready .lamp { animation: none !important; }
        .scene-root.lit.session-restored .hide { animation: none !important; opacity: 1; }
        .scene-root .data-wire-flow { animation-duration: 1.85s !important; }
        .scene-root .device-toggle-source {
          -webkit-tap-highlight-color: transparent;
          cursor: pointer;
          outline: none;
          touch-action: manipulation;
          user-select: none;
          -webkit-user-select: none;
          transition: filter .18s ease, opacity .18s ease;
        }
        .scene-root.lit .device-toggle-source:hover,
        .scene-root.lit .device-toggle-source:focus-visible {
          filter: drop-shadow(0 0 5px #f4a04f);
        }
        .scene-root.device-off-lamp1 .lamp1.device-room-illumination,
        .scene-root.device-off-lamp2 .lamp2.device-room-illumination,
        .scene-root.device-off-lamp3 .lamp3.device-room-illumination,
        .scene-root.device-off-lamp4 .lamp4.device-room-illumination {
          animation: none !important;
          opacity: 0 !important;
        }
        .scene-root.device-off-lamp1 [data-device-toggle="lamp1"],
        .scene-root.device-off-lamp2 [data-device-toggle="lamp2"],
        .scene-root.device-off-lamp3 [data-device-toggle="lamp3"],
        .scene-root.device-off-lamp4 [data-device-toggle="lamp4"] {
          filter: saturate(.3);
          opacity: .28;
        }
        .scene-root.device-off-lamp1 .device-wire-lamp1,
        .scene-root.device-off-lamp2 .device-wire-lamp2,
        .scene-root.device-off-lamp3 .device-wire-lamp3,
        .scene-root.device-off-lamp4 .device-wire-lamp4 {
          animation-play-state: paused !important;
          opacity: 0 !important;
        }
        .scene-root.device-off-lamp1 .device-node-lamp1,
        .scene-root.device-off-lamp2 .device-node-lamp2,
        .scene-root.device-off-lamp3 .device-node-lamp3,
        .scene-root.device-off-lamp4 .device-node-lamp4 {
          animation-play-state: paused !important;
          opacity: .25 !important;
        }
        .scene-root .chain-hint {
          opacity: 0;
          pointer-events: none;
          transition: opacity .45s ease;
        }
        .scene-root.chain-hint-visible:not(.lit) .chain-hint { opacity: .82; }
        .scene-root .chain-hint text {
          fill: #d7d1c5;
          font-family: "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive;
          font-size: 23px;
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
        .scene-root .landing-review-jump {
          width: fit-content;
          display: grid;
          justify-items: center;
          gap: 7px;
          margin: -8px auto 0;
          color: #aaa9a1;
          font-size: .76rem;
          font-weight: 700;
          letter-spacing: .04em;
          text-decoration: none;
          transition: color .18s ease;
        }
        .scene-root .landing-review-jump:hover,
        .scene-root .landing-review-jump:focus-visible {
          color: #f4a04f;
          outline: none;
        }
        .scene-root .landing-review-jump svg {
          width: 25px;
          height: 25px;
          fill: none;
          stroke: currentColor;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 1.8;
          animation: reviewArrowBounce 1.8s ease-in-out infinite;
        }
        @keyframes reviewArrowBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(5px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .scene-root .landing-review-jump svg { animation: none; }
        }
      `}</style>
    </main>
  );
}
