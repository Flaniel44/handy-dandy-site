import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV !== "production";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  "font-src 'self' data:",
  "media-src 'self'",
  `connect-src 'self'${isDevelopment ? " ws: http:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");
const openHouseContentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  "font-src 'self' data:",
  "media-src 'self'",
  `connect-src 'self'${isDevelopment ? " ws: http:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors http://homeassistant.local:8123",
].join("; ");
const sharedSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];
const noIndexRoutes = [
  "/account/:path*",
  "/admin/:path*",
  "/login",
  "/create-account",
  "/forgot-password",
  "/reset-password",
  "/book/confirm",
  "/book/confirmation",
  "/book/manage",
  "/open-house",
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [...noIndexRoutes.map((source) => ({
      source,
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
    })), {
      source: "/:path((?!open-house(?:/|$)).*)",
      headers: [
        ...sharedSecurityHeaders,
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
      ],
    }, {
      source: "/open-house",
      headers: [
        ...sharedSecurityHeaders,
        { key: "Content-Security-Policy", value: openHouseContentSecurityPolicy },
      ],
    }];
  },
};

export default nextConfig;
