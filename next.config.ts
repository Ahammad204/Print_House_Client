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
  async headers() {
    // Content-Security-Policy: 'unsafe-inline' is kept for scripts and
    // styles because Next.js needs inline scripts/styles to hydrate;
    // everything else is locked to same-origin. frame-ancestors 'none'
    // (plus X-Frame-Options) blocks clickjacking. img-src allows data:
    // (inline SVG placeholders) and https: (external product images).
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
