import Link from "next/link";

import { ViewportSvgAnimation } from "../../components/viewport-svg-animation";

const demoAnimationSources: Record<string, string> = {
  "01": "/demos/motion-lights.svg",
  "02": "/demos/grow-lights.svg",
  "03": "/demos/day-night-modes.svg",
  "04": "/demos/arrival-automation.svg",
  "05": "/demos/physical-controls.svg",
};
const possibilitySections = [
  {
    id: "lighting-and-routines",
    number: "01",
    title: "Lighting that follows your life",
    description: "Let lighting and everyday routines respond naturally to what is happening around your home.",
    items: [
      {
        number: "01",
        title: "Can the lights turn on when I walk into a room?",
        description: "Yes. Lights can turn on when someone enters, switch off when the room is empty, or send you a useful motion notification.",
        mediaLabel: "Motion-aware lighting and notification demo",
      },
      {
        number: "02",
        title: "Can my grow lights follow the actual sunrise and sunset?",
        description: "Yes. Your grow lights can follow local sunrise and sunset times automatically, keeping indoor plants on a natural rhythm throughout the year.",
        mediaLabel: "Sunrise and sunset grow-light automation",
      },
      {
        number: "03",
        title: "Can my home have different morning and bedtime modes?",
        description: "Absolutely. A single scene can coordinate brightness, colour, music, and other devices as your home wakes up or winds down.",
        mediaLabel: "Morning and evening scene demo",
      },
      {
        number: "04",
        title: "Can my home get ready when I arrive—and power down when I leave?",
        description: "Yes. Your home can prepare for your arrival, then turn off selected lights and devices after everyone has left.",
        mediaLabel: "Arrival and departure automation",
      },
    ],
  },
  {
    id: "control-your-way",
    number: "02",
    title: "Control your home your way",
    description: "Use your phone, voice, physical buttons, NFC tags, QR codes, or a custom dashboard—whatever feels most natural.",
    items: [
      {
        number: "05",
        title: "Can I have simple physical controls in every room?",
        description: "Absolutely. Buttons can control lights, music, scenes, or almost any connected device—and do something different when pressed, held, or pressed multiple times.",
        mediaLabel: "Custom physical button controls",
      },
      {
        number: "06",
        title: "Can I tap my phone on something to trigger a routine?",
        description: "Yes. An NFC tag can play music, run a scene, adjust a room, or trigger almost any automation with one quick phone tap.",
        mediaLabel: "NFC tag automation examples",
      },
      {
        number: "07",
        title: "Can a QR code connect guests to Wi-Fi or start a scene?",
        description: "Yes. A QR code can run a scene, play music, or connect guests to your Wi-Fi without making them find and type a password.",
        mediaLabel: "QR code scene and guest Wi-Fi demo",
      },
      {
        number: "08",
        title: "Can I build my own automations without learning to code?",
        description: "Absolutely. Think of it as: IF this happens, THEN do that. If motion is detected, turn on a light. If you leave home, switch everything off.",
        mediaLabel: "If-this-then-that automation builder",
      },
    ],
  },
  {
    id: "entertainment",
    number: "03",
    title: "Music, television, and entertainment",
    description: "Bring music and movies into the same simple controls and routines as the rest of your home.",
    items: [
      {
        number: "09",
        title: "Can I tap an album cover and play it throughout the house?",
        description: "Yes. Place an NFC tag on an album cover, tap it with your phone, and start that music across your smart speakers.",
        mediaLabel: "NFC whole-home audio demo",
      },
      {
        number: "10",
        title: "Can I control my TV from my phone, dashboard, or another remote?",
        description: "Yes. Your television, movies, shows, and playback can be controlled from a phone, physical remote, dashboard, or automation.",
        mediaLabel: "Flexible smart TV controls",
      },
      {
        number: "11",
        title: "Can older remote-controlled devices become part of my smart home?",
        description: "In many cases, yes. An infrared controller can automate televisions, stereos, air conditioners, and other devices that normally need an IR remote.",
        mediaLabel: "Infrared remote automation demo",
      },
    ],
  },
  {
    id: "security-and-awareness",
    number: "04",
    title: "Security and awareness",
    description: "Stay informed about what matters without making your home feel complicated or intrusive.",
    items: [
      {
        number: "12",
        title: "Can my phone tell me when motion is detected?",
        description: "Yes. You can receive useful motion notifications without needing to constantly watch a camera feed.",
        mediaLabel: "Smart motion notification demo",
      },
      {
        number: "13",
        title: "Can my cameras and locks work together when I leave or go to bed?",
        description: "Yes. Cameras and smart locks can be managed together and included in arrival, bedtime, or away routines.",
        mediaLabel: "Camera, lock, and security dashboard",
      },
    ],
  },
  {
    id: "ordinary-devices",
    number: "05",
    title: "Make ordinary devices smart",
    description: "Add useful control to the devices you already own instead of replacing everything in your home.",
    items: [
      {
        number: "14",
        title: "Do I need to replace everything to make my home smart?",
        description: "No. Many existing appliances can gain smart control through plugs, relays, infrared controllers, or button pushers.",
        mediaLabel: "Non-smart device conversion examples",
      },
      {
        number: "15",
        title: "Can something physically press a button for me?",
        description: "Often, yes. A small button-pushing device can automate equipment that cannot otherwise be controlled electronically.",
        mediaLabel: "Physical button-pusher demo",
      },
      {
        number: "16",
        title: "Can my coffee maker start itself every morning?",
        description: "Yes. A scheduled button pusher can start a compatible coffee maker—or press another everyday button automatically.",
        mediaLabel: "Scheduled coffee button automation",
      },
    ],
  },
  {
    id: "dashboards-and-displays",
    number: "06",
    title: "Your home at a glance",
    description: "Bring controls and useful information together in a form that works for you and your household.",
    items: [
      {
        number: "17",
        title: "Can I control my entire home from one simple screen?",
        description: "Yes. Lighting, climate, entertainment, sensors, security, and automations can come together in one clear Home Assistant dashboard.",
        mediaLabel: "Home Assistant dashboard tour",
      },
      {
        number: "18",
        title: "Can a display show useful information without becoming another distraction?",
        description: "Yes. Calendars, weather, reminders, and device status can appear on a smart display or a quiet, low-power e-ink screen.",
        mediaLabel: "Smart and e-ink display examples",
      },
    ],
  },
];

export default function DemosPage() {
  return (
    <main className="possibilities-page">
      <header className="possibilities-hero">
        <p className="eyebrow">You ask. We make it possible.</p>
        <h1>Could my home<br />do that?</h1>
        <p>
          You might be surprised. Here are some questions people ask—and practical
          ways Digital HandyDan can make them possible.
        </p>
        <a className="possibilities-jump" href="#ideas">
          Browse the questions <span aria-hidden="true">↓</span>
        </a>
      </header>

      <div className="possibilities-grid" id="ideas">
        {possibilitySections.map((section) => (
          <section className="possibility-section" id={section.id} key={section.id} aria-labelledby={`${section.id}-title`}>
            <header className="possibility-section-heading">
              <span>{section.number}</span>
              <div>
                <h2 id={`${section.id}-title`}>{section.title}</h2>
                <p>{section.description}</p>
              </div>
            </header>
            <div className="possibility-section-grid">
              {section.items.map((item) => (
                <article className="possibility-card" key={item.number}>
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
                    <h3>{item.title}</h3>
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
