import type { Metadata, Viewport } from "next";
import { RouteTransition } from "../components/route-transition";
import { SiteSessionNav } from "../components/site-session-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digital Handyman | Smart-home consultations and tech help",
  description: "Friendly, practical smart-home guidance built around your home.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <RouteTransition>
          <SiteSessionNav />
          {children}
        </RouteTransition>
      </body>
    </html>
  );
}
