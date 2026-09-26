import type { ComponentType } from "react";

import {
  CommandIcon,
  FileSpreadsheetIcon,
  LaptopIcon,
  ServerIcon,
} from "lucide-react";

export interface Flag<TValue extends string = string> {
  label: string;
  value: TValue;
  icon: ComponentType<{ className?: string }>;
  description: string;
}

export const tableModes = [
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

export type TableMode = (typeof tableModes)[number]["value"];

export const filterFlags = [
  {
    label: "Advanced",
    value: "advancedFilters",
    icon: FileSpreadsheetIcon,
    description: "Airtable like advanced filters for filtering rows.",
  },
  {
    label: "Command",
    value: "commandFilters",
    icon: CommandIcon,
    description: "Linear like command palette for filtering rows.",
  },
] as const satisfies readonly Flag[];

export type FilterFlag = (typeof filterFlags)[number]["value"];
