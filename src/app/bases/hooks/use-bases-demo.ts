import { parseAsStringEnum, parseAsStringLiteral, useQueryStates } from "nuqs";
import * as React from "react";
import { toast } from "sonner";

import type { Task } from "@/db/schema";

import { DIRECTIONS, FILTER_MODES } from "@/lib/flag";

import { basesTasks } from "../lib/data";

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
};

export function useBasesDemo() {
  const [{ filterMode, dir }] = useQueryStates(basesSearchParams);
  const [data, setData] = React.useState(basesTasks);

  const onCopy = React.useCallback((task: Task) => {
    void navigator.clipboard.writeText(task.code);
    toast.success(`Copied ${task.code}`);
  }, []);

  const onDelete = React.useCallback((task: Task) => {
    setData((prev) => prev.filter((item) => item.id !== task.id));
    toast.success(`Deleted ${task.code}`);
  }, []);

  return { filterMode, dir, data, onCopy, onDelete };
}
