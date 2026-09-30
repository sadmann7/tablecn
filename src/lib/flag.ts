import type { ComponentType } from "react";

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
  icon: ComponentType<{ className?: string }>;
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
    description: "One filter per column.",
  },
  {
    label: "Advanced",
    value: "advanced",
    icon: FileSpreadsheetIcon,
    description: "Airtable like advanced filters for filtering rows.",
  },
  {
    label: "Command",
    value: "command",
    icon: CommandIcon,
    description: "Linear like command palette for filtering rows.",
  },
] as const satisfies readonly Flag[];

export type FilterMode = (typeof FILTER_MODES)[number]["value"];
