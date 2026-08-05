import type { MetadataRoute } from "next";

const SITE_URL = "https://digitalhandydan.ca";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api",
        "/account",
        "/admin",
        "/login",
        "/create-account",
        "/forgot-password",
        "/reset-password",
        "/book/confirm",
        "/book/confirmation",
        "/book/manage",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
