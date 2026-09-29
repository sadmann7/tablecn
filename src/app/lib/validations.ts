import { createSearchParamsCache, parseAsStringEnum } from "nuqs/server";
import * as z from "zod";

import type { FilterVariant } from "@/lib/data-table-types";

import { type Task, tasks } from "@/db/schema";
import { DATA_MODES, FILTER_MODES } from "@/lib/flag";
import { getDataTableSearchParams } from "@/lib/parsers";

/** Filterable task columns and their variants; mirrors `tasks-table-columns`. */
export const tasksFilterableColumns = {
  title: "text",
  status: "multiSelect",
  priority: "multiSelect",
  estimatedHours: "range",
  createdAt: "dateRange",
} satisfies Partial<Record<keyof Task, FilterVariant>>;

/** Sortable task columns; mirrors `tasks-table-columns`. */
export const tasksSortableColumns = [
  "title",
  "status",
  "priority",
  "estimatedHours",
  "createdAt",
] as const satisfies readonly (keyof Task)[];

export const searchParamsCache = createSearchParamsCache({
  filterMode: parseAsStringEnum(
    FILTER_MODES.map((filterMode) => filterMode.value),
  ).withDefault("inline"),
  dataMode: parseAsStringEnum(
    DATA_MODES.map((dataMode) => dataMode.value),
  ).withDefault("server"),
  ...getDataTableSearchParams({
    filterableColumns: tasksFilterableColumns,
    sortableColumns: tasksSortableColumns,
    defaultSorting: [{ id: "createdAt", desc: true }],
  }),
});

export const createTaskSchema = z.object({
  title: z.string(),
  label: z.enum(tasks.label.enumValues),
  status: z.enum(tasks.status.enumValues),
  priority: z.enum(tasks.priority.enumValues),
  estimatedHours: z.number().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().optional(),
  label: z.enum(tasks.label.enumValues).optional(),
  status: z.enum(tasks.status.enumValues).optional(),
  priority: z.enum(tasks.priority.enumValues).optional(),
  estimatedHours: z.number().optional(),
});

export type CreateTaskSchema = z.infer<typeof createTaskSchema>;
export type UpdateTaskSchema = z.infer<typeof updateTaskSchema>;
