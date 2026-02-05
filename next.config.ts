import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
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
