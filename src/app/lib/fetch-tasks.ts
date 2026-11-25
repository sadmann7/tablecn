import type { DataFetcher, DataResult } from "@/lib/data-table-types";

import { type Task } from "@/db/schema";

import { tasksTableConfig } from "./validations";

export const fetchTasks: DataFetcher<Task> = async (query, { signal }) => {
  const response = await fetch(
    `/api/tasks${tasksTableConfig.serialize(query)}`,
    { signal },
  );
  if (!response.ok) {
    throw new Error(`The tasks request failed with ${response.status}.`);
  }
  return (await response.json()) as DataResult<Task>;
};
