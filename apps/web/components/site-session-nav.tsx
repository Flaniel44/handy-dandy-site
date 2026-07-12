"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type User = { role: "admin" | "customer"; firstName: string };

export function SiteSessionNav() {
  const router = useRouter(); const pathname = usePathname(); const [user, setUser] = useState<User | null>();
  useEffect(() => {
    fetch("/api/auth/me").then((response) => response.json()).then((body) => setUser(body.user)).catch(() => setUser(null));
  }, [pathname]);
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); setUser(null); router.replace("/"); router.refresh(); }
  return <nav className="site-session-nav" aria-label="Account navigation">
    {user ? <><Link href={user.role === "admin" ? "/admin" : "/account"}>Hi, {user.firstName}</Link><button onClick={logout}>Sign out</button></> : user === null ? <Link href="/login">Sign in</Link> : null}
  </nav>;
}
