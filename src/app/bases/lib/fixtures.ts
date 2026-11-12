import type { DemoDataMode } from "@/components/data-mode-toggle";
import type { Task } from "@/db/schema";

import { basesTasks } from "./data";

export interface BasesColumnCopy {
  labels: Record<
    "code" | "title" | "status" | "priority" | "estimatedHours" | "createdAt",
    string
  >;
  titlePlaceholder: string;
  statusLabels: Record<Task["status"], string>;
  priorityLabels: Record<Task["priority"], string>;
  hours: { min?: number; max?: number; unit: string };
}

const DEMO_COPY: BasesColumnCopy = {
  labels: {
    code: "Task",
    title: "Title",
    status: "Status",
    priority: "Priority",
    estimatedHours: "Est. Hours",
    createdAt: "Created At",
  },
  titlePlaceholder: "Search titles...",
  statusLabels: {
    todo: "Todo",
    "in-progress": "In-progress",
    done: "Done",
    canceled: "Canceled",
  },
  priorityLabels: { low: "Low", medium: "Medium", high: "High" },
  hours: { min: 1, max: 24, unit: "hr" },
};

const WORST_COPY: BasesColumnCopy = {
  labels: {
    code: "Aufgabe",
    title: "Titel",
    status: "Bearbeitungsstatus",
    priority: "Priorität",
    estimatedHours: "Geschätzter Aufwand",
    createdAt: "Erstellungsdatum",
  },
  titlePlaceholder: "Titel oder Aufgabennummer durchsuchen …",
  statusLabels: {
    todo: "Zu erledigen",
    "in-progress": "Wartet auf Rückmeldung des Kunden",
    done: "Erledigt",
    canceled: "Abgebrochen",
  },
  priorityLabels: { low: "Niedrig", medium: "Mittel", high: "Hoch" },
  hours: { unit: "Stunden" },
};

const WORST_TITLES = [
  "Migrate the billing webhooks from the legacy Stripe v2 endpoints to the v2024-06 API and backfill the missed invoice.paid events",
  "Fix",
  "Ünïcödé-Dateinamen beim CSV-Import von Bartholomew Fitzgerald (Northwind Industries) korrekt übernehmen",
  "Investigate why the nightly export for workspace 1284 times out after exactly 30 seconds",
];

const WORST_HOURS = [0.25, 960, 7.5, 1, 40];

export function getBasesFixture(mode: DemoDataMode) {
  switch (mode) {
    case "worst":
      return { rows: getWorstTasks(), copy: WORST_COPY };
    case "empty":
      return { rows: [], copy: WORST_COPY };
    case "one":
      return { rows: getWorstTasks().slice(0, 1), copy: WORST_COPY };
    default:
      return { rows: basesTasks, copy: DEMO_COPY };
  }
}

function getWorstTasks(): Task[] {
  return Array.from({ length: 1603 }, (_, index) => {
    const createdAt = new Date(
      Date.UTC(2019, 2, 14) + index * 1000 * 60 * 60 * 34,
    );
    const status: Task["status"] =
      index === 1 ? "done" : index % 5 === 0 ? "in-progress" : "todo";
    const priority: Task["priority"] =
      index === 2 ? "high" : index % 73 === 3 ? "medium" : "low";

    return {
      id: `worst-${index}`,
      code: `TASK-${String(10_000 + index)}`,
      title: WORST_TITLES[index % WORST_TITLES.length] ?? null,
      status,
      label: index % 2 === 0 ? "documentation" : "bug",
      priority,
      estimatedHours: WORST_HOURS[index] ?? (index % 39) + 1,
      archived: false,
      createdAt,
      updatedAt: createdAt,
    };
  });
}
