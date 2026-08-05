import Link from "next/link";
import type { Metadata } from "next";

import { JsonLd } from "../../components/json-ld";
import { ViewportSvgAnimation } from "../../components/viewport-svg-animation";

export const metadata: Metadata = {
  title: "Smart-home automation ideas and examples",
  description: "Explore practical smart-home ideas for lighting, security, entertainment, energy monitoring, dashboards, local control, and everyday comfort.",
  alternates: { canonical: "/demos" },
  openGraph: {
    title: "What can a smart home do? | Digital HandyDan",
    description: "See practical examples of useful, private, and approachable home automation.",
    url: "/demos",
  },
};

const demoAnimationSources: Record<string, string> = {
  "01": "/demos/arrival-automation.svg",
  "02": "/demos/motion-lights.svg",
  "03": "/demos/whole-home-entertainment.svg",
  "04": "/demos/day-night-modes.svg",
  "05": "/demos/physical-controls.svg",
  "06": "/demos/baby-monitoring.svg",
  "07": "/demos/vacation-security.svg",
  "08": "/demos/energy-monitoring.svg",
  "09": "/demos/local-private-network.svg",
  "10": "/demos/smart-display-dashboard.svg",
  "11": "/demos/automation-builder.svg",
  "12": "/demos/infrared-devices.svg",
  "13": "/demos/phone-tap-routine.svg",
  "14": "/demos/qr-code-guest-wifi.svg",
  "15": "/demos/scheduled-coffee.svg",
  "16": "/demos/grow-lights.svg",
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
        description: "Yes. As you approach, your home can open a compatible garage door, turn on entry lights, adjust the temperature, start music, and bring selected rooms to life. Once everyone leaves, it can lock compatible doors, close the garage, switch off forgotten devices, set back the thermostat, arm cameras, and alert you if something was left open—all according to the routines and safeguards you choose.",
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
        number: "15",
        title: "Can I play audio in every room and have my lights match the TV?",
        emphasis: "audio in every room",
        description: "Yes. Speakers can play together throughout your home, while lights around the television react to the colours on screen for a more immersive movie, game, or music experience.",
        mediaLabel: "Whole-home audio and TV-synced lighting demonstration",
      },
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
        number: "16",
        title: "Can my home help me monitor the baby without constant checking?",
        emphasis: "monitor the baby",
        description: "Yes. A private baby-monitoring setup can show audio or video when you want it and send useful notifications when sound or movement needs your attention.",
        mediaLabel: "Private baby monitoring and notification demonstration",
      },
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
  {
    id: "energy-and-efficiency",
    number: "07",
    title: "Energy and efficiency",
    items: [
      {
        number: "14",
        title: "Can my home show me where energy is being wasted?",
        emphasis: "where energy is being wasted",
        description: "Yes. Energy monitoring can show which devices consume the most power, reveal unusual usage, and help schedule appliances for more efficient times, all from one clear dashboard.",
        mediaLabel: "Household energy monitoring and high-usage detection demonstration",
      },
    ],
  },
];

const possibilityItemCatalog = new Map(
  possibilitySections.flatMap((section) =>
    section.items.map((item) => [item.number, item] as const),
  ),
);

function orderedItems(entries: Array<[sourceNumber: string, displayNumber: string]>) {
  return entries.map(([sourceNumber, displayNumber]) => {
    const item = possibilityItemCatalog.get(sourceNumber);
    if (!item) throw new Error(`Unknown possibility item: ${sourceNumber}`);
    return { ...item, number: displayNumber };
  });
}

const orderedPossibilitySections = [
  {
    id: "everyday-comfort",
    number: "01",
    title: "Everyday Comfort / Home Theater",
    items: orderedItems([
      ["04", "01"],
      ["01", "02"],
      ["15", "03"],
      ["03", "04"],
      ["05", "05"],
    ]),
  },
  {
    id: "security-and-monitoring",
    number: "02",
    title: "Security and Monitoring",
    items: orderedItems([
      ["16", "06"],
      ["13", "07"],
      ["14", "08"],
      ["12", "09"],
    ]),
  },
  {
    id: "one-simple-system",
    number: "03",
    title: "One simple, flexible system",
    items: orderedItems([
      ["11", "10"],
      ["08", "11"],
      ["09", "12"],
    ]),
  },
  {
    id: "creative-possibilities",
    number: "04",
    title: "Creative possibilities",
    items: orderedItems([
      ["06", "13"],
      ["07", "14"],
      ["10", "15"],
      ["02", "16"],
    ]),
  },
];

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: orderedPossibilitySections.flatMap((section) => section.items.map((item) => ({
    "@type": "Question",
    name: item.title,
    acceptedAnswer: { "@type": "Answer", text: item.description },
  }))),
};

const serviceQuestions = [
  {
    title: "Can I start small and expand later?",
    description: "Absolutely. We can begin with one room or one everyday frustration, then create a practical plan that grows with your needs and budget.",
  },
  {
    title: "Can you fix or simplify the smart home I already have?",
    description: "Yes. I can troubleshoot unreliable devices, clean up confusing automations, reduce unnecessary apps, and bring your existing equipment into one easier system.",
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
      <JsonLd data={faqStructuredData} />
      <header className="possibilities-hero">
        <div className="possibilities-hero-copy">
          <p className="eyebrow">You ask. We make it possible.</p>
          <h1>Could my home<br />do that?</h1>
          <p>
            You might be surprised. Here are some questions people ask—and practical
            ways Digital HandyDan can make them possible.
          </p>
        </div>
        <nav className="possibilities-topics" aria-label="Smart home topics">
          <p>Explore a topic</p>
          <ol>
            {orderedPossibilitySections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>
                  <span>{section.number}</span>
                  {section.title}
                </a>
              </li>
            ))}
            <li>
              <a href="#help-at-any-stage">
                <span>05</span>
                Help at any stage
              </a>
            </li>
          </ol>
        </nav>
      </header>

      <div className="possibilities-grid" id="ideas">
        {orderedPossibilitySections.map((section) => (
          <section className="possibility-section" id={section.id} key={section.id} aria-label={section.title}>
            <div className="possibility-section-grid">
              {section.items.map((item) => (
                <article
                  className={`possibility-card ${item.number === "11" ? "has-wide-demo" : ""} ${Number(item.number) % 2 === 0 ? "media-right" : "media-left"}`}
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

      <section className="possibility-services" id="help-at-any-stage" aria-labelledby="possibility-services-title">
        <div className="possibility-section-heading">
          <p className="eyebrow">Help at any stage</p>
          <h2 id="possibility-services-title">Start with what you have.</h2>
          <p>You do not need to replace everything or automate your entire home at once.</p>
        </div>
        <div className="possibility-service-grid">
          {serviceQuestions.map((service, index) => (
            <article className="possibility-service-card" key={service.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="possibilities-cta">
        <p className="eyebrow">Have a question of your own?</p>
        <h2>Let&apos;s make your home work the way you want it to.</h2>
        <Link className="primary-button" href="/book">Book a consultation</Link>
      </section>
    </main>
  );
}
