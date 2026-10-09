import { createColumnHelper } from "@tanstack/react-table";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { DataTable } from "@/registry/bases/radix/components/data-table/data-table";
import { getDataTableSelectColumn } from "@/registry/bases/radix/components/data-table/data-table-select-column";
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

function renderTable() {
  const cellRenders = new Map<string, number>();
  const headerRenders = new Map<string, number>();
  const tableRef: {
    current?: ReturnType<typeof useDataTable<Task>>["table"];
  } = {};

  function countRender(counts: Map<string, number>, id: string) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const columns = columnHelper.columns([
    getDataTableSelectColumn<Task>(),
    columnHelper.accessor("title", {
      id: "title",
      header: () => {
        countRender(headerRenders, "title");
        return "Title";
      },
      cell: ({ getValue }) => {
        countRender(cellRenders, "title");
        return getValue();
      },
    }),
    columnHelper.accessor("status", {
      id: "status",
      header: () => {
        countRender(headerRenders, "status");
        return "Status";
      },
      cell: ({ getValue }) => {
        countRender(cellRenders, "status");
        return getValue();
      },
    }),
  ]);

  function Harness() {
    const { table } = useDataTable<Task>({
      mode: "client",
      data,
      columns,
      getRowId: (row) => row.id,
      enableRowRangeSelection: true,
    });
    tableRef.current = table;
    return <DataTable table={table} />;
  }

  const view = render(
    <NuqsTestingAdapter hasMemory>
      <Harness />
    </NuqsTestingAdapter>,
  );

  const table = tableRef.current;
  if (!table) throw new Error("Table did not render");

  function measure(action: () => void) {
    cellRenders.clear();
    headerRenders.clear();
    act(action);
    const sum = (counts: Map<string, number>) =>
      [...counts.values()].reduce((total, count) => total + count, 0);
    return { cells: sum(cellRenders), headers: sum(headerRenders) };
  }

  return { ...view, table, measure };
}

describe("DataTable rendering", () => {
  it("only re-renders the row when one row is selected", () => {
    const { container, measure } = renderTable();
    const checkbox = screen.getAllByRole("checkbox", { name: "Select row" })[0];
    if (!checkbox) throw new Error("Missing row checkbox");

    const counts = measure(() => fireEvent.click(checkbox));

    expect(counts).toEqual({ cells: 0, headers: 0 });
    expect(checkbox.getAttribute("data-state")).toBe("checked");
    expect(
      container.querySelectorAll('tr[data-state="selected"]'),
    ).toHaveLength(1);
  });

  it("does not re-render cells or headers when every row is selected", () => {
    const { container, measure } = renderTable();

    const counts = measure(() =>
      fireEvent.click(screen.getByRole("checkbox", { name: "Select all" })),
    );

    expect(counts).toEqual({ cells: 0, headers: 0 });
    expect(
      container.querySelectorAll('tr[data-state="selected"]'),
    ).toHaveLength(10);
  });

  it("does not re-render headers when filters change", () => {
    const { table, measure } = renderTable();

    const counts = measure(() =>
      table.getColumn("title")?.setFilterValue("Task 0"),
    );

    expect(counts.headers).toBe(0);
  });

  it("only renders the cells of a column whose visibility or pinning changes", () => {
    const { container, table, measure } = renderTable();

    expect(
      measure(() => table.getColumn("status")?.toggleVisibility(false)).cells,
    ).toBe(0);
    expect(container.querySelectorAll("tbody td")).toHaveLength(20);

    expect(
      measure(() => table.getColumn("status")?.toggleVisibility(true)).cells,
    ).toBe(10);
    expect(measure(() => table.getColumn("title")?.pin("start")).cells).toBe(
      10,
    );
  });

  it("does not re-render cells when columns resize", () => {
    const { table, measure } = renderTable();

    const counts = measure(() => table.setColumnSizing({ title: 300 }));

    expect(counts).toEqual({ cells: 0, headers: 0 });
  });
});
