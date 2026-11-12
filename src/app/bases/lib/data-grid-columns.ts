import { type ColumnDef, createColumnHelper } from "@tanstack/react-table";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import { getFilterFn } from "@/lib/data-grid-filters";

import type { BasesGridLabels } from "./data-grid-fixtures";

import {
  departments,
  type Person,
  skills,
  statuses,
} from "../../data-grid/lib/seeds";

const columnHelper = createColumnHelper<DataGridFeatures, Person>();

interface GetBasesDataGridColumnsOptions {
  selectColumn: ColumnDef<DataGridFeatures, Person>;
  actionsColumn: ColumnDef<DataGridFeatures, Person>;
  labels?: BasesGridLabels;
}

export function getBasesDataGridColumns({
  selectColumn,
  actionsColumn,
  labels = {},
}: GetBasesDataGridColumnsOptions) {
  const filterFn = getFilterFn<Person>();

  return columnHelper
    .columns([
      selectColumn,
      columnHelper.accessor("name", {
        id: "name",
        header: "Name",
        minSize: 180,
        filterFn,
        meta: { label: "Name", variant: "text" },
      }),
      columnHelper.accessor("age", {
        id: "age",
        header: "Age",
        minSize: 100,
        filterFn,
        meta: { label: "Age", variant: "number", min: 18, max: 100, step: 1 },
      }),
      columnHelper.accessor("email", {
        id: "email",
        header: "Email",
        minSize: 240,
        filterFn,
        meta: { label: "Email", variant: "text" },
      }),
      columnHelper.accessor("feedback", {
        id: "feedback",
        header: "Feedback",
        minSize: 200,
        filterFn,
        meta: { label: "Feedback", variant: "long-text" },
      }),
      columnHelper.accessor("department", {
        id: "department",
        header: "Department",
        minSize: 180,
        filterFn,
        meta: {
          label: "Department",
          variant: "select",
          options: departments.map((value) => ({ label: value, value })),
        },
      }),
      columnHelper.accessor("status", {
        id: "status",
        header: "Status",
        minSize: 180,
        filterFn,
        meta: {
          label: "Status",
          variant: "select",
          options: statuses.map((value) => ({ label: value, value })),
        },
      }),
      columnHelper.accessor("skills", {
        id: "skills",
        header: "Skills",
        minSize: 240,
        filterFn,
        meta: {
          label: "Skills",
          variant: "multi-select",
          options: skills.map((value) => ({ label: value, value })),
        },
      }),
      columnHelper.accessor("startDate", {
        id: "startDate",
        header: "Start Date",
        minSize: 150,
        filterFn,
        meta: { label: "Start Date", variant: "date" },
      }),
      columnHelper.accessor("salary", {
        id: "salary",
        header: "Salary",
        minSize: 180,
        filterFn,
        meta: {
          label: "Salary",
          variant: "number",
          min: 0,
          step: 1000,
          format: {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          },
        },
      }),
      columnHelper.accessor("isActive", {
        id: "isActive",
        header: "Active",
        minSize: 140,
        filterFn,
        meta: { label: "Active", variant: "boolean" },
      }),
      columnHelper.accessor("website", {
        id: "website",
        header: "Website",
        minSize: 240,
        filterFn,
        meta: { label: "Website", variant: "url" },
      }),
      actionsColumn,
    ])
    .map((column) => {
      const label = column.id ? labels[column.id as keyof Person] : undefined;
      return label
        ? { ...column, header: label, meta: { ...column.meta, label } }
        : column;
    });
}
