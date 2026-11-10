import {
  createSearchParamsCache,
  parseAsStringEnum,
  parseAsStringLiteral,
} from "nuqs/server";
import * as z from "zod";

import type { DataTableColumnConfigs } from "@/lib/data-table-types";

import { type Task, tasks } from "@/db/schema";
import { createDataTableConfig } from "@/lib/data-table-config";
import { DATA_MODES, DIRECTIONS, FILTER_MODES } from "@/lib/flag";

export const tasksTableConfig = createDataTableConfig({
  columns: {
    title: { variant: "text" },
    status: { variant: "multi-select" },
    priority: { variant: "multi-select" },
    estimatedHours: { variant: "range" },
    createdAt: { variant: "date-range" },
  } satisfies DataTableColumnConfigs<Task>,
  defaultSorting: [{ id: "createdAt", desc: true }],
  enableGlobalFilter: false,
});

export const searchParamsCache = createSearchParamsCache({
  filterMode: parseAsStringEnum(
    FILTER_MODES.map((filterMode) => filterMode.value),
  ).withDefault("plain"),
  dataMode: parseAsStringEnum(
    DATA_MODES.map((dataMode) => dataMode.value),
  ).withDefault("server"),
  dir: parseAsStringLiteral(DIRECTIONS).withDefault("ltr"),
});

export const createTaskSchema = z.object({
  title: z.string(),
  label: z.enum(tasks.label.enumValues),
  status: z.enum(tasks.status.enumValues),
  priority: z.enum(tasks.priority.enumValues),
  estimatedHours: z.number().optional(),
});
export type CreateTaskSchema = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  title: z.string().optional(),
  label: z.enum(tasks.label.enumValues).optional(),
  status: z.enum(tasks.status.enumValues).optional(),
  priority: z.enum(tasks.priority.enumValues).optional(),
  estimatedHours: z.number().optional(),
});
export type UpdateTaskSchema = z.infer<typeof updateTaskSchema>;
