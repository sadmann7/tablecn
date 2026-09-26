import { createSearchParamsCache, parseAsStringEnum } from "nuqs/server";
import * as z from "zod";

import type { FilterVariant } from "@/lib/data-table-types";

import { flagConfig } from "@/config/flag";
import { type Task, tasks } from "@/db/schema";
import { getDataTableSearchParams } from "@/lib/parsers";

/** Filterable task columns and their variants; mirrors `tasks-table-columns`. */
export const tasksFilterableColumns = {
  title: "text",
  status: "multiSelect",
  priority: "multiSelect",
  estimatedHours: "range",
  createdAt: "dateRange",
} satisfies Partial<Record<keyof Task, FilterVariant>>;

export const searchParamsCache = createSearchParamsCache({
  filterFlag: parseAsStringEnum(
    flagConfig.featureFlags.map((flag) => flag.value),
  ),
  ...getDataTableSearchParams<Task>({
    filterableColumns: tasksFilterableColumns,
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
