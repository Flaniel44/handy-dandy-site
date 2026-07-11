import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const scenePath = path.resolve(
  process.cwd(),
  "..",
  "..",
  "reference",
  "lamp_pull_landing_scene_v37.html",
);

export async function GET() {
  const scene = await readFile(scenePath, "utf8");
  const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME ?? "Handy Dandy";
  const businessEmail = process.env.NEXT_PUBLIC_BUSINESS_EMAIL ?? "hello@example.com";
  const contactUrl = `mailto:${businessEmail}`;
  const renderedScene = scene
    .replace("[ your business name ]", escapeHtml(businessName))
    .replace("[ a one-line slogan about what you do ]", "Smart-home guidance, made simple.")
    .replaceAll('stroke="#b4b2a9"', 'stroke="#777a80"')
    .replaceAll("#b4b2a9", "#7f77dd")
    .replaceAll("#8f8d84", "#5c55aa")
    .replaceAll('dur="16s"', 'dur="4s"')
    .replaceAll('begin="-4s"', 'begin="-1s"')
    .replaceAll('begin="-8s"', 'begin="-2s"')
    .replaceAll('begin="-12s"', 'begin="-3s"');

  const bridge = `
    <style>
      /* Keep the one-time power-on flicker, then let the script below choose one
         whole room for each ambient flicker instead of looping every lamp. */
      .scene-root.lit .lamp { animation: lampFlicker 1s steps(1, end) forwards !important; }
      .scene-root.lit .lamp1 { animation-delay: .2s !important; }
      .scene-root.lit .lamp2 { animation-delay: .4s !important; }
      .scene-root.lit .lamp3 { animation-delay: .6s !important; }
      .scene-root.lit .lamp4 { animation-delay: .8s !important; }
      .scene-root.lit.ambient-ready .lamp { animation: none !important; }
      .scene-root.lit.session-restored .hide { animation: none !important; opacity: 1; }
    </style>
    <script>
      window.sendPrompt = function (prompt) {
        if (prompt.includes('contact')) window.parent.location.href = ${JSON.stringify(contactUrl)};
        else if (prompt.includes('booking')) window.parent.location.href = '/book';
        else if (prompt.includes('demos')) window.parent.location.href = '/demos';
      };

      (function rememberPoweredState() {
        const root = document.getElementById('scene-root');
        const storageKey = 'handy-dandy-house-powered';
        if (!root) return;

        try {
          if (window.parent.sessionStorage.getItem(storageKey) === 'true') {
            root.classList.add('lit', 'session-restored', 'ambient-ready');
          }
        } catch (_) {
          // The scene still works if storage is unavailable or blocked.
        }

        window.toggleLight = function () {
          root.classList.toggle('lit');
          try {
            if (root.classList.contains('lit')) {
              window.parent.sessionStorage.setItem(storageKey, 'true');
            } else {
              window.parent.sessionStorage.removeItem(storageKey);
            }
          } catch (_) {
            // Keep the interaction functional without persistence.
          }
        };
      })();

      (function enlargePullChainTarget() {
        const chain = document.querySelector('.chain');
        if (!chain) return;

        const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        hitArea.setAttribute('x', '316');
        hitArea.setAttribute('y', '-45');
        hitArea.setAttribute('width', '48');
        hitArea.setAttribute('height', '166');
        hitArea.setAttribute('rx', '18');
        hitArea.setAttribute('fill', 'transparent');
        hitArea.setAttribute('pointer-events', 'all');
        hitArea.setAttribute('aria-hidden', 'true');
        chain.insertBefore(hitArea, chain.firstChild);
      })();

      (function startRandomRoomFlicker() {
        const root = document.getElementById('scene-root');
        const roomClasses = ['lamp1', 'lamp2', 'lamp3', 'lamp4'];
        let previousRoom = -1;
        let powered = false;
        let ambientTimer;
        let releaseTimer;

        function flickerRandomRoom() {
          if (!root || !root.classList.contains('lit')) return;

          let room = Math.floor(Math.random() * roomClasses.length);
          if (room === previousRoom) {
            room = (room + 1 + Math.floor(Math.random() * (roomClasses.length - 1))) % roomClasses.length;
          }
          previousRoom = room;

          const lights = Array.from(document.querySelectorAll('.' + roomClasses[room]));

          function setRoomOpacity(value, transition) {
            lights.forEach(function (light) {
              light.style.setProperty('transition', transition || 'opacity 90ms ease-out', 'important');
              light.style.setProperty('opacity', String(value), 'important');
            });
          }

          function releaseRoomOpacity() {
            lights.forEach(function (light) {
              light.style.removeProperty('opacity');
              light.style.removeProperty('transition');
            });
          }

          // A brief, deep voltage drop with a quick recovery—not a repeated strobe.
          window.requestAnimationFrame(function () {
            window.requestAnimationFrame(function () { setRoomOpacity(.26); });
          });
          window.setTimeout(function () {
            setRoomOpacity(1, 'opacity 170ms ease-in');
          }, 190);
          window.setTimeout(releaseRoomOpacity, 480);
        }

        function syncPoweredState() {
          const isPowered = Boolean(root && root.classList.contains('lit'));
          if (isPowered === powered) return;
          powered = isPowered;

          window.clearInterval(ambientTimer);
          window.clearTimeout(releaseTimer);

          if (powered) {
            if (root.classList.contains('session-restored')) {
              root.classList.add('ambient-ready');
            } else {
              root.classList.remove('ambient-ready');
              // The slowest room finishes its power-on flicker after 1.8 seconds.
              // Releasing the retained CSS animation lets Web Animations control opacity.
              releaseTimer = window.setTimeout(function () {
                root.classList.add('ambient-ready');
              }, 1900);
            }
            ambientTimer = window.setInterval(flickerRandomRoom, 9000);
          } else {
            root.classList.remove('ambient-ready');
            previousRoom = -1;
            root.classList.remove('session-restored');
          }
        }

        if (root) {
          new MutationObserver(syncPoweredState).observe(root, {
            attributes: true,
            attributeFilter: ['class']
          });
          syncPoweredState();
        }
      })();
    </script>`;

  const document = `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(businessName)} | Smart-home consultations</title>
        <style>
          :root { --font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; --text-primary: #f5f5f5; --text-secondary: #a9a8a0; color-scheme: dark; }
          * { box-sizing: border-box; }
          html, body { margin: 0; min-height: 100%; background: #0b0d16; }
          body { min-height: 100vh; display: grid; place-items: center; padding: clamp(12px, 3vw, 32px); }
          #scene-root { width: min(100%, 760px); }
          .stage { box-shadow: 0 32px 90px #0008; }
          .cta-row { padding-top: 18px; }
          .cta-row button { padding: 11px 17px; border: 1px solid #3a4468; border-radius: 8px; background: #232b47; color: #f5f5f5; cursor: pointer; font: inherit; }
          .cta-row button:hover, .cta-row button:focus-visible { background: #303a60; outline: 2px solid #f59842; outline-offset: 2px; }
          /* The pull-chain reveal is essential to this scene. Reduced-motion mode
             keeps that reveal intact and only removes the recurring room flicker. */
          @media (prefers-reduced-motion: reduce) {
            .scene-root.lit .lamp { animation-name: lampFlicker !important; animation-duration: 1s !important; animation-iteration-count: 1 !important; }
          }
        </style>
      </head>
      <body>
        ${renderedScene}
        ${bridge}
      </body>
    </html>`;

  return new Response(document, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  })[character] ?? character);
}
