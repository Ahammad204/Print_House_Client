import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // ESLint is run separately; do not let lint noise block production builds.
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
