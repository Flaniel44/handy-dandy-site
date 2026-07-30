import Link from "next/link";

import { ViewportSvgAnimation } from "../../components/viewport-svg-animation";

const demoAnimationSources: Record<string, string> = {
  "01": "/demos/motion-lights.svg",
  "02": "/demos/grow-lights.svg",
  "03": "/demos/day-night-modes.svg",
  "04": "/demos/arrival-automation.svg",
  "05": "/demos/physical-controls.svg",
  "06": "/demos/phone-tap-routine.svg",
  "07": "/demos/qr-code-guest-wifi.svg",
  "08": "/demos/automation-builder.svg",
  "09": "/demos/infrared-devices.svg",
  "10": "/demos/scheduled-coffee.svg",
  "11": "/demos/smart-display-dashboard.svg",
  "12": "/demos/local-private-network.svg",
  "13": "/demos/vacation-security.svg",
};
const possibilitySections = [
  {
    id: "lighting-and-routines",
    number: "01",
    title: "Lighting that follows your life",
    items: [
      {
        number: "01",
        title: "Can the lights turn on when I walk into a room?",
        emphasis: "walk into a room",
        description: "Yes. Lights can turn on when someone enters, switch off when the room is empty, or send you a useful motion notification.",
        mediaLabel: "Motion-aware lighting and notification demo",
      },
      {
        number: "02",
        title: "Can my grow lights follow the sun?",
        emphasis: "follow the sun",
        description: "Yes. Your grow lights can follow local sunrise and sunset times automatically, keeping indoor plants on a natural rhythm throughout the year.",
        mediaLabel: "Sunrise and sunset grow-light automation",
      },
      {
        number: "03",
        title: "Can my home have different morning and bedtime modes?",
        emphasis: "morning and bedtime modes",
        description: "Absolutely. A single scene can coordinate brightness, colour, music, and other devices as your home wakes up or winds down.",
        mediaLabel: "Morning and evening scene demo",
      },
      {
        number: "04",
        title: "Can my home react to my arrival and departure?",
        emphasis: "arrival and departure",
        description: "Yes. Your home can prepare for your arrival, then turn off selected lights and devices after everyone has left.",
        mediaLabel: "Arrival and departure automation",
      },
    ],
  },
  {
    id: "control-your-way",
    number: "02",
    title: "Control your home your way",
    items: [
      {
        number: "05",
        title: "Can I have simple physical controls in every room?",
        emphasis: "physical controls",
        description: "Absolutely. Buttons can control lights, music, scenes, or almost any connected device—and do something different when pressed, held, or pressed multiple times.",
        mediaLabel: "Custom physical button controls",
      },
      {
        number: "06",
        title: "Can I tap my phone to trigger a routine?",
        emphasis: "tap my phone",
        description: "Yes. An NFC tag can play music, run a scene, adjust a room, or trigger almost any automation with one quick phone tap.",
        mediaLabel: "NFC tag automation examples",
      },
      {
        number: "07",
        title: "Can a QR code connect guests to Wi-Fi or start a scene?",
        emphasis: "QR code",
        description: "Yes. A QR code can run a scene, play music, or connect guests to your Wi-Fi without making them find and type a password.",
        mediaLabel: "QR code scene and guest Wi-Fi demo",
      },
      {
        number: "08",
        title: "Can I build my own automations without learning to code?",
        emphasis: "build my own",
        description: "Absolutely. Think of it as: IF this happens, THEN do that. If motion is detected, turn on a light. If you leave home, switch everything off.",
        mediaLabel: "If-this-then-that automation builder",
      },
    ],
  },
  {
    id: "entertainment",
    number: "03",
    title: "Music, television, and entertainment",
    items: [
      {
        number: "09",
        title: "Can older devices become part of my smart home?",
        emphasis: "older devices",
        description: "In many cases, yes. An infrared controller can automate televisions, stereos, air conditioners, and other devices that normally need an IR remote.",
        mediaLabel: "Infrared remote automation demo",
      },
    ],
  },
  {
    id: "ordinary-devices",
    number: "04",
    title: "Make ordinary devices smart",
    items: [
      {
        number: "10",
        title: "Can my coffee maker start itself every morning?",
        emphasis: "coffee maker start itself",
        description: "Yes. A scheduled button pusher can start a compatible coffee maker—or press another everyday button automatically.",
        mediaLabel: "Scheduled coffee button automation",
      },
    ],
  },
  {
    id: "dashboards-and-displays",
    number: "05",
    title: "Your home at a glance",
    items: [
      {
        number: "11",
        title: "Can one simple screen control my home and show useful information?",
        emphasis: "one simple screen",
        description: "Yes. A custom dashboard can be built for you to control your devices, show calendars, weather, reminders, and device status without becoming another distraction.",
        mediaLabel: "Home Assistant dashboard and smart display examples",
      },
    ],
  },
  {
    id: "security-and-resilience",
    number: "06",
    title: "Security and resilience",
    items: [
      {
        number: "12",
        title: "Can my smart home stay private and keep working without the internet?",
        emphasis: "private and keep working",
        description: "Yes. A fully local setup can keep device traffic inside your home network, while core controls and automations continue working if the internet goes down. The network can also be secured so smart devices only access what they need.",
        mediaLabel: "Private local-control and internet-outage demonstration",
      },
      {
        number: "13",
        title: "Can my home help protect itself while I am away?",
        emphasis: "protect itself while I am away",
        description: "Yes. Water-leak sensors can warn you early, outdoor motion can trigger lighting and intelligent camera capture, and vacation routines can vary lights and other devices to make your home appear occupied.",
        mediaLabel: "Leak detection, outdoor security, and vacation-presence demonstration",
      },
    ],
  },
];

