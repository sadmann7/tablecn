import type { Table } from "@tanstack/react-table";

import { createColumnHelper } from "@tanstack/react-table";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type { ColumnFilterItem } from "@/lib/data-table-types";

import { DataTable as AriaDataTable } from "@/registry/bases/aria/components/data-table/data-table";
import { DataTableFilterMenu as AriaDataTableFilterMenu } from "@/registry/bases/aria/components/data-table/data-table-filter-menu";
import { useDataTable as useAriaDataTable } from "@/registry/bases/aria/hooks/use-data-table";
import { DataTable as BaseDataTable } from "@/registry/bases/base/components/data-table/data-table";
import { DataTableFilterMenu as BaseDataTableFilterMenu } from "@/registry/bases/base/components/data-table/data-table-filter-menu";
import { useDataTable as useBaseDataTable } from "@/registry/bases/base/hooks/use-data-table";
import { DataTable as RadixDataTable } from "@/registry/bases/radix/components/data-table/data-table";
import { DataTableFilterMenu as RadixDataTableFilterMenu } from "@/registry/bases/radix/components/data-table/data-table-filter-menu";
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
  status: string;
  done: boolean;
}

const bases = [
  ["radix", RadixDataTable, RadixDataTableFilterMenu, useRadixDataTable],
  ["base", BaseDataTable, BaseDataTableFilterMenu, useBaseDataTable],
  ["aria", AriaDataTable, AriaDataTableFilterMenu, useAriaDataTable],
] as const;

type Base = (typeof bases)[number];

const titleFilter: ColumnFilterItem = {
  id: "title",
  value: "bug",
  operator: "iLike",
  variant: "text",
  filterId: "title-0",
};

const statusFilter: ColumnFilterItem = {
  id: "status",
  value: ["todo"],
  operator: "inArray",
  variant: "multi-select",
  filterId: "status-0",
};

describe.each(bases.map((base) => ({ name: base[0], base })))(
  "DataTableFilterMenu ($name)",
  ({ base }) => {
    it("lists one row per filter", () => {
      renderFilterMenu(base, [titleFilter, statusFilter]);
      openMenu();

      expect(
        screen.getAllByRole("button", { name: /^Remove .+ filter$/ }),
      ).toHaveLength(2);
    });

    it("adds a filter for the first filterable column", () => {
      const { table } = renderFilterMenu(base);
      openMenu();

      fireEvent.click(screen.getByRole("button", { name: "Add filter" }));

      expect(table.getColumnFilterItems()).toMatchObject([
        { id: "title", operator: "iLike", value: "" },
      ]);
    });

    it("removes a filter with its remove button", () => {
      const { table } = renderFilterMenu(base, [titleFilter, statusFilter]);
      openMenu();

      fireEvent.click(
        screen.getByRole("button", { name: "Remove Title filter" }),
      );

      expect(table.getColumnFilterItems().map((filter) => filter.id)).toEqual([
        "status",
      ]);
    });

    it("resets all filters", () => {
      const { table } = renderFilterMenu(base, [titleFilter, statusFilter]);
      openMenu();

      fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));

      expect(table.getColumnFilterItems()).toEqual([]);
    });

    it("shows an empty boolean filter as empty", () => {
      renderFilterMenu(base, [getBooleanFilter("")]);
      openMenu();
      const trigger = screen.getByLabelText("Done boolean filter");

      expect(trigger.textContent).toContain("Select value");
      expect(trigger.textContent).not.toContain("True");
    });

    it("shows the chosen boolean value", () => {
      renderFilterMenu(base, [getBooleanFilter("true")]);
      openMenu();

      expect(
        screen.getByLabelText("Done boolean filter").textContent,
      ).toContain("True");
    });

    it("shows the operator label", () => {
      renderFilterMenu(base, [titleFilter]);
      openMenu();

      expect(
        screen.getByLabelText("Title filter operator").textContent,
      ).toContain("Contains");
    });
  },
);

