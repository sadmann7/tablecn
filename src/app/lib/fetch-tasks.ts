import type { DataFetcher, DataResult } from "@/lib/data-table-types";

import { type Task } from "@/db/schema";

import { tasksTableConfig } from "./validations";

export const fetchTasks: DataFetcher<Task> = (query, { signal }) =>
  getTasksJson(tasksTableConfig.serialize(query), signal);

export const fetchTasksByCursor: DataFetcher<Task> = (query, { signal }) => {
  const searchParams = new URLSearchParams(tasksTableConfig.serialize(query));
  searchParams.set("cursor", query.cursor ?? "");
  return getTasksJson(`?${searchParams}`, signal);
};

async function getTasksJson(search: string, signal: AbortSignal) {
  const response = await fetch(`/api/tasks${search}`, { signal });
  if (!response.ok) {
    throw new Error(`The tasks request failed with ${response.status}.`);
  }
  return (await response.json()) as DataResult<Task>;
}
