import { createColumnHelper } from "@tanstack/react-table";
import { fireEvent, render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type { ColumnFilterItem } from "@/lib/data-table-types";

import { DataTable as AriaDataTable } from "@/registry/bases/aria/components/data-table/data-table";
import { DataTableFilterMenu as AriaDataTableFilterMenu } from "@/registry/bases/aria/components/data-table/data-table-filter-menu";
import { useDataTable as useAriaDataTable } from "@/registry/bases/aria/hooks/use-data-table";
import { DataTable as BaseDataTable } from "@/registry/bases/base/components/data-table/data-table";
import { DataTableFilterMenu as BaseDataTableFilterMenu } from "@/registry/bases/base/components/data-table/data-table-filter-menu";
import { useDataTable as useBaseDataTable } from "@/registry/bases/base/hooks/use-data-table";
import { DataTable as RadixDataTable } from "@/registry/bases/radix/components/data-table/data-table";
import { DataTableFilterMenu as RadixDataTableFilterMenu } from "@/registry/bases/radix/components/data-table/data-table-filter-menu";
import { useDataTable as useRadixDataTable } from "@/registry/bases/radix/hooks/use-data-table";

vi.mock("@/registry/bases/radix/ui/direction", () => ({
  useDirection: () => "ltr",
}));
vi.mock("@/registry/bases/base/ui/direction", () => ({
  useDirection: () => "ltr",
}));
vi.mock("@/registry/bases/aria/ui/direction", () => ({
  useDirection: () => "ltr",
}));

interface Task {
  id: string;
  title: string;
  done: boolean;
}

const bases = [
  ["radix", RadixDataTable, RadixDataTableFilterMenu, useRadixDataTable],
  ["base", BaseDataTable, BaseDataTableFilterMenu, useBaseDataTable],
  ["aria", AriaDataTable, AriaDataTableFilterMenu, useAriaDataTable],
] as const;

describe.each(bases)(
  "DataTableFilterMenu (%s)",
  (_, DataTable, DataTableFilterMenu, useDataTable) => {
    function Table({ filters }: { filters: ColumnFilterItem[] }) {
      const { table } = useDataTable<Task>({
        mode: "client",
        data,
        columns,
        getRowId: (row) => row.id,
        initialState: { columnFilters: filters },
      });

      return (
        <DataTable aria-label="Tasks" table={table}>
          <DataTableFilterMenu table={table} />
        </DataTable>
      );
    }

    function renderFilters(filters: ColumnFilterItem[]) {
      render(
        <NuqsTestingAdapter hasMemory>
          <Table filters={filters} />
        </NuqsTestingAdapter>,
      );
      fireEvent.click(screen.getByRole("button", { name: /filter/i }));
    }

    it("shows an empty boolean filter as empty", () => {
      renderFilters([getBooleanFilter("")]);
      const trigger = screen.getByLabelText("Done boolean filter");

      expect(trigger.textContent).toContain("Select value");
      expect(trigger.textContent).not.toContain("True");
    });

    it("shows the chosen boolean value", () => {
      renderFilters([getBooleanFilter("true")]);

      expect(
        screen.getByLabelText("Done boolean filter").textContent,
      ).toContain("True");
    });

    it("shows the operator label", () => {
      renderFilters([getTextFilter("bug")]);

      expect(
        screen.getByLabelText("Title filter operator").textContent,
      ).toContain("Contains");
    });
  },
);

const data: Task[] = [
  { id: "1", title: "Write docs", done: true },
  { id: "2", title: "Fix bug", done: false },
];

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

const columns = columnHelper.columns([
  columnHelper.accessor("title", {
    id: "title",
    meta: { label: "Title", variant: "text" },
    enableColumnFilter: true,
  }),
  columnHelper.accessor("done", {
    id: "done",
    meta: { label: "Done", variant: "boolean" },
    enableColumnFilter: true,
  }),
]);

function getBooleanFilter(value: string): ColumnFilterItem {
  return {
    id: "done",
    value,
    operator: "eq",
    variant: "boolean",
    filterId: "done-0",
  };
}

function getTextFilter(value: string): ColumnFilterItem {
  return {
    id: "title",
    value,
    operator: "iLike",
    variant: "text",
    filterId: "title-0",
  };
}
