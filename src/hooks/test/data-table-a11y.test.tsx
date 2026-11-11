import { createColumnHelper } from "@tanstack/react-table";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { DataTable as AriaDataTable } from "@/registry/bases/aria/components/data-table/data-table";
import { getDataTableSelectColumn as getAriaSelectColumn } from "@/registry/bases/aria/components/data-table/data-table-select-column";
import { DataTableSkeleton as AriaDataTableSkeleton } from "@/registry/bases/aria/components/data-table/data-table-skeleton";
import { DataTableToolbar as AriaDataTableToolbar } from "@/registry/bases/aria/components/data-table/data-table-toolbar";
import { useDataTable as useAriaDataTable } from "@/registry/bases/aria/hooks/use-data-table";
import { DataTable as RadixDataTable } from "@/registry/bases/radix/components/data-table/data-table";
import { getDataTableSelectColumn as getRadixSelectColumn } from "@/registry/bases/radix/components/data-table/data-table-select-column";
import { DataTableSkeleton as RadixDataTableSkeleton } from "@/registry/bases/radix/components/data-table/data-table-skeleton";
import { DataTableToolbar as RadixDataTableToolbar } from "@/registry/bases/radix/components/data-table/data-table-toolbar";
import { useDataTable as useRadixDataTable } from "@/registry/bases/radix/hooks/use-data-table";

vi.mock("@/registry/bases/aria/ui/direction", () => ({
  useDirection: () => "ltr",
}));
vi.mock("@/registry/bases/radix/ui/direction", () => ({
  useDirection: () => "ltr",
}));

interface Task {
  id: string;
  title: string;
  status: string;
}

const bases = [
  {
    name: "radix",
    DataTable: RadixDataTable,
    DataTableSkeleton: RadixDataTableSkeleton,
    DataTableToolbar: RadixDataTableToolbar,
    useDataTable: useRadixDataTable,
    getDataTableSelectColumn: getRadixSelectColumn,
    tableRole: "table",
    pageSizeSelect: { role: "combobox", name: "Rows per page" },
    filterPopoverName: "Status filter",
    exposesMenuSeparator: false,
  },
  {
    name: "aria",
    DataTable: AriaDataTable,
    DataTableSkeleton: AriaDataTableSkeleton,
    DataTableToolbar: AriaDataTableToolbar,
    useDataTable: useAriaDataTable,
    getDataTableSelectColumn: getAriaSelectColumn,
    // React Aria's Table is an interactive grid.
    tableRole: "grid",
    // React Aria's Select is a listbox button named by its value and label.
    pageSizeSelect: { role: "button", name: "10 Rows per page" },
    // React Aria names a popover by its trigger.
    filterPopoverName: /^Status/,
    // React Aria menus expose their separators.
    exposesMenuSeparator: true,
  },
] as const;

type Base = (typeof bases)[number];

describe.each(bases)("DataTable accessibility ($name)", (ui) => {
  it("names the table element", () => {
    const { container } = renderTable(ui);

    expect(screen.getByRole(ui.tableRole, { name: "Tasks" })).toBe(
      container.querySelector("table"),
    );
  });

  it("marks only the primary sorted column with aria-sort", () => {
    const { container, table } = renderTable(ui);

    expect(getSortedHeaders(container)).toEqual([]);

    act(() =>
      table.setSorting([
        { id: "title", desc: false },
        { id: "status", desc: true },
      ]),
    );
    expect(getSortedHeaders(container)).toEqual([["Title", "ascending"]]);

    act(() => table.setSorting([{ id: "status", desc: true }]));
    expect(getSortedHeaders(container)).toEqual([["Status", "descending"]]);

    act(() => table.resetSorting(true));
    expect(getSortedHeaders(container)).toEqual([]);
  });

  it("labels the page size select and announces selection and page changes", () => {
    const { table } = renderTable(ui);

    expect(
      screen.getByRole(ui.pageSizeSelect.role, {
        name: ui.pageSizeSelect.name,
      }),
    ).toBeDefined();

    const statuses = screen.getAllByRole("status");
    expect(statuses.map((status) => status.textContent)).toEqual([
      "0 rows selected.",
      "Page 1 of 3",
    ]);

    act(() => {
      table.toggleAllPageRowsSelected(true);
      table.nextPage();
    });
    expect(statuses.map((status) => status.textContent)).toEqual([
      "10 rows selected (10 not shown).",
      "Page 2 of 3",
    ]);
  });

  it("keeps the filter clear icon out of the trigger's focus and accessibility tree", () => {
    const { table } = renderTable(ui, "?status=todo");

    const trigger = screen.getByRole("button", { name: /^Status/ });
    const icon = trigger.querySelector("[aria-hidden=true]");
    if (!icon) throw new Error("Missing clear icon");

    expect(
      trigger.querySelectorAll("[tabindex], button, [role=button]"),
    ).toHaveLength(0);

    fireEvent.click(icon);

    expect(table.getColumn("status")?.getFilterValue()).toBeUndefined();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("names the filter popover and offers a clear option inside it", () => {
    renderTable(ui, "?status=todo");

    fireEvent.click(screen.getByRole("button", { name: /^Status/ }));

    const dialog = screen.getByRole("dialog", { name: ui.filterPopoverName });
    expect(within(dialog).queryByRole("separator") !== null).toBe(
      ui.exposesMenuSeparator,
    );
    expect(within(dialog).getByText("Clear filters")).toBeDefined();
  });
});

const data: Task[] = Array.from({ length: 30 }, (_, index) => ({
  id: String(index),
  title: `Task ${String(index).padStart(2, "0")}`,
  status: index % 2 ? "todo" : "done",
}));

function renderTable(ui: Base, search = "") {
  const { DataTable, DataTableToolbar, useDataTable } = ui;
  const columns = getColumns(ui);
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
        <DataTableToolbar table={table} />
      </DataTable>
    );
  }

  const view = render(
    <NuqsTestingAdapter hasMemory searchParams={search}>
      <Harness />
    </NuqsTestingAdapter>,
  );

  const table = tableRef.current;
  if (!table) throw new Error("Table did not render");

  return { ...view, table };
}

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

function getColumns({ getDataTableSelectColumn }: Base) {
  return columnHelper.columns([
    getDataTableSelectColumn<Task>(),
    columnHelper.accessor("title", { id: "title", header: "Title" }),
    columnHelper.accessor("status", {
      id: "status",
      header: "Status",
      enableColumnFilter: true,
      meta: {
        label: "Status",
        variant: "multi-select",
        options: [
          { label: "Todo", value: "todo" },
          { label: "Done", value: "done" },
        ],
      },
    }),
  ]);
}

function getSortedHeaders(container: HTMLElement) {
  return Array.from(container.querySelectorAll("th[aria-sort]"), (th) => [
    th.textContent,
    th.getAttribute("aria-sort"),
  ]);
}

describe.each(bases)(
  "DataTableSkeleton accessibility ($name)",
  ({ DataTableSkeleton }) => {
    it("announces loading and hides the placeholder table", () => {
      render(<DataTableSkeleton columnCount={3} />);

      expect(screen.getByRole("status").textContent).toBe("Loading table…");
      expect(screen.queryByRole("table")).toBeNull();
    });
  },
);
