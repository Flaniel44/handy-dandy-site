"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function LandingScene() {
  const [lit, setLit] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setLit(true), 4500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className={lit ? "landing is-lit" : "landing"}>
      <div className="ambient" aria-hidden="true" />
      <nav className="topbar" aria-label="Primary navigation">
        <Link className="wordmark" href="/">Handy Dandy</Link>
        <a href="#contact">Contact</a>
      </nav>

      <section className="hero">
        <button
          className="pull-chain"
          type="button"
          aria-pressed={lit}
          aria-label={lit ? "Turn the house lights off" : "Turn the house lights on"}
          onClick={() => setLit((value) => !value)}
        >
          <span className="chain-beads" aria-hidden="true" />
          <span className="chain-handle" aria-hidden="true" />
          <span className="pull-hint">Pull to switch things on</span>
        </button>

        <div className="scene-copy">
          <p className="eyebrow">Smart-home consultation</p>
          <h1>Your home.<br />Simply smarter.</h1>
          <p className="lede">
            Practical, personal guidance for technology that feels natural in your home.
          </p>
          <div className="actions">
            <Link className="primary-button" href="/book">Book a consultation</Link>
            <a className="secondary-button" href="#demos">View demos</a>
          </div>
        </div>

        <House />
      </section>

      <section className="lower-grid" id="demos">
        <article>
          <span>01</span>
          <h2>Start with the problem</h2>
          <p>No gadget shopping list—just a thoughtful plan for what you want your home to do.</p>
        </article>
        <article>
          <span>02</span>
          <h2>Make it work together</h2>
          <p>Clear advice on compatibility, privacy, reliability, and a setup your family can use.</p>
        </article>
        <article id="contact">
          <span>03</span>
          <h2>Talk to a human</h2>
          <p><a href="mailto:hello@example.com">Email</a> · <a href="https://wa.me/15555555555">WhatsApp</a> · <a href="https://m.me/example">Messenger</a></p>
        </article>
      </section>
    </main>
  );
}

function House() {
  return (
    <div className="house-wrap" aria-hidden="true">
      <svg className="house" viewBox="0 0 520 430">
        <path className="roof" d="M38 174 260 37l222 137-25 40L260 90 63 214Z" />
        <path className="chimney" d="M384 74h39v83h-39z" />
        <rect className="shell" x="75" y="185" width="370" height="218" rx="3" />
        <path className="rooms" d="M75 290h370M260 185v218" />
        <g className="room room-one"><rect x="88" y="198" width="159" height="79" /><circle cx="168" cy="236" r="23" /></g>
        <g className="room room-two"><rect x="273" y="198" width="159" height="79" /><path d="M315 250h76m-60-28h44v28h-44z" /></g>
        <g className="room room-three"><rect x="88" y="303" width="159" height="87" /><path d="M119 366h96m-78-39h60v39h-60z" /></g>
        <g className="room room-four"><rect x="273" y="303" width="159" height="87" /><path d="M302 362h102v17H302zm20-35h62v35h-62z" /></g>
        <g className="signals"><path d="M240 152a29 29 0 0 1 40 0M228 139a47 47 0 0 1 64 0M216 126a65 65 0 0 1 88 0" /></g>
      </svg>
    </div>
  );
}
