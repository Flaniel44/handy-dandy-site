import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import danielPortrait from "../../public/images/daniel-about.jpg";

export const metadata: Metadata = {
  title: "Get to Know Me",
  description: "Meet Daniel, the friendly local tech helper behind Digital HandyDan in Ottawa, and learn why he loves making technology easier and more useful.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "Meet Daniel | Digital HandyDan",
    description: "Friendly, patient technology help and creative smart-home guidance from someone local to Ottawa.",
    url: "/about",
  },
};

const values = [
  { title: "No judgement", description: "There are no embarrassing questions. We start wherever you feel comfortable." },
  { title: "Plain language", description: "I explain things clearly, without burying the answer in technical jargon." },
  { title: "Patient guidance", description: "We move at your pace, and I make sure you feel comfortable using everything." },
  { title: "Practical recommendations", description: "Your needs and budget come first—including reusing technology you already own." },
];

const helpAreas = [
  {
    number: "01",
    title: "Everyday technology help",
    description: "Phones, computers, Wi-Fi, setup, maintenance, troubleshooting, and the little frustrations that get in the way.",
  },
  {
    number: "02",
    title: "Smart-home possibilities",
    description: "Lighting, entertainment, security, automations, dashboards, and thoughtful systems that make your home work better.",
  },
];

function ImagePlaceholder({ label, note, className = "" }: { label: string; note: string; className?: string }) {
  return (
    <div className={`about-image-placeholder ${className}`.trim()} role="img" aria-label={`${label} image placeholder`}>
      <svg viewBox="0 0 72 72" aria-hidden="true">
        <rect x="7" y="11" width="58" height="50" rx="6" />
        <circle cx="26" cy="29" r="7" />
        <path d="m12 54 15-15 10 9 8-8 15 14" />
      </svg>
      <strong>{label}</strong>
      <span>{note}</span>
    </div>
  );
}

export default function AboutPage() {
  return (
    <main className="about-page">
      <section className="about-hero" aria-labelledby="about-title">
        <div className="about-hero-copy">
          <p className="eyebrow">Get to know me</p>
          <h1 id="about-title">Hi, I&apos;m Daniel.</h1>
          <p className="about-lede">
            I&apos;m that guy who friends, family, and neighbours call when technology becomes confusing—or when they have an idea they aren&apos;t sure is possible.
          </p>
        </div>
        <div className="about-portrait about-portrait-placeholder">
          <Image
            src={danielPortrait}
            alt="Daniel smiling outdoors with a young child"
            fill
            priority
            sizes="(max-width: 760px) min(100vw - 40px, 420px), 36vw"
          />
        </div>
      </section>

      <section className="about-story" aria-labelledby="about-story-title">
        <div className="about-section-heading">
          <p className="eyebrow">How it started</p>
          <h2 id="about-story-title">From family tech helper to Digital HandyDan.</h2>
        </div>
        <div className="about-story-copy">
          <p>
            I&apos;ve been my family&apos;s dedicated tech guru since I was young. Over the years, that grew into helping neighbours, volunteering with seniors (shoutout to ABLE2!), and making technology feel less intimidating.
          </p>
          <p>
            After seeing how much I enjoyed it, my neighbour suggested I turn that passion into a business that could help more people in my community. Digital HandyDan grew from that simple idea: friendly, local help from someone who genuinely enjoys solving the problem.
          </p>
        </div>
      </section>

      <section className="about-smart-home" aria-labelledby="about-smart-home-title">
        <ImagePlaceholder label="Daniel's smart-home setup" note="Project photo placeholder" className="about-project-placeholder" />
        <div>
          <p className="eyebrow">A lifelong smart-home enthusiast</p>
          <h2 id="about-smart-home-title">I love discovering what a home can do.</h2>
          <p>
            I&apos;ve spent years experimenting with my own smart home and creating features people are often surprised to learn are possible. Before long, I was helping friends improve their homes too.
          </p>
          <p>
            I get real enjoyment from making technology run better, inventing useful automations, and watching an idea turn into something that makes everyday life easier.
          </p>
        </div>
      </section>

      <section className="about-values" aria-labelledby="about-values-title">
        <div className="about-section-heading">
          <p className="eyebrow">Technology without the intimidation</p>
          <h2 id="about-values-title">Help should feel human.</h2>
        </div>
        <div className="about-values-grid">
          {values.map((value) => (
            <article key={value.title}>
              <h3>{value.title}</h3>
              <p>{value.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-help" aria-labelledby="about-help-title">
        <div className="about-section-heading">
          <p className="eyebrow">How I can help</p>
          <h2 id="about-help-title">From frustrating fixes to exciting ideas.</h2>
        </div>
        <div className="about-help-grid">
          {helpAreas.map((area) => (
            <article key={area.number}>
              <span>{area.number}</span>
              <h3>{area.title}</h3>
              <p>{area.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-local" aria-labelledby="about-local-title">
        <p className="eyebrow">Proudly serving Ottawa</p>
        <h2 id="about-local-title">Local help from someone who cares.</h2>
        <p>
          Digital HandyDan was created to give people in Ottawa a friendly, local person they can turn to when technology isn&apos;t working—or when they want it to do something better.
        </p>
        <blockquote>
          “The best result isn&apos;t simply getting something working. It&apos;s leaving you with technology that feels useful, understandable, and genuinely yours.”
        </blockquote>
      </section>

      <section className="about-cta" aria-labelledby="about-cta-title">
        <p className="eyebrow">Ready when you are</p>
        <h2 id="about-cta-title">Let&apos;s make technology work better for you.</h2>
        <div>
          <Link className="about-book-button" href="/book">Book an appointment</Link>
          <Link className="about-demos-button" href="/demos">Explore what&apos;s possible</Link>
        </div>
      </section>
    </main>
  );
}
