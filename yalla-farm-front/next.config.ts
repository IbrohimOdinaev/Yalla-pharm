import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com"
      }
    ]
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${process.env.INTERNAL_API_URL || "http://localhost:5000"}/api/:path*` },
      { source: "/hubs/:path*", destination: `${process.env.INTERNAL_API_URL || "http://localhost:5000"}/hubs/:path*` },
    ];
  }
};

export default nextConfig;
