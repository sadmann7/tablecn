export const SITE_NAME = "tablecn";

export const SITE_DESCRIPTION =
  "Data table and data grid components built with shadcn/ui, featuring sorting, filtering, pagination, infinite scrolling, and real-time collaboration.";

export const SITE_URL = "https://tablecn.com";

export const GITHUB_URL = "https://github.com/sadmann7/tablecn";

export const NAV_LINKS = [
  { href: "/", label: "Data Table" },
  { href: "/data-grid", label: "Data Grid" },
  { href: "/data-grid-multiplayer", label: "Data Grid Multiplayer" },
  { href: "/data-grid-rapid", label: "Data Grid Rapid" },
  { href: "/data-grid-doom", label: "Data Grid DOOM" },
] as const;

export const DATA_TABLE_EXAMPLES = [
  { href: "/data-table-query", label: "TanStack Query" },
  { href: "/data-table-fetcher", label: "Fetcher" },
  { href: "/data-table-controlled", label: "Controlled" },
  { href: "/data-table-cursor", label: "Load more" },
] as const;

export const THEME_COLORS = {
  light: "#ffffff",
  dark: "#0a0a0a",
} as const;
