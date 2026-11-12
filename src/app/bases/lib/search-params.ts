import { parseAsStringEnum, parseAsStringLiteral } from "nuqs";

import { demoDataModeParser } from "@/components/data-mode-toggle";
import { DIRECTIONS, FILTER_MODES } from "@/lib/flag";

export const BASES_VIEWS = [
  { value: "table", label: "Data Table" },
  { value: "grid", label: "Data Grid" },
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
};
