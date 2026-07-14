import Link from "next/link";

const possibilitySections = [
  {
    id: "lighting-and-routines",
    number: "01",
    title: "Lighting that follows your life",
    description: "Let lighting and everyday routines respond naturally to what is happening around your home.",
    items: [
      {
        number: "01",
        title: "Lights that respond to motion",
        description: "Turn lights on when someone enters, switch them off when the room is empty, or receive a useful motion notification.",
        mediaLabel: "Motion-aware lighting and notification demo",
      },
      {
        number: "02",
        title: "Grow lights that follow the sun",
        description: "Keep indoor plants on a natural rhythm with grow lights scheduled around your local sunrise and sunset.",
        mediaLabel: "Sunrise and sunset grow-light automation",
      },
      {
        number: "03",
        title: "Morning and evening scenes",
        description: "Coordinate brightness, colour, music, and other devices as your home eases into the day or winds down at night.",
        mediaLabel: "Morning and evening scene demo",
      },
      {
        number: "04",
        title: "Location-based routines",
        description: "Prepare the house when you arrive, or turn off selected lights and devices after everyone leaves.",
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
        title: "Physical controls for every room",
        description: "Place simple physical buttons wherever they are useful, then customize them to control lights, music, scenes, or almost any connected device. A button can even perform different actions when pressed, held, or pressed multiple times.",
        mediaLabel: "Custom physical button controls",
      },
      {
        number: "06",
        title: "Tap to make something happen",
        description: "Use NFC tags to play music, run a scene, adjust a room, or trigger almost any automation with a quick phone tap.",
        mediaLabel: "NFC tag automation examples",
      },
      {
        number: "07",
        title: "Scan and go",
        description: "Use QR codes to run scenes, play music, or help guests connect to your Wi-Fi without finding and typing a password.",
        mediaLabel: "QR code scene and guest Wi-Fi demo",
      },
      {
        number: "08",
        title: "Automations built around you",
        description: "Think of it as: if this happens, then do that. If motion is detected, turn on a light. If you leave home, switch everything off. Combine simple rules like these to make your home respond automatically.",
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
        title: "Tap an album to play it everywhere",
        description: "Place an NFC tag on an album cover, tap it with your phone, and start the music across your smart speakers.",
        mediaLabel: "NFC whole-home audio demo",
      },
      {
        number: "10",
        title: "Control your TV from almost anything",
        description: "Control your smart TV, movies, shows, and playback from a phone, physical remote, dashboard, or automation.",
        mediaLabel: "Flexible smart TV controls",
      },
      {
        number: "11",
        title: "Give old remotes new life",
        description: "Use an infrared controller to automate televisions, stereos, air conditioners, and other devices that normally need an IR remote.",
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
        title: "Know when something moves",
        description: "Receive useful motion notifications without needing to constantly watch a camera feed.",
        mediaLabel: "Smart motion notification demo",
      },
      {
        number: "13",
        title: "Smarter cameras and locks",
        description: "View cameras, manage smart locks, and include security devices in arrival, bedtime, or away routines.",
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
        title: "Upgrade without replacing everything",
        description: "Add smart control to compatible non-smart appliances using plugs, relays, infrared controllers, or button pushers.",
        mediaLabel: "Non-smart device conversion examples",
      },
      {
        number: "15",
        title: "Physically press almost any button",
        description: "Automate devices that cannot otherwise be controlled electronically by adding a small device that presses their existing button.",
        mediaLabel: "Physical button-pusher demo",
      },
      {
        number: "16",
        title: "Start the coffee in the morning",
        description: "Schedule a physical button pusher to start a coffee maker—or press another everyday button automatically.",
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
        title: "A dashboard for your whole home",
        description: "Bring lighting, climate, entertainment, sensors, security, and automations together in one clear Home Assistant dashboard.",
        mediaLabel: "Home Assistant dashboard tour",
      },
      {
        number: "18",
        title: "Useful information at a glance",
        description: "Show calendars, weather, reminders, and device status on a smart display or quiet, low-power e-ink screen.",
        mediaLabel: "Smart and e-ink display examples",
      },
    ],
  },
];

export default function DemosPage() {
  return (
    <main className="possibilities-page">
      <header className="possibilities-hero">
        <p className="eyebrow">What&apos;s possible?</p>
        <h1>Small ideas.<br />A smarter home.</h1>
        <p>
          Smart-home technology is most useful when it quietly fits into your life.
          Here are a few practical ways your home can feel more responsive, helpful, and personal.
        </p>
        <a className="possibilities-jump" href="#ideas">Explore the ideas <span aria-hidden="true">↓</span></a>
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
                  <div className="possibility-media" role="img" aria-label={`Media placeholder: ${item.mediaLabel}`}>
                    <span>{item.number}</span>
                    <p>Photo or video</p>
                    <small>{item.mediaLabel}</small>
                  </div>
                  <div className="possibility-copy">
                    <span>{item.number}</span>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="possibilities-cta">
        <p className="eyebrow">Have an idea of your own?</p>
        <h2>Let&apos;s make your home work the way you want it to.</h2>
        <Link className="primary-button" href="/book">Book a consultation</Link>
      </section>
    </main>
  );
}
