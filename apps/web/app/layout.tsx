import type { Metadata } from "next";
import { SiteSessionNav } from "../components/site-session-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Handy Dandy | Smart-home consultations",
  description: "Friendly, practical smart-home guidance built around your home.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><SiteSessionNav />{children}</body>
    </html>
  );
}
