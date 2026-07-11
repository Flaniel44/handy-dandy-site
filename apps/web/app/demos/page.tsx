import Link from "next/link";

export default function DemosPage() {
  return (
    <main className="simple-page">
      <p className="eyebrow">Demos</p>
      <h1>See smart-home ideas in action.</h1>
      <p>Self-hosted walkthroughs and practical demonstrations are coming next.</p>
      <Link className="primary-button" href="/book">Book a consultation</Link>
      <Link className="text-link" href="/">Back home</Link>
    </main>
  );
}
