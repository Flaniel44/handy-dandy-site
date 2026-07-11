import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Handy Dandy | Smart-home consultations",
  description: "Friendly, practical smart-home guidance built around your home.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
