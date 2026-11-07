import { createColumnHelper } from "@tanstack/react-table";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { DataTable as AriaDataTable } from "@/registry/bases/aria/components/data-table/data-table";
import { DataTableToolbar as AriaDataTableToolbar } from "@/registry/bases/aria/components/data-table/data-table-toolbar";
import { useDataTable as useAriaDataTable } from "@/registry/bases/aria/hooks/use-data-table";
import { DataTable as BaseDataTable } from "@/registry/bases/base/components/data-table/data-table";
import { DataTableToolbar as BaseDataTableToolbar } from "@/registry/bases/base/components/data-table/data-table-toolbar";
import { useDataTable as useBaseDataTable } from "@/registry/bases/base/hooks/use-data-table";
import { DataTable as RadixDataTable } from "@/registry/bases/radix/components/data-table/data-table";
import { DataTableToolbar as RadixDataTableToolbar } from "@/registry/bases/radix/components/data-table/data-table-toolbar";
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

const data: Task[] = [
  { id: "1", title: "login bug" },
  { id: "2", title: "new feature" },
];

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

const columns = columnHelper.columns([
  columnHelper.accessor("title", { id: "title", header: "Title" }),
]);

const bases = [
  ["radix", RadixDataTable, RadixDataTableToolbar, useRadixDataTable],
  ["base", BaseDataTable, BaseDataTableToolbar, useBaseDataTable],
  ["aria", AriaDataTable, AriaDataTableToolbar, useAriaDataTable],
] as const;

describe.each(bases)(
  "DataTableToolbar global filter (%s)",
  (_, DataTable, DataTableToolbar, useDataTable) => {
    function renderToolbar(globalFilterPlaceholder?: string) {
      const tableRef: {
        current?: ReturnType<typeof useRadixDataTable<Task>>["table"];
      } = {};

      function Harness() {
        const { table } = useDataTable<Task>({
          mode: "client",
          data,
          columns,
          getRowId: (row) => row.id,
        });
        tableRef.current = table;

        return (
          <DataTable aria-label="Tasks" table={table}>
            <DataTableToolbar
              table={table}
              globalFilterPlaceholder={globalFilterPlaceholder}
            />
          </DataTable>
        );
      }

      render(
        <NuqsTestingAdapter hasMemory>
          <Harness />
        </NuqsTestingAdapter>,
      );

      return () => {
        const table = tableRef.current;
        if (!table) throw new Error("Table did not render");
        return table;
      };
    }

    it("leaves the search input out by default", () => {
      renderToolbar();

      expect(screen.queryByRole("textbox", { name: "Search tasks..." })).toBe(
        null,
      );
    });

    it("sets the global filter from the search input", () => {
      const getTable = renderToolbar("Search tasks...");

      fireEvent.change(
        screen.getByRole("textbox", { name: "Search tasks..." }),
        {
          target: { value: "bug" },
        },
      );

      expect(getTable().state.globalFilter).toBe("bug");
      expect(
        getTable()
          .getRowModel()
          .rows.map((row) => row.original.title),
      ).toEqual(["login bug"]);
    });

    it("clears the search with the reset button", () => {
      const getTable = renderToolbar("Search tasks...");
      const input = screen.getByRole("textbox", { name: "Search tasks..." });

      fireEvent.change(input, { target: { value: "bug" } });
      expect(getTable().state.globalFilter).toBe("bug");
      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
      });

      expect(getTable().state.globalFilter).toBe("");
      expect((input as HTMLInputElement).value).toBe("");
    });
  },
);
