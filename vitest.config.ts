import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: [
      ...[
        "use-as-ref",
        "use-badge-overflow",
        "use-callback-ref",
        "use-data-grid-undo-redo",
        "use-data-grid",
        "use-data-table",
        "use-debounced-callback",
        "use-isomorphic-layout-effect",
        "use-lazy-ref",
      ].map((name) => ({
        find: `@/hooks/${name}`,
        replacement: resolve(__dirname, `./src/registry/hooks/${name}.ts`),
      })),
      ...[
        "compose-refs",
        "data-grid-features",
        "data-grid-filters",
        "data-grid-types",
        "data-grid-utils",
        "data-table-types",
        "data-table-utils",
        "format",
        "id",
        "parsers",
        "table-features",
      ].map((name) => ({
        find: `@/lib/${name}`,
        replacement: resolve(__dirname, `./src/registry/lib/${name}.ts`),
      })),
      { find: "@", replacement: resolve(__dirname, "./src") },
    ],
  },
});