describe("radix filter menu", () => {
  const radix = bases[0];

  it("removes a focused row with Backspace", () => {
    const { table } = renderFilterMenu(radix, [titleFilter]);
    openMenu();

    fireEvent.keyDown(screen.getByRole("listitem"), { key: "Backspace" });

    expect(table.getColumnFilterItems()).toEqual([]);
  });

  it("keeps the row when Backspace is pressed in the value input", () => {
    const { table } = renderFilterMenu(radix, [titleFilter]);
    openMenu();

    fireEvent.keyDown(screen.getByLabelText("Title filter value"), {
      key: "Backspace",
    });

    expect(table.getColumnFilterItems()).toHaveLength(1);
  });

  it("shows no value input for a valueless operator", () => {
    renderFilterMenu(radix, [
      { ...titleFilter, operator: "isEmpty", value: "" },
    ]);
    openMenu();

    expect(
      screen.getByRole("status", { name: /^Title filter is/ }),
    ).not.toBeNull();
    expect(screen.queryByLabelText("Title filter value")).toBeNull();
  });

  it("toggles with Ctrl+Shift+F from inside the table", async () => {
    renderFilterMenu(radix);
    const cell = document.querySelector("td");
    if (!cell) throw new Error("Missing table cell");

    await pressFilterShortcut(cell);
    expect(screen.getByRole("button", { name: "Add filter" })).not.toBeNull();

    await pressFilterShortcut(cell);
    expect(screen.queryByRole("button", { name: "Add filter" })).toBeNull();
  });

  it("switches the join operator", () => {
    const { table } = renderFilterMenu(radix, [titleFilter, statusFilter]);
    openMenu();

    fireEvent.click(
      screen.getByRole("combobox", { name: "Select join operator" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "or" }));

    expect(table.getJoinOperator()).toBe("or");
  });
});

async function pressFilterShortcut(target: Element) {
  await act(async () => {
    fireEvent.keyDown(target, {
      key: "f",
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
    });
  });
}

function getBooleanFilter(value: string): ColumnFilterItem {
  return {
    id: "done",
    value,
    operator: "eq",
    variant: "boolean",
    filterId: "done-0",
  };
}

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

const columns = columnHelper.columns([
  columnHelper.accessor("title", {
    id: "title",
    meta: { label: "Title", variant: "text" },
    enableColumnFilter: true,
  }),
  columnHelper.accessor("status", {
    id: "status",
    meta: {
      label: "Status",
      variant: "multi-select",
      options: [
        { label: "Todo", value: "todo" },
        { label: "Done", value: "done" },
      ],
    },
    enableColumnFilter: true,
  }),
  columnHelper.accessor("done", {
    id: "done",
    meta: { label: "Done", variant: "boolean" },
    enableColumnFilter: true,
  }),
]);

const data: Task[] = [
  { id: "1", title: "Write docs", status: "todo", done: true },
  { id: "2", title: "Fix bug", status: "done", done: false },
  { id: "3", title: "Ship it", status: "todo", done: false },
];

function renderFilterMenu(
  [, DataTable, DataTableFilterMenu, useDataTable]: Base,
  filters: ColumnFilterItem[] = [],
) {
  const tableRef: { current?: Table<DataTableFeatures, Task> } = {};

  function Harness() {
    const { table } = useDataTable<Task>({
      mode: "client",
      data,
      columns,
      getRowId: (row) => row.id,
      initialState: { columnFilters: filters },
    });
    tableRef.current = table;

    return (
      <DataTable aria-label="Tasks" table={table}>
        <DataTableFilterMenu table={table} />
      </DataTable>
    );
  }

  render(
    <NuqsTestingAdapter hasMemory>
      <Harness />
    </NuqsTestingAdapter>,
  );

  return {
    get table() {
      if (!tableRef.current) throw new Error("Missing table");
      return tableRef.current;
    },
  };
}

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: /^filter/i }));
}
