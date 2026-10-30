import { createColumnHelper } from "@tanstack/react-table";
import { act, render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { DataTable } from "@/registry/bases/base/components/data-table/data-table";
import { getDataTableSelectColumn } from "@/registry/bases/base/components/data-table/data-table-select-column";
import { useDataTable } from "@/registry/bases/base/hooks/use-data-table";

vi.mock("@/registry/bases/base/ui/direction", () => ({
  useDirection: () => "ltr",
}));

interface Task {
  id: string;
  title: string;
}

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

describe("DataTableSelectHeader (base)", () => {
  it("is checked and not indeterminate when every row is selected", () => {
    const { table, selectAll } = renderTable();

    act(() => table.toggleAllPageRowsSelected(true));

    expect(selectAll.getAttribute("aria-checked")).toBe("true");
    expect(selectAll.hasAttribute("data-checked")).toBe(true);
    expect(selectAll.hasAttribute("data-indeterminate")).toBe(false);
  });

  it("is indeterminate when some rows are selected", () => {
    const { table, selectAll } = renderTable();

    act(() => table.getRow("0").toggleSelected(true));

    expect(selectAll.getAttribute("aria-checked")).toBe("mixed");
    expect(selectAll.hasAttribute("data-indeterminate")).toBe(true);
  });
});

const data: Task[] = Array.from({ length: 5 }, (_, index) => ({
  id: String(index),
  title: `Task ${index}`,
}));

const columns = columnHelper.columns([
  getDataTableSelectColumn<Task>(),
  columnHelper.accessor("title", { id: "title", header: "Title" }),
]);

function renderTable() {
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
