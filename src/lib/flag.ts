import type * as React from "react";

import {
  CommandIcon,
  FileSpreadsheetIcon,
  LaptopIcon,
  ListFilterIcon,
  ServerIcon,
} from "lucide-react";

export interface Flag<TValue extends string = string> {
  label: string;
  value: TValue;
  icon: React.ComponentType<React.ComponentProps<"svg">>;
  description: string;
}

export const DATA_MODES = [
  {
    label: "Server",
    value: "server",
    icon: ServerIcon,
    description: "Paginate, sort, and filter in the database.",
  },
  {
    label: "Client",
    value: "client",
    icon: LaptopIcon,
    description:
      "Load all rows once, then paginate, sort, and filter in the browser.",
  },
] as const satisfies readonly Flag[];

export type DataMode = (typeof DATA_MODES)[number]["value"];

export const FILTER_MODES = [
  {
    label: "Plain",
    value: "plain",
    icon: ListFilterIcon,
    description: "Filter rows with inline inputs.",
  },
  {
    label: "Advanced",
    value: "advanced",
    icon: FileSpreadsheetIcon,
    description: "Filter rows with an Airtable like filter builder.",
  },
  {
    label: "Command",
    value: "command",
    icon: CommandIcon,
    description: "Filter rows with a Linear like command palette.",
  },
] as const satisfies readonly Flag[];

export type FilterMode = (typeof FILTER_MODES)[number]["value"];

export const DIRECTIONS = ["ltr", "rtl"] as const;

export type Direction = (typeof DIRECTIONS)[number];
