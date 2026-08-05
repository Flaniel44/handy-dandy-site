import type { Metadata, Viewport } from "next";
import { RouteTransition } from "../components/route-transition";
import { SiteSessionNav } from "../components/site-session-nav";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://digitalhandydan.ca"),
  applicationName: "Digital HandyDan",
  title: {
    default: "Digital HandyDan | Smart-home consultations in Ottawa",
    template: "%s | Digital HandyDan",
  },
  description: "Friendly smart-home consultations, automation planning, Wi-Fi help, and practical technology support in Ottawa, Ontario.",
  authors: [{ name: "Digital HandyDan", url: "https://digitalhandydan.ca" }],
  creator: "Digital HandyDan",
  publisher: "Digital HandyDan",
  category: "Smart-home consulting",
  openGraph: {
    type: "website",
    locale: "en_CA",
    siteName: "Digital HandyDan",
    title: "Digital HandyDan | Smart-home consultations in Ottawa",
    description: "Practical smart-home guidance, custom automations, and friendly technology support in Ottawa.",
    url: "/",
    images: [{ url: "/icon.png", width: 512, height: 512, alt: "Digital HandyDan house logo" }],
  },
  twitter: {
    card: "summary",
    title: "Digital HandyDan | Smart-home consultations in Ottawa",
    description: "Practical smart-home guidance, custom automations, and friendly technology support in Ottawa.",
    images: ["/icon.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-CA">
      <body>
        <RouteTransition>
          <SiteSessionNav />
          {children}
        </RouteTransition>
      </body>
    </html>
  );
}
