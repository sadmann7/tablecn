import { createColumnHelper } from "@tanstack/react-table";
import { fireEvent, render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { createDataTableConfig } from "@/lib/data-table-config";
import { DataTable as AriaDataTable } from "@/registry/bases/aria/components/data-table/data-table";
import { DataTableSortMenu as AriaDataTableSortMenu } from "@/registry/bases/aria/components/data-table/data-table-sort-menu";
import { useDataTable as useAriaDataTable } from "@/registry/bases/aria/hooks/use-data-table";
import { DataTable as BaseDataTable } from "@/registry/bases/base/components/data-table/data-table";
import { DataTableSortMenu as BaseDataTableSortMenu } from "@/registry/bases/base/components/data-table/data-table-sort-menu";
import { useDataTable as useBaseDataTable } from "@/registry/bases/base/hooks/use-data-table";
import { DataTable as RadixDataTable } from "@/registry/bases/radix/components/data-table/data-table";
import { DataTableSortMenu as RadixDataTableSortMenu } from "@/registry/bases/radix/components/data-table/data-table-sort-menu";
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
}

const bases = [
  ["radix", RadixDataTable, RadixDataTableSortMenu, useRadixDataTable],
  ["base", BaseDataTable, BaseDataTableSortMenu, useBaseDataTable],
  ["aria", AriaDataTable, AriaDataTableSortMenu, useAriaDataTable],
] as const;

describe.each(bases)(
  "DataTableSortMenu (%s)",
  (_, DataTable, DataTableSortMenu, useDataTable) => {
    function Table() {
      const { table } = useDataTable<Task>({
        config,
        mode: "client",
        data,
        columns,
        getRowId: (row) => row.id,
      });

      return (
        <DataTable aria-label="Tasks" table={table}>
          <DataTableSortMenu table={table} />
        </DataTable>
      );
    }

    it.each([
      [false, "Asc"],
      [true, "Desc"],
    ])("shows the direction label when desc is %s", (desc, label) => {
      render(
        <NuqsTestingAdapter
          hasMemory
          searchParams={`?sort=title.${desc ? "desc" : "asc"}`}
        >
          <Table />
        </NuqsTestingAdapter>,
      );
      fireEvent.click(screen.getByRole("button", { name: /sort/i }));

      expect(
        screen.getByLabelText("Title sort direction").textContent,
      ).toContain(label);
    });
  },
);

const data: Task[] = [
  { id: "1", title: "Write docs" },
  { id: "2", title: "Fix bug" },
];

const config = createDataTableConfig({ columns: { title: {} } });

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

const columns = columnHelper.columns([
  columnHelper.accessor("title", {
    id: "title",
    meta: { label: "Title" },
    enableSorting: true,
  }),
]);
