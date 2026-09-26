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

export const modes = [
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

export type Mode = (typeof modes)[number]["value"];

export const filters = [
  {
    label: "Simple",
    value: "simple",
    icon: ListFilterIcon,
    description: "Faceted filters inline with the toolbar.",
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

export type Filter = (typeof filters)[number]["value"];
