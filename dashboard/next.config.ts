import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // INTERNAL_API_URL is set by docker-compose to http://api:4000 so
    // Next.js SSR requests (server-side fetch) reach the API container.
    // Browser fetch calls use relative /api/* paths and are handled by the gateway.
    const internalApiUrl = process.env.INTERNAL_API_URL ?? "http://api:4000";
    return [
      {
        source: '/api/:path*',
        destination: `${internalApiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
