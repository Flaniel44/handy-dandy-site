import type { MetadataRoute } from "next";

const SITE_URL = "https://digitalhandydan.ca";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/demos`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/book`, changeFrequency: "weekly", priority: 0.8 },
  ];
}
