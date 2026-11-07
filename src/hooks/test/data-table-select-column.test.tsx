import { createColumnHelper } from "@tanstack/react-table";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { DataTable as AriaDataTable } from "@/registry/bases/aria/components/data-table/data-table";
import { getDataTableSelectColumn as getAriaSelectColumn } from "@/registry/bases/aria/components/data-table/data-table-select-column";
import { useDataTable as useAriaDataTable } from "@/registry/bases/aria/hooks/use-data-table";
import { DataTable as BaseDataTable } from "@/registry/bases/base/components/data-table/data-table";
import { getDataTableSelectColumn as getBaseSelectColumn } from "@/registry/bases/base/components/data-table/data-table-select-column";
import { useDataTable as useBaseDataTable } from "@/registry/bases/base/hooks/use-data-table";

vi.mock("@/registry/bases/aria/ui/direction", () => ({
  useDirection: () => "ltr",
}));
vi.mock("@/registry/bases/base/ui/direction", () => ({
  useDirection: () => "ltr",
}));

interface Task {
  id: string;
  title: string;
}

describe("DataTableSelectHeader (base)", () => {
  it("is checked and not indeterminate when every row is selected", () => {
    const { table, selectAll } = renderTable(bases.base);

    act(() => table.toggleAllPageRowsSelected(true));

    expect(selectAll.getAttribute("aria-checked")).toBe("true");
    expect(selectAll.hasAttribute("data-checked")).toBe(true);
    expect(selectAll.hasAttribute("data-indeterminate")).toBe(false);
  });

  it("is indeterminate when some rows are selected", () => {
    const { table, selectAll } = renderTable(bases.base);

    act(() => table.getRow("0").toggleSelected(true));

    expect(selectAll.getAttribute("aria-checked")).toBe("mixed");
    expect(selectAll.hasAttribute("data-indeterminate")).toBe(true);
  });
});

// React Aria renders a native input, so state lives in its properties and on the wrapping label
describe("DataTableSelectHeader (aria)", () => {
  it("is checked and not indeterminate when every row is selected", () => {
    const { table, selectAll } = renderTable(bases.aria);

    act(() => table.toggleAllPageRowsSelected(true));

    const input = selectAll as HTMLInputElement;
    const label = getCheckboxLabel(selectAll);
    expect(input.checked).toBe(true);
    expect(input.indeterminate).toBe(false);
    expect(label.hasAttribute("data-selected")).toBe(true);
    expect(label.hasAttribute("data-indeterminate")).toBe(false);
  });

  it("is indeterminate when some rows are selected", () => {
    const { table, selectAll } = renderTable(bases.aria);

    act(() => table.getRow("0").toggleSelected(true));

    const input = selectAll as HTMLInputElement;
    expect(input.indeterminate).toBe(true);
    expect(getCheckboxLabel(selectAll).hasAttribute("data-indeterminate")).toBe(
      true,
    );
  });

  it("keeps the selection when Escape is pressed in the table", () => {
    const { table } = renderTable(bases.aria);

    act(() => table.getRow("0").toggleSelected(true));
    const row = screen.getByRole("row", { name: "Task 0" });
    act(() => row.focus());
    fireEvent.keyDown(row, { key: "Escape" });

    expect(table.getRow("0").getIsSelected()).toBe(true);
  });
});

const bases = {
  base: {
    DataTable: BaseDataTable,
    useDataTable: useBaseDataTable,
    getDataTableSelectColumn: getBaseSelectColumn,
  },
  aria: {
    DataTable: AriaDataTable,
    useDataTable: useAriaDataTable,
    getDataTableSelectColumn: getAriaSelectColumn,
  },
} as const;

const data: Task[] = Array.from({ length: 5 }, (_, index) => ({
  id: String(index),
  title: `Task ${index}`,
}));

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

function renderTable({
  DataTable,
  useDataTable,
  getDataTableSelectColumn,
}: (typeof bases)[keyof typeof bases]) {
  const columns = columnHelper.columns([
    getDataTableSelectColumn<Task>(),
    columnHelper.accessor("title", { id: "title", header: "Title" }),
  ]);
  const tableRef: {
    current?: ReturnType<typeof useBaseDataTable<Task>>["table"];
  } = {};

  function Harness() {
    const { table } = useDataTable<Task>({
      mode: "client",
      data,
      columns,
      getRowId: (row) => row.id,
    });
    tableRef.current = table;
    return <DataTable table={table} />;
  }

  render(
    <NuqsTestingAdapter hasMemory>
      <Harness />
    </NuqsTestingAdapter>,
  );

  const table = tableRef.current;
  if (!table) throw new Error("Table did not render");

  return {
    table,
    selectAll: screen.getByRole("checkbox", { name: "Select all" }),
  };
}

function getCheckboxLabel(input: HTMLElement) {
  const label = input.closest("[data-slot=checkbox]");
  if (!label) throw new Error("Missing checkbox label");
  return label;
}
