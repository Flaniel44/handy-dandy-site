"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DEMO_UNIT_CHANGE_EVENT, readDemoUnitPreference, setDemoUnitPreference } from "../lib/demo-unit";

type User = { role: "admin" | "customer"; firstName: string };

export function SiteSessionNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>();
  const [isDemoUnit, setIsDemoUnit] = useState<boolean>();

  useEffect(() => {
    const url = new URL(window.location.href);
    const demoUnitCommand = url.searchParams.get("demoUnit");
    let enabled = demoUnitCommand === "1";

    if (demoUnitCommand === "1") setDemoUnitPreference(true);
    if (demoUnitCommand === "0") setDemoUnitPreference(false);
    if (demoUnitCommand === null) enabled = readDemoUnitPreference();
    if (demoUnitCommand === "1") void fetch("/api/auth/logout", { method: "POST" });

    if (demoUnitCommand !== null) {
      url.searchParams.delete("demoUnit");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    const initializationFrame = window.requestAnimationFrame(() => setIsDemoUnit(enabled));
    return () => window.cancelAnimationFrame(initializationFrame);
  }, []);

  useEffect(() => {
    const handleDemoUnitChange = (event: Event) => {
      const enabled = (event as CustomEvent<{ enabled: boolean }>).detail.enabled;
      setIsDemoUnit(enabled);
      if (enabled) setUser(null);
    };
    window.addEventListener(DEMO_UNIT_CHANGE_EVENT, handleDemoUnitChange);
    return () => window.removeEventListener(DEMO_UNIT_CHANGE_EVENT, handleDemoUnitChange);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me").then((response) => response.json()).then((body) => setUser(body.user)).catch(() => setUser(null));
  }, [pathname]);

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); setUser(null); router.replace("/"); router.refresh(); }

  if (pathname === "/open-house") return null;

  return <>
    {pathname !== "/" && <Link className="site-home-link" href="/" aria-label="Back to Digital HandyDan home">← Digital HandyDan</Link>}
    <nav className="site-session-nav" aria-label="Account navigation">
      {pathname === "/demos" &&
        <Link className="site-nav-logo" href="/" aria-label="Digital HandyDan home">
          <Image src="/apple-icon.png" alt="" width={34} height={34} priority />
        </Link>}
      {(pathname === "/" || pathname === "/demos") && <Link className="site-nav-book" href="/book">Book an appointment</Link>}
      {isDemoUnit === false && (user ? <><Link href={user.role === "admin" ? "/admin" : "/account"}>Hi, {user.firstName}</Link><button onClick={logout}>Sign out</button></> : user === null ? <Link href="/login">Sign in</Link> : null)}
    </nav>
  </>;
}
