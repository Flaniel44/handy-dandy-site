import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/landing-scene": ["../../reference/lamp_pull_landing_scene_v37.html"],
  },
};

export default nextConfig;