function QuestionTitle({ title, emphasis }: { title: string; emphasis: string }) {
  const emphasisStart = title.indexOf(emphasis);
  if (emphasisStart === -1) return title;

  return (
    <>
      {title.slice(0, emphasisStart)}
      <strong>{emphasis}</strong>
      {title.slice(emphasisStart + emphasis.length)}
    </>
  );
}

export default function DemosPage() {
  return (
    <main className="possibilities-page">
      <header className="possibilities-hero">
        <div className="possibilities-hero-copy">
          <p className="eyebrow">You ask. We make it possible.</p>
          <h1>Could my home<br />do that?</h1>
          <p>
            You might be surprised. Here are some questions people ask—and practical
            ways Digital Handyman can make them possible.
          </p>
        </div>
        <nav className="possibilities-topics" aria-label="Smart home topics">
          <p>Explore a topic</p>
          <ol>
            {possibilitySections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>
                  <span>{section.number}</span>
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      <div className="possibilities-grid" id="ideas">
        {possibilitySections.map((section) => (
          <section className="possibility-section" id={section.id} key={section.id} aria-label={section.title}>
            <div className="possibility-section-grid">
              {section.items.map((item) => (
                <article
                  className={`possibility-card ${item.number === "08" ? "has-wide-demo" : ""} ${item.number === "10" || item.number === "12" ? "demo-right" : ""} ${item.number === "13" ? "media-left" : ""}`}
                  key={item.number}
                >
                  <div className={`possibility-media ${demoAnimationSources[item.number] ? "has-demo-animation" : ""}`}>
                    <span>{item.number}</span>
                    {demoAnimationSources[item.number] ? (
                      <ViewportSvgAnimation
                        src={demoAnimationSources[item.number]}
                        label={item.mediaLabel}
                      />
                    ) : (
                      <>
                        <p>Photo or video</p>
                        <small>{item.mediaLabel}</small>
                      </>
                    )}
                  </div>
                  <div className="possibility-copy">
                    <span>Question {item.number}</span>
                    <h3><QuestionTitle title={item.title} emphasis={item.emphasis} /></h3>
                    <p><strong>Answer:</strong> {item.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="possibilities-cta">
        <p className="eyebrow">Have a question of your own?</p>
        <h2>Let&apos;s make your home work the way you want it to.</h2>
        <Link className="primary-button" href="/book">Book a consultation</Link>
      </section>
    </main>
  );
}
