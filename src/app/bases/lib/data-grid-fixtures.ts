import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";

import type { DemoDataMode } from "@/components/data-mode-toggle";

import { generatePeople, type Person } from "../../data-grid/lib/seeds";
import { worstCasePeople } from "../../data-grid/lib/worst-case";

export type BasesGridLabels = Partial<Record<keyof Person, string>>;

const WORST_LABELS: BasesGridLabels = {
  name: "Vollständiger Name",
  age: "Alter (Jahre)",
  email: "E-Mail-Adresse",
  feedback: "Rückmeldung des Kunden",
  department: "Abteilung",
  status: "Beschäftigungsstatus",
  skills: "Fähigkeiten",
  startDate: "Eintrittsdatum",
  salary: "Jahresgehalt (brutto)",
  isActive: "Aktiv",
  website: "Persönliche Website",
};

const WORST_FILTERS: ColumnFiltersState = [
  { id: "name", value: { operator: "contains", value: "Wiśniewska" } },
  {
    id: "department",
    value: { operator: "isAnyOf", value: ["Engineering", "Marketing"] },
  },
  {
    id: "salary",
    value: { operator: "isBetween", value: 0, endValue: 12_345_678 },
  },
  {
    id: "startDate",
    value: {
      operator: "isBetween",
      value: "2019-03-14",
      endValue: "2026-10-31",
    },
  },
  { id: "status", value: { operator: "isNotEmpty" } },
];

const WORST_SORTING: SortingState = [
  { id: "salary", desc: true },
  { id: "startDate", desc: false },
  { id: "name", desc: false },
];

export function getBasesGridFixture(mode: DemoDataMode) {
  switch (mode) {
    case "worst":
      return {
        rows: worstCasePeople,
        labels: WORST_LABELS,
        columnFilters: WORST_FILTERS,
        sorting: WORST_SORTING,
      };
    case "empty":
      return { rows: [], labels: WORST_LABELS, columnFilters: [], sorting: [] };
    case "one":
      return {
        rows: worstCasePeople.slice(0, 1),
        labels: WORST_LABELS,
        columnFilters: [],
        sorting: [],
      };
    default:
      return {
        rows: generatePeople(200),
        labels: {},
        columnFilters: [],
        sorting: [],
      };
  }
}
