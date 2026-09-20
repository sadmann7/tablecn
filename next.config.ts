/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */

import type { NextConfig } from "next";

import { DEFAULT_STYLE_ID } from "./src/lib/constants";
import "./src/env.js";

const nextConfig: NextConfig = {
  cacheComponents: true,
  async redirects() {
    return [
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
  // Already doing typechecking as separate task in CI
  typescript: { ignoreBuildErrors: true },
  experimental: {
    optimizePackageImports: [
      "@tanstack/query-db-collection",
      "@tanstack/react-db",
      "@tanstack/react-query",
      "@tanstack/react-table",
      "@tanstack/react-virtual",
    ],
  },
};

export default nextConfig;
