import {
  createSearchParamsCache,
  parseAsStringEnum,
  parseAsStringLiteral,
} from "nuqs/server";
import * as z from "zod";

import type {
  ColumnSortItem,
  DataTableColumnConfig,
  SortableColumnId,
} from "@/lib/data-table-types";

import { type Task, tasks } from "@/db/schema";
import { getDataTableSearchParams } from "@/lib/data-table-parsers";
import { DATA_MODES, DIRECTIONS, FILTER_MODES } from "@/lib/flag";

export const tasksColumnConfigs = {
  code: { isSortable: false },
  title: { variant: "text" },
  status: { variant: "multiSelect" },
  priority: { variant: "multiSelect" },
  estimatedHours: { variant: "range" },
  createdAt: { variant: "dateRange" },
} as const satisfies Partial<Record<keyof Task, DataTableColumnConfig>>;

export const tasksDefaultSorting = [
  { id: "createdAt", desc: true },
] satisfies ColumnSortItem<SortableColumnId<typeof tasksColumnConfigs>>[];

export const searchParamsCache = createSearchParamsCache({
  filterMode: parseAsStringEnum(
    FILTER_MODES.map((filterMode) => filterMode.value),
  ).withDefault("plain"),
  dataMode: parseAsStringEnum(
    DATA_MODES.map((dataMode) => dataMode.value),
  ).withDefault("server"),
  dir: parseAsStringLiteral(DIRECTIONS).withDefault("ltr"),
  ...getDataTableSearchParams({
    columnConfigs: tasksColumnConfigs,
    defaultSorting: tasksDefaultSorting,
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
