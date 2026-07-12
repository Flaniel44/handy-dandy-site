import Link from "next/link";

const possibilities = [
  {
    number: "01",
    title: "Lights that respond to motion",
    description: "Walk into a room and have the right lights turn on automatically—then switch off when nobody is there.",
    mediaLabel: "Motion-sensor lighting demo",
  },
  {
    number: "02",
    title: "Grow lights that follow the sun",
    description: "Keep indoor plants on a natural rhythm with grow lights that adjust to local sunrise and sunset times.",
    mediaLabel: "Sunrise and sunset automation",
  },
  {
    number: "03",
    title: "Tap an album to play it everywhere",
    description: "Place an NFC tag on an album cover, tap it with your phone, and start the music across your smart speakers.",
    mediaLabel: "NFC whole-home audio demo",
  },
  {
    number: "04",
    title: "One remote, almost endless controls",
    description: "Use Philips Hue dimmer remotes for much more than lighting—play music, trigger scenes, or control other smart devices.",
    mediaLabel: "Smart dimmer remote demo",
  },
  {
    number: "05",
    title: "Morning and evening scenes",
    description: "Let your home ease into the day and wind down at night with coordinated lighting that changes automatically.",
    mediaLabel: "Daily lighting scene demo",
  },
  {
    number: "06",
    title: "A dashboard for your whole home",
    description: "Bring lights, climate, media, sensors, and automations together in one clear Home Assistant dashboard.",
    mediaLabel: "Home Assistant dashboard tour",
  },
  {
    number: "07",
    title: "Useful information at a glance",
    description: "Turn a smart display or low-power e-ink screen into a quiet, always-available view of the information that matters.",
    mediaLabel: "Smart and e-ink display examples",
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

      <section className="possibilities-grid" id="ideas" aria-label="Smart-home possibilities">
        {possibilities.map((item) => (
          <article className="possibility-card" key={item.number}>
            <div className="possibility-media" role="img" aria-label={`Media placeholder: ${item.mediaLabel}`}>
              <span>{item.number}</span>
              <p>Photo or video</p>
              <small>{item.mediaLabel}</small>
            </div>
            <div className="possibility-copy">
              <span>{item.number}</span>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="possibilities-cta">
        <p className="eyebrow">Have an idea of your own?</p>
        <h2>Let&apos;s make your home work the way you want it to.</h2>
        <Link className="primary-button" href="/book">Book a consultation</Link>
      </section>
    </main>
  );
}
