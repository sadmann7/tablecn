import {
  createSearchParamsCache,
  parseAsStringEnum,
  parseAsStringLiteral,
} from "nuqs/server";
import * as z from "zod";

import { tasks } from "@/db/schema";
import { defineDataTable } from "@/lib/data-table-definition";
import { DATA_MODES, DIRECTIONS, FILTER_MODES } from "@/lib/flag";

export const tasksTable = defineDataTable({
  columns: {
    code: { enableSorting: false },
    title: { variant: "text" },
    status: { variant: "multi-select" },
    priority: { variant: "multi-select" },
    estimatedHours: { variant: "number", filter: "range" },
    createdAt: { variant: "date", filter: "range" },
  },
  defaultSorting: [{ id: "createdAt", desc: true }],
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

export const updateTaskSchema = z.object({
  title: z.string().optional(),
  label: z.enum(tasks.label.enumValues).optional(),
  status: z.enum(tasks.status.enumValues).optional(),
  priority: z.enum(tasks.priority.enumValues).optional(),
  estimatedHours: z.number().optional(),
});

export type CreateTaskSchema = z.infer<typeof createTaskSchema>;
export type UpdateTaskSchema = z.infer<typeof updateTaskSchema>;
