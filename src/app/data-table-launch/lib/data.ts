import type { PaginationState, SortingState } from "@tanstack/react-table";

import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CheckCircle2,
  CircleHelp,
  CircleX,
  type LucideIcon,
  Timer,
} from "lucide-react";

import type { ColumnFilterItem, JoinOperator } from "@/lib/data-table-types";

import { matchesFilter } from "@/lib/data-table-filters";
import { getActiveFilters } from "@/lib/data-table-utils";

export const LAUNCH_STATUSES = [
  "todo",
  "in-progress",
  "done",
  "canceled",
] as const;
export const LAUNCH_PRIORITIES = ["low", "medium", "high"] as const;
export const LAUNCH_LABELS = [
  "bug",
  "feature",
  "enhancement",
  "documentation",
] as const;

export interface LaunchTask {
  id: string;
  code: string;
  title: string;
  status: (typeof LAUNCH_STATUSES)[number];
  priority: (typeof LAUNCH_PRIORITIES)[number];
  label: (typeof LAUNCH_LABELS)[number];
  estimatedHours: number;
  createdAt: Date;
}

const STATUS_ICONS: Record<LaunchTask["status"], LucideIcon> = {
  todo: CircleHelp,
  "in-progress": Timer,
  done: CheckCircle2,
  canceled: CircleX,
};

const PRIORITY_ICONS: Record<LaunchTask["priority"], LucideIcon> = {
  low: ArrowDownIcon,
  medium: ArrowRightIcon,
  high: ArrowUpIcon,
};

const TITLES = [
  "Fix pagination resetting after a filter change",
  "Add keyboard shortcuts to the filter menu",
  "Fix date range filter for the last day of the month",
  "Ship client-side filtering for small datasets",
  "Document the server adapter for Drizzle",
  "Fix sticky pinned columns in Safari",
  "Support several filters on the same column",
  "Persist column visibility across reloads",
  "Fix faceted counts ignoring the global filter",
  "Add a command palette filter menu",
  "Write a migration guide for TanStack Table v9",
  "Fix range slider rounding on decimal steps",
  "Animate the floating action bar",
  "Export the selected rows to CSV",
  "Fix row selection with shift-click ranges",
  "Add RTL support to the toolbar",
  "Fix URL parsing for legacy sort params",
  "Support Base UI and Radix from one registry",
  "Improve skeleton widths to match real rows",
  "Fix the empty state colspan on hidden columns",
];

const BASE_TIME = Date.UTC(2026, 8, 30, 12);
const DAY_MS = 24 * 60 * 60 * 1000;

export const launchTasks = createLaunchTasks(60);

export const launchStatusOptions = LAUNCH_STATUSES.map((status) => ({
  label: toTitleCase(status),
  value: status,
  count: launchTasks.filter((task) => task.status === status).length,
  icon: STATUS_ICONS[status],
}));

export const launchPriorityOptions = LAUNCH_PRIORITIES.map((priority) => ({
  label: toTitleCase(priority),
  value: priority,
  count: launchTasks.filter((task) => task.priority === priority).length,
  icon: PRIORITY_ICONS[priority],
}));

export const launchHoursRange: [number, number] = [
  Math.min(...launchTasks.map((task) => task.estimatedHours)),
  Math.max(...launchTasks.map((task) => task.estimatedHours)),
];

export function getLaunchStatusIcon(status: LaunchTask["status"]) {
  return STATUS_ICONS[status];
}

export function getLaunchPriorityIcon(priority: LaunchTask["priority"]) {
  return PRIORITY_ICONS[priority];
}

export interface LaunchQuery {
  filters: ColumnFilterItem[];
  joinOperator: JoinOperator;
  sorting: SortingState;
  pagination: PaginationState;
}

export function queryLaunchTasks({
  filters,
  joinOperator,
  sorting,
  pagination,
}: LaunchQuery) {
  const activeFilters = getActiveFilters(filters);
  const rows = launchTasks.filter((task) => {
    if (activeFilters.length === 0) return true;

    const matches = (filter: ColumnFilterItem) =>
      matchesFilter(getTaskValue(task, filter.id), filter);
    return joinOperator === "or"
      ? activeFilters.some(matches)
      : activeFilters.every(matches);
  });

  for (let index = sorting.length - 1; index >= 0; index--) {
    const sort = sorting[index];
    if (!sort) continue;

    rows.sort((a, b) => {
      const order = compareValues(
        getTaskValue(a, sort.id),
        getTaskValue(b, sort.id),
      );
      return sort.desc ? -order : order;
    });
  }

  const start = pagination.pageIndex * pagination.pageSize;

  return {
    rows: rows.slice(start, start + pagination.pageSize),
    rowCount: rows.length,
    pageCount: Math.max(1, Math.ceil(rows.length / pagination.pageSize)),
  };
}

function getTaskValue(task: LaunchTask, columnId: string): unknown {
  return Object.entries(task).find(([key]) => key === columnId)?.[1];
}

function compareValues(a: unknown, b: unknown) {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

function createLaunchTasks(count: number): LaunchTask[] {
  const random = createRandom(1164);

  return Array.from({ length: count }, (_, index) => ({
    id: `launch-task-${index}`,
    code: `TASK-${String(1000 + Math.floor(random() * 9000))}`,
    title: TITLES[index % TITLES.length] ?? "",
    status: pick(LAUNCH_STATUSES, random),
    priority: pick(LAUNCH_PRIORITIES, random),
    label: pick(LAUNCH_LABELS, random),
    estimatedHours: 1 + Math.floor(random() * 24),
    createdAt: new Date(BASE_TIME - Math.floor(random() * 30) * DAY_MS),
  }));
}

/** Seeded so the server and client render the same rows. */
function createRandom(seed: number) {
  let state = seed;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] as T;
}

function toTitleCase(value: string) {
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
