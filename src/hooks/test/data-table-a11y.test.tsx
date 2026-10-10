import { createColumnHelper } from "@tanstack/react-table";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { DataTable } from "@/registry/bases/radix/components/data-table/data-table";
import { getDataTableSelectColumn } from "@/registry/bases/radix/components/data-table/data-table-select-column";
import { DataTableSkeleton } from "@/registry/bases/radix/components/data-table/data-table-skeleton";
import { DataTableToolbar } from "@/registry/bases/radix/components/data-table/data-table-toolbar";
import { useDataTable } from "@/registry/bases/radix/hooks/use-data-table";

vi.mock("@/registry/bases/radix/ui/direction", () => ({
  useDirection: () => "ltr",
}));

interface Task {
  id: string;
  title: string;
  status: string;
}

const data: Task[] = Array.from({ length: 30 }, (_, index) => ({
  id: String(index),
  title: `Task ${String(index).padStart(2, "0")}`,
  status: index % 2 ? "todo" : "done",
}));

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

const columns = columnHelper.columns([
  getDataTableSelectColumn<Task>(),
  columnHelper.accessor("title", { id: "title", header: "Title" }),
  columnHelper.accessor("status", {
    id: "status",
    header: "Status",
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
]);

function renderTable(search = "") {
  const tableRef: {
    current?: ReturnType<typeof useDataTable<Task>>["table"];
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

function getSortedHeaders(container: HTMLElement) {
  return Array.from(container.querySelectorAll("th[aria-sort]"), (th) => [
    th.textContent,
    th.getAttribute("aria-sort"),
  ]);
}

describe("DataTable accessibility", () => {
  it("names the table element", () => {
    const { container } = renderTable();

    expect(screen.getByRole("table", { name: "Tasks" })).toBe(
      container.querySelector("table"),
    );
  });

  it("marks only the primary sorted column with aria-sort", () => {
    const { container, table } = renderTable();

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
    const { table } = renderTable();

    expect(
      screen.getByRole("combobox", { name: "Rows per page" }),
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
    const { table } = renderTable("?status=todo");

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
    renderTable("?status=todo");

    fireEvent.click(screen.getByRole("button", { name: /^Status/ }));

    const dialog = screen.getByRole("dialog", { name: "Status filter" });
    expect(within(dialog).queryByRole("separator")).toBeNull();
    expect(within(dialog).getByText("Clear filters")).toBeDefined();
  });
});

describe("DataTableSkeleton accessibility", () => {
  it("announces loading and hides the placeholder table", () => {
    render(<DataTableSkeleton columnCount={3} />);

    expect(screen.getByRole("status").textContent).toBe("Loading table…");
    expect(screen.queryByRole("table")).toBeNull();
  });
});
