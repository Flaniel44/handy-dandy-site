import Link from "next/link";

const workingTogetherSteps = [
  { title: "We discuss your aspirations and frustrations", description: "You tell me what you would love your home to do, along with anything that currently feels inconvenient or unreliable." },
  { title: "I review what you already own", description: "We may be able to reuse more of your existing technology than you think!" },
  { title: "We work on a practical plan", description: "Together, we choose improvements that fit your priorities and budget." },
  { title: "Everything is configured and tested", description: "Devices and automations are tested under real everyday conditions." },
  { title: "I guide you on how to use everything", description: "You receive straightforward guidance and documentation, so your system always feels approachable." },
  { title: "Your system stays maintainable", description: "Low-battery warnings, device-health monitoring, backups, and optional ongoing support help prevent small problems from becoming frustrating ones." },
];

const offeringTopics = [
  { number: "01", title: "Everyday Comfort / Home Theatre", href: "/demos#everyday-comfort" },
  { number: "02", title: "Security and Monitoring", href: "/demos#security-and-monitoring" },
  { number: "03", title: "One simple, flexible system", href: "/demos#one-simple-system" },
  { number: "04", title: "Creative possibilities", href: "/demos#creative-possibilities" },
  { number: "05", title: "Help at any stage", href: "/demos#help-at-any-stage" },
];

export function LandingMarketingSections() {
  return (
    <div className="landing-marketing">
      <section className="working-together landing-working-together" id="working-with-me" aria-labelledby="working-together-title">
        <div className="possibility-section-heading">
          <p className="eyebrow">A clear, personal process</p>
          <h2 id="working-together-title">What working with me looks like.</h2>
          <Link className="working-together-about-link" href="/about">Get to Know Me</Link>
        </div>
        <ol className="working-together-grid">
          {workingTogetherSteps.map((step, index) => (
            <li key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><h3>{step.title}</h3><p>{step.description}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-offerings" id="home-possibilities" aria-labelledby="landing-offerings-title">
        <div className="possibility-section-heading">
          <p className="eyebrow">Our offerings</p>
          <h2 id="landing-offerings-title">Explore what your home could do.</h2>
          <p>See practical examples, from everyday comfort and entertainment to security, local control, and custom automations.</p>
        </div>
        <nav className="landing-offering-links" aria-label="Digital HandyDan offerings">
          {offeringTopics.map((topic) => (
            <Link href={topic.href} key={topic.href}>
              <span>{topic.number}</span><strong>{topic.title}</strong><b aria-hidden="true">&#8594;</b>
            </Link>
          ))}
        </nav>
      </section>

    </div>
  );
}

export function LandingQuestionCta() {
  return (
    <section className="possibilities-cta landing-question-cta">
      <p className="eyebrow">Have a question of your own?</p>
      <h2>Let&apos;s make your home work the way you want it to.</h2>
      <Link className="primary-button" href="/book">Book a consultation</Link>
    </section>
  );
}
