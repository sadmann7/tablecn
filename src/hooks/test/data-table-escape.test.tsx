import { createColumnHelper } from "@tanstack/react-table";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vitest";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { createDataTableConfig } from "@/lib/data-table-config";
import { DataTable as AriaDataTable } from "@/registry/bases/aria/components/data-table/data-table";
import { useDataTable as useAriaDataTable } from "@/registry/bases/aria/hooks/use-data-table";
import { DataTable as BaseDataTable } from "@/registry/bases/base/components/data-table/data-table";
import { useDataTable as useBaseDataTable } from "@/registry/bases/base/hooks/use-data-table";
import { DataTable as RadixDataTable } from "@/registry/bases/radix/components/data-table/data-table";
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

const data: Task[] = Array.from({ length: 3 }, (_, index) => ({
  id: String(index),
  title: `Task ${index}`,
}));

const config = createDataTableConfig({ columns: { title: {} } });

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

const columns = columnHelper.columns([
  columnHelper.accessor("title", { id: "title", header: "Title" }),
  columnHelper.display({
    id: "portal",
    header: "Portal",
    cell: ({ row }) =>
      createPortal(
        <button type="button">Portaled {row.id}</button>,
        document.body,
      ),
  }),
]);

const bases = [
  ["radix", RadixDataTable, useRadixDataTable],
  ["base", BaseDataTable, useBaseDataTable],
  ["aria", AriaDataTable, useAriaDataTable],
] as const;

describe.each(bases)("DataTable Escape (%s)", (_, DataTable, useDataTable) => {
  function renderTable(onEscapeKeyDown?: (event: KeyboardEvent) => void) {
    const tableRef: {
      current?: ReturnType<typeof useRadixDataTable<Task>>["table"];
    } = {};

    function Harness() {
      const { table } = useDataTable<Task>({
        config,
        mode: "client",
        data,
        columns,
        getRowId: (row) => row.id,
      });
      tableRef.current = table;

      return (
        <DataTable
          aria-label="Tasks"
          table={table}
          onEscapeKeyDown={onEscapeKeyDown}
        >
          <input aria-label="Toolbar search" />
        </DataTable>
      );
    }

    render(
      <NuqsTestingAdapter hasMemory>
        <Harness />
      </NuqsTestingAdapter>,
    );

    const table = tableRef.current;
    if (!table) throw new Error("Table did not render");
    act(() => table.getRow("0").toggleSelected(true));

    return table;
  }

  function pressEscape(element: HTMLElement) {
    act(() => element.focus());
    fireEvent.keyDown(element, { key: "Escape" });
  }

  it("clears the row selection on Escape inside the table", () => {
    const table = renderTable();

    pressEscape(screen.getByText("Task 1"));

    expect(table.getRow("0").getIsSelected()).toBe(false);
  });

  it("keeps the selection when onEscapeKeyDown prevents the default", () => {
    const onEscapeKeyDown = vi.fn((event: KeyboardEvent) =>
      event.preventDefault(),
    );
    const table = renderTable(onEscapeKeyDown);

    pressEscape(screen.getByText("Task 1"));

    expect(onEscapeKeyDown).toHaveBeenCalledOnce();
    expect(table.getRow("0").getIsSelected()).toBe(true);
  });

  it("keeps the selection on Escape from content portaled out of the table", () => {
    const onEscapeKeyDown = vi.fn();
    const table = renderTable(onEscapeKeyDown);

    pressEscape(screen.getByRole("button", { name: "Portaled 1" }));

    expect(onEscapeKeyDown).not.toHaveBeenCalled();
    expect(table.getRow("0").getIsSelected()).toBe(true);
  });

  it("keeps the selection on Escape from the toolbar", () => {
    const table = renderTable();

    pressEscape(screen.getByRole("textbox", { name: "Toolbar search" }));

    expect(table.getRow("0").getIsSelected()).toBe(true);
  });
});
