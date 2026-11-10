import { createColumnHelper } from "@tanstack/react-table";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { createDataTableConfig } from "@/lib/data-table-config";
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
  done: boolean;
  dueAt: Date;
  priority: string;
}

const data: Task[] = [
  { id: "1", done: true, dueAt: new Date(2026, 9, 3), priority: "high" },
  { id: "2", done: false, dueAt: new Date(2026, 9, 10), priority: "low" },
];

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

const columns = columnHelper.columns([
  columnHelper.accessor("done", {
    id: "done",
    meta: { label: "Done", variant: "boolean" },
    enableColumnFilter: true,
  }),
  columnHelper.accessor("dueAt", {
    id: "dueAt",
    meta: { label: "Due", variant: "date" },
    enableColumnFilter: true,
  }),
  columnHelper.accessor("priority", {
    id: "priority",
    meta: {
      label: "Priority",
      variant: "select",
      multiple: false,
      options: [
        { label: "High", value: "high" },
        { label: "Low", value: "low" },
      ],
    },
    enableColumnFilter: true,
  }),
]);

const config = createDataTableConfig({
  columns: {
    done: { variant: "boolean" },
    dueAt: { variant: "date" },
    priority: { variant: "select" },
  },
});

const bases = [
  ["radix", RadixDataTable, RadixDataTableToolbar, useRadixDataTable],
  ["base", BaseDataTable, BaseDataTableToolbar, useBaseDataTable],
  ["aria", AriaDataTable, AriaDataTableToolbar, useAriaDataTable],
] as const;

describe.each(bases)(
  "DataTableToolbar boolean and date filters (%s)",
  (name, DataTable, DataTableToolbar, useDataTable) => {
    function renderToolbar(searchParams = "") {
      const tableRef: {
        current?: ReturnType<typeof useRadixDataTable<Task>>["table"];
      } = {};

      function Harness() {
        const { table } = useDataTable<Task>({
          mode: "client",
          config,
          data,
          columns,
          getRowId: (row) => row.id,
        });
        tableRef.current = table;

        return (
          <DataTable aria-label="Tasks" table={table}>
            <DataTableToolbar table={table} />
          </DataTable>
        );
      }

      render(
        <NuqsTestingAdapter hasMemory searchParams={searchParams}>
          <Harness />
        </NuqsTestingAdapter>,
      );

      return () => {
        const table = tableRef.current;
        if (!table) throw new Error("Table did not render");
        return table;
      };
    }

    it("filters a boolean column from the toolbar", () => {
      const getTable = renderToolbar();

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: /^Done/ }));
      });
      act(() => {
        fireEvent.click(
          screen.getByRole(name === "aria" ? "menuitemradio" : "option", {
            name: "True",
          }),
        );
      });

      expect(getTable().getColumnFilterItems()).toEqual([
        expect.objectContaining({
          id: "done",
          operator: "eq",
          value: "true",
        }),
      ]);
    });

    it("keeps one value in a single-pick select filter", () => {
      const getTable = renderToolbar();
      const role = name === "aria" ? "menuitemradio" : "option";

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: /^Priority/ }));
      });
      act(() => {
        fireEvent.click(screen.getByRole(role, { name: "High" }));
      });
      if (!screen.queryByRole(role, { name: "Low" })) {
        act(() => {
          fireEvent.click(screen.getByRole("button", { name: /^Priority/ }));
        });
      }
      act(() => {
        fireEvent.click(screen.getByRole(role, { name: "Low" }));
      });

      expect(getTable().getColumnFilterItems()).toEqual([
        expect.objectContaining({
          id: "priority",
          operator: "inArray",
          value: ["low"],
        }),
      ]);
    });

    it("shows the chosen boolean value", () => {
      renderToolbar("?done=false");

      expect(
        screen.getByRole("button", { name: /^Done/ }).textContent,
      ).toContain("False");
    });

    it("shows a single date for a one-day range", () => {
      const getTable = renderToolbar();
      const day = new Date(2026, 9, 3).getTime();

      act(() => getTable().getColumn("dueAt")?.setFilterValue([day, day]));

      const text = screen.getByRole("button", { name: /^Due/ }).textContent;
      expect(text).not.toContain(" - ");
      expect(getTable().getColumnFilterItems()).toEqual([
        expect.objectContaining({
          id: "dueAt",
          operator: "isBetween",
          value: ["2026-10-03", "2026-10-03"],
        }),
      ]);
    });

    it.skipIf(name === "aria")(
      "treats one click in the date range as that day",
      () => {
        const getTable = renderToolbar();

        act(() => {
          fireEvent.click(screen.getByRole("button", { name: /^Due/ }));
        });
        const dialog = screen.getByRole("dialog");
        const cell = within(dialog).getAllByRole("button", { name: /\d/ });
        const dayButton = cell.find((button) => button.dataset.day);
        if (!dayButton) throw new Error("No day cell rendered");
        act(() => {
          fireEvent.click(dayButton);
        });

        const [item] = getTable().getColumnFilterItems();
        expect(item).toMatchObject({ id: "dueAt", operator: "isBetween" });
        expect(Array.isArray(item?.value) && item.value[0]).toBeTruthy();
        expect(Array.isArray(item?.value) && item.value[0]).toBe(
          Array.isArray(item?.value) && item.value[1],
        );
      },
    );
  },
);
