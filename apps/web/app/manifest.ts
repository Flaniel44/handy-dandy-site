import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Handy Dandy",
    short_name: "Handy Dandy",
    description: "Friendly, practical smart-home and technology support.",
    start_url: "/",
    display: "standalone",
    background_color: "#161a28",
    theme_color: "#161a28",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
