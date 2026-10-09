import { createColumnHelper } from "@tanstack/react-table";
import { render } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import type { DataTableFeatures } from "@/lib/data-table-features";

import * as BaseDataTable from "@/registry/bases/base/components/data-table/data-table";
import * as BaseAdvancedToolbar from "@/registry/bases/base/components/data-table/data-table-advanced-toolbar";
import * as BaseColumnHeader from "@/registry/bases/base/components/data-table/data-table-column-header";
import * as BaseCommandFilterMenu from "@/registry/bases/base/components/data-table/data-table-command-filter-menu";
import * as BaseFilterMenu from "@/registry/bases/base/components/data-table/data-table-filter-menu";
import * as BaseSkeleton from "@/registry/bases/base/components/data-table/data-table-skeleton";
import * as BaseSortMenu from "@/registry/bases/base/components/data-table/data-table-sort-menu";
import * as BaseToolbar from "@/registry/bases/base/components/data-table/data-table-toolbar";
import * as RadixDataTable from "@/registry/bases/radix/components/data-table/data-table";
import * as RadixAdvancedToolbar from "@/registry/bases/radix/components/data-table/data-table-advanced-toolbar";
import * as RadixColumnHeader from "@/registry/bases/radix/components/data-table/data-table-column-header";
import * as RadixCommandFilterMenu from "@/registry/bases/radix/components/data-table/data-table-command-filter-menu";
import * as RadixFilterMenu from "@/registry/bases/radix/components/data-table/data-table-filter-menu";
import * as RadixSkeleton from "@/registry/bases/radix/components/data-table/data-table-skeleton";
import * as RadixSortMenu from "@/registry/bases/radix/components/data-table/data-table-sort-menu";
import * as RadixToolbar from "@/registry/bases/radix/components/data-table/data-table-toolbar";
import { useDataTable } from "@/registry/bases/radix/hooks/use-data-table";

vi.mock("@/registry/bases/radix/ui/direction", () => ({
  useDirection: () => "ltr",
}));

vi.mock("@/registry/bases/base/ui/direction", () => ({
  useDirection: () => "ltr",
}));

interface Task {
  id: string;
  title: string;
  status: string;
  hours: number;
  createdAt: number;
}

const data: Task[] = [
  {
    id: "1",
    title: "Kickflip",
    status: "todo",
    hours: 2,
    createdAt: new Date(2026, 9, 1).getTime(),
  },
  {
    id: "2",
    title: "Heelflip",
    status: "done",
    hours: 6,
    createdAt: new Date(2026, 9, 2).getTime(),
  },
];

const bases = {
  radix: {
    ...RadixDataTable,
    ...RadixToolbar,
    ...RadixAdvancedToolbar,
    ...RadixColumnHeader,
    ...RadixSortMenu,
    ...RadixFilterMenu,
    ...RadixCommandFilterMenu,
    ...RadixSkeleton,
  },
  base: {
    ...BaseDataTable,
    ...BaseToolbar,
    ...BaseAdvancedToolbar,
    ...BaseColumnHeader,
    ...BaseSortMenu,
    ...BaseFilterMenu,
    ...BaseCommandFilterMenu,
    ...BaseSkeleton,
  },
};

function getSlots(container: HTMLElement) {
  return new Set(
    Array.from(
      container.querySelectorAll<HTMLElement>("[data-slot^='data-table']"),
      (element) => element.dataset.slot,
    ),
  );
}

describe.each(Object.entries(bases))("%s data table slots", (_, ui) => {
  const columnHelper = createColumnHelper<DataTableFeatures, Task>();
  const columns = columnHelper.columns([
    columnHelper.accessor("title", {
      id: "title",
      header: ({ column }) => (
        <ui.DataTableColumnHeader column={column} label="Title" />
      ),
      enableColumnFilter: true,
      meta: { label: "Title", variant: "text" },
    }),
    columnHelper.accessor("status", {
      id: "status",
      header: ({ column }) => (
        <ui.DataTableColumnHeader column={column} label="Status" />
      ),
      enableSorting: false,
      enableHiding: false,
      enableColumnFilter: true,
      meta: {
        label: "Status",
        variant: "multiSelect",
        options: [
          { label: "Todo", value: "todo" },
          { label: "Done", value: "done" },
        ],
      },
    }),
    columnHelper.accessor("hours", {
      id: "hours",
      enableColumnFilter: true,
      meta: { label: "Hours", variant: "range", range: [0, 10] },
    }),
    columnHelper.accessor("createdAt", {
      id: "createdAt",
      enableColumnFilter: true,
      meta: { label: "Created At", variant: "date" },
    }),
  ]);

  function renderTable(toolbar: "plain" | "advanced" | "command") {
    function Harness() {
      const { table } = useDataTable<Task>({
        mode: "client",
        data,
        columns,
        getRowId: (row) => row.id,
      });

      return (
        <ui.DataTable table={table}>
          {toolbar === "plain" ? (
            <ui.DataTableToolbar table={table}>
              <ui.DataTableSortMenu table={table} />
            </ui.DataTableToolbar>
          ) : (
            <ui.DataTableAdvancedToolbar table={table}>
              <ui.DataTableSortMenu table={table} />
              {toolbar === "advanced" ? (
                <ui.DataTableFilterMenu table={table} />
              ) : (
                <ui.DataTableCommandFilterMenu table={table} />
              )}
            </ui.DataTableAdvancedToolbar>
          )}
        </ui.DataTable>
      );
    }

    return render(
      <NuqsTestingAdapter hasMemory>
        <Harness />
      </NuqsTestingAdapter>,
    );
  }

  it("marks every component in the plain toolbar layout", () => {
    const { container } = renderTable("plain");

    expect(getSlots(container)).toEqual(
      new Set([
        "data-table",
        "data-table-toolbar",
        "data-table-faceted-filter",
        "data-table-slider-filter",
        "data-table-date-filter",
        "data-table-sort-menu",
        "data-table-view-options",
        "data-table-column-header",
        "data-table-pagination",
      ]),
    );
    expect(
      Array.from(
        container.querySelectorAll("[data-slot='data-table-column-header']"),
        (header) => header.tagName,
      ),
    ).toEqual(["BUTTON", "DIV"]);
  });

  it("marks the filter menu in the advanced toolbar", () => {
    const { container } = renderTable("advanced");

    expect(
      container.querySelector(
        "[data-slot='data-table-advanced-toolbar'] [data-slot='data-table-filter-menu']",
      ),
    ).not.toBeNull();
  });

  it("marks the command filter menu in the advanced toolbar", () => {
    const { container } = renderTable("command");

    expect(
      container.querySelector(
        "[data-slot='data-table-advanced-toolbar'] [data-slot='data-table-command-filter-menu']",
      ),
    ).not.toBeNull();
  });

  it("marks the skeleton", () => {
    const { container } = render(<ui.DataTableSkeleton columnCount={2} />);

    expect(getSlots(container)).toEqual(new Set(["data-table-skeleton"]));
  });
});
