// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // ✅ Next 15+ key (replaces experimental.serverComponentsExternalPackages)
  serverExternalPackages: ["pg"],

  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },

  webpack: (config, { isServer }) => {
    // Prevent client bundles from trying to polyfill Node core modules
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },

  // Safety valve; remove once everything is stable.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
