import type { Metadata } from "next";

import { JsonLd } from "../components/json-ld";
import { LandingScene } from "../components/landing-scene";
import { isLaunchOfferEnabled } from "../lib/booking-status";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Smart-home consultations and tech help in Ottawa",
  description: "Make your smart home simpler, more private, and more useful with personal automation consulting and friendly technology help in Ottawa.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Digital HandyDan | Smart-home help made simple",
    description: "Personal smart-home consultations, custom automations, and practical technology support in Ottawa.",
    url: "/",
  },
};

const businessStructuredData = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  "@id": "https://digitalhandydan.ca/#business",
  name: "Digital HandyDan",
  url: "https://digitalhandydan.ca",
  logo: "https://digitalhandydan.ca/icon.png",
  image: "https://digitalhandydan.ca/icon.png",
  description: "Personal smart-home consultations, custom home automations, Wi-Fi help, device setup, and practical technology support.",
  email: "dan@digitalhandydan.ca",
  telephone: "+1-343-596-1813",
  areaServed: { "@type": "City", name: "Ottawa", containedInPlace: { "@type": "AdministrativeArea", name: "Ontario, Canada" } },
  sameAs: [
    "https://www.facebook.com/profile.php?id=61592466245543",
    "https://www.instagram.com/digitalhandydan/",
  ],
  knowsAbout: [
    "Smart-home automation",
    "Home Assistant",
    "Smart lighting",
    "Home networking and Wi-Fi",
    "Technology setup and support",
  ],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Digital HandyDan services",
    itemListElement: [
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Smart-home consultation and planning" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Home automation setup and troubleshooting" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Wi-Fi and home network help" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "General technology setup and support" } },
    ],
  },
};

export default function Home() {
  return <><JsonLd data={businessStructuredData} /><LandingScene launchOfferEnabled={isLaunchOfferEnabled()} /></>;
}
