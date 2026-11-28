import { useQueryStates } from "nuqs";
import * as React from "react";
import { toast } from "sonner";

import type { Task } from "@/db/schema";

import { getBasesFixture } from "../lib/fixtures";
import { basesSearchParams } from "../lib/search-params";

const RETRY_DELAY_MS = 1000;

export function useBasesDataTable() {
  const [{ filterMode, dir, data: dataMode, dataStatus }, setControls] =
    useQueryStates(basesSearchParams, { clearOnDefault: true });
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

  const onRetry = React.useCallback(() => {
    void setControls({ dataStatus: "loading" });
    setTimeout(() => void setControls({ dataStatus: "idle" }), RETRY_DELAY_MS);
  }, [setControls]);

  return {
    filterMode,
    dir,
    data,
    copy,
    status: dataStatus,
    error: "The tasks service didn't respond.",
    onRetry,
    onCopy,
    onDelete,
  };
}
