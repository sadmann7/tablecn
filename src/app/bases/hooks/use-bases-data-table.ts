import { useQueryStates } from "nuqs";
import * as React from "react";
import { toast } from "sonner";

import type { Task } from "@/db/schema";

import { getBasesFixture } from "../lib/fixtures";
import { basesSearchParams } from "../lib/search-params";

export function useBasesDataTable() {
  const [{ filterMode, dir, data: dataMode }] =
    useQueryStates(basesSearchParams);
  const [{ rows, copy }] = React.useState(() =>
    getBasesFixture(dataMode ?? "demo"),
  );
  const [data, setData] = React.useState(rows);

  const onCopy = React.useCallback((task: Task) => {
    void navigator.clipboard.writeText(task.code);
    toast.success(`Copied ${task.code}`);
  }, []);

  const onDelete = React.useCallback((task: Task) => {
    setData((prev) => prev.filter((item) => item.id !== task.id));
    toast.success(`Deleted ${task.code}`);
  }, []);

  return { filterMode, dir, data, copy, onCopy, onDelete };
}
