import type { NextConfig } from "next";

import { DEFAULT_STYLE_ID } from "@/lib/constants";

import "./src/env";

const nextConfig: NextConfig = {
  cacheComponents: true,
  reactCompiler: true,
  async redirects() {
    return [
      {
        source: "/data-grid-live",
        destination: "/data-grid-multiplayer",
        permanent: true,
      },
      {
        source: "/docs/components/:name((?!radix|base)[^/]+)",
        destination: "/docs/components/base/:name",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/r/:style/:name.json",
        destination: "/r/styles/:style/:name.json",
      },
      {
        source: "/r/:name.json",
        destination: `/r/styles/${DEFAULT_STYLE_ID}/:name.json`,
      },
    ];
  },
  // CI typechecks as a separate task.
  typescript: { ignoreBuildErrors: true },
  experimental: {
    optimizePackageImports: [
      "@tanstack/react-db",
      "@tanstack/react-query",
      "@tanstack/react-table",
      "@tanstack/react-virtual",
    ],
  },
};

export default nextConfig;
