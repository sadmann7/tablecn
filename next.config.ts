import type { NextConfig } from "next";

/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
// Import environment validation synchronously
import "./src/env.js";
import { DEFAULT_STYLE_ID, getStyleIds } from "./src/registry/styles";

const nextConfig: NextConfig = {
  cacheComponents: true,
  async rewrites() {
    return [
      // Published style ids resolve to their static directory.
      {
        source: `/r/:style(${getStyleIds().join("|")})/:name.json`,
        destination: "/r/styles/:style/:name.json",
      },
      // Bases we don't author (`aria-*`) and legacy v3 ids fall back to the
      // default rather than 404ing on an otherwise valid install.
      {
        source: "/r/:style/:name.json",
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
