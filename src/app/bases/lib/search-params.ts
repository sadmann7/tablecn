import { parseAsStringEnum, parseAsStringLiteral } from "nuqs";

import { demoDataModeParser } from "@/components/data-mode-toggle";
import { DIRECTIONS, FILTER_MODES } from "@/lib/flag";

export const BASES_VIEWS = [
  { value: "table", label: "Data Table" },
  { value: "grid", label: "Data Grid" },
] as const;

export const BASES_STATUSES = [
  { value: "idle", label: "Idle" },
  { value: "loading", label: "Loading" },
  { value: "refreshing", label: "Refreshing" },
  { value: "error", label: "Error" },
] as const;

export const basesSearchParams = {
  view: parseAsStringLiteral(BASES_VIEWS.map((view) => view.value)).withDefault(
    "table",
  ),
  filterMode: parseAsStringEnum(
    FILTER_MODES.map((filterMode) => filterMode.value),
  ).withDefault("plain"),
  dir: parseAsStringLiteral(DIRECTIONS).withDefault("ltr"),
  data: demoDataModeParser,
  status: parseAsStringLiteral(
    BASES_STATUSES.map((status) => status.value),
  ).withDefault("idle"),
};
