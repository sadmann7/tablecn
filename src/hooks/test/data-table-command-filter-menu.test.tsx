import type { Table } from "@tanstack/react-table";

import { createColumnHelper } from "@tanstack/react-table";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type { ColumnFilterItem } from "@/lib/data-table-types";

import { createDataTableConfig } from "@/lib/data-table-config";
import { DataTable as AriaDataTable } from "@/registry/bases/aria/components/data-table/data-table";
import { DataTableCommandFilterMenu as AriaDataTableCommandFilterMenu } from "@/registry/bases/aria/components/data-table/data-table-command-filter-menu";
import { useDataTable as useAriaDataTable } from "@/registry/bases/aria/hooks/use-data-table";
import { DataTable as BaseDataTable } from "@/registry/bases/base/components/data-table/data-table";
import { DataTableCommandFilterMenu as BaseDataTableCommandFilterMenu } from "@/registry/bases/base/components/data-table/data-table-command-filter-menu";
import { useDataTable as useBaseDataTable } from "@/registry/bases/base/hooks/use-data-table";
import { DataTable as RadixDataTable } from "@/registry/bases/radix/components/data-table/data-table";
import { DataTableCommandFilterMenu as RadixDataTableCommandFilterMenu } from "@/registry/bases/radix/components/data-table/data-table-command-filter-menu";
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
  ["radix", RadixDataTable, RadixDataTableCommandFilterMenu, useRadixDataTable],
  ["base", BaseDataTable, BaseDataTableCommandFilterMenu, useBaseDataTable],
  ["aria", AriaDataTable, AriaDataTableCommandFilterMenu, useAriaDataTable],
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
  "DataTableCommandFilterMenu ($name)",
  ({ base }) => {
    it("renders one chip per filter", () => {
      renderCommandMenu(base, [titleFilter, statusFilter]);

      expect(
        screen.getAllByRole("button", { name: /^Remove .+ filter$/ }),
      ).toHaveLength(2);
    });

    it("removes a chip with its remove button", () => {
      const { table } = renderCommandMenu(base, [titleFilter, statusFilter]);

      fireEvent.click(
        screen.getByRole("button", { name: "Remove Title filter" }),
      );

      expect(table.getColumnFilterItems().map((filter) => filter.id)).toEqual([
        "status",
      ]);
    });

    it("resets all chips", () => {
      const { table } = renderCommandMenu(base, [titleFilter, statusFilter]);

      fireEvent.click(
        screen.getByRole("button", { name: "Reset all filters" }),
      );

      expect(table.getColumnFilterItems()).toEqual([]);
    });

    it("shows an empty boolean filter as empty", () => {
      renderCommandMenu(base, [getBooleanFilter("")]);
      const trigger = screen.getByLabelText("Done boolean filter");

      expect(trigger.textContent).toContain("Select value");
      expect(trigger.textContent).not.toContain("True");
    });

    it("shows the column placeholder in an empty select filter", () => {
      renderCommandMenu(base, [
        {
          id: "status",
          value: [],
          operator: "inArray",
          variant: "multi-select",
          filterId: "status-0",
        },
      ]);

      expect(
        screen.getByLabelText("Status filter values").textContent,
      ).toContain("Pick a status");
    });

    it("shows the chosen boolean value", () => {
      renderCommandMenu(base, [getBooleanFilter("true")]);

      expect(
        screen.getByLabelText("Done boolean filter").textContent,
      ).toContain("True");
    });

    it("shows the operator label", () => {
      renderCommandMenu(base, [titleFilter]);

      expect(
        screen.getByLabelText("Title filter operator").textContent,
      ).toContain("Contains");
    });
  },
);

describe("radix command filter menu", () => {
  const radix = bases[0];

  it("adds a text filter from the palette", () => {
    const { table } = renderCommandMenu(radix);
    openPalette();

    fireEvent.click(screen.getByRole("option", { name: "Title" }));
    fireEvent.change(getPaletteInput(), { target: { value: "bug" } });
    fireEvent.click(screen.getByRole("option", { name: /bug/ }));

    expect(table.getColumnFilterItems()).toMatchObject([
      { id: "title", operator: "iLike", value: "bug" },
    ]);
  });

  it("adds a boolean filter from the palette", () => {
    const { table } = renderCommandMenu(radix);
    openPalette();

    fireEvent.click(screen.getByRole("option", { name: "Done" }));
    fireEvent.click(screen.getByRole("option", { name: "True" }));

    expect(table.getColumnFilterItems()).toMatchObject([
      { id: "done", operator: "eq", value: "true" },
    ]);
  });

  it("goes back to the field list with Backspace in the empty search", () => {
    renderCommandMenu(radix);
    openPalette();

    fireEvent.click(screen.getByRole("option", { name: "Title" }));
    fireEvent.keyDown(getPaletteInput(), { key: "Backspace" });

    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Title", "Status", "Done"]);
  });

  it("removes a focused chip with Backspace", () => {
    const { table } = renderCommandMenu(radix, [titleFilter, statusFilter]);

    fireEvent.keyDown(screen.getAllByRole("listitem")[0] as HTMLElement, {
      key: "Backspace",
    });

    expect(table.getColumnFilterItems().map((filter) => filter.id)).toEqual([
      "status",
    ]);
  });
});

function openPalette() {
  fireEvent.click(
    screen.getByRole("button", { name: "Open filter command menu" }),
  );
}

function getPaletteInput() {
  const input = document.querySelector("[cmdk-input]");
  if (!input) throw new Error("Missing palette input");
  return input;
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
      placeholder: "Pick a status",
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

const config = createDataTableConfig({
  columns: {
    title: { variant: "text" },
    status: { variant: "multi-select" },
    done: { variant: "boolean" },
  },
});

function renderCommandMenu(
  [, DataTable, DataTableCommandFilterMenu, useDataTable]: Base,
  filters: ColumnFilterItem[] = [],
) {
  const tableRef: { current?: Table<DataTableFeatures, Task> } = {};

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
      <DataTable aria-label="Tasks" table={table}>
        <DataTableCommandFilterMenu table={table} />
      </DataTable>
    );
  }

  render(
    <NuqsTestingAdapter hasMemory>
      <Harness />
    </NuqsTestingAdapter>,
  );
  if (filters.length > 0) {
    act(() => tableRef.current?.setColumnFilters(filters));
  }

  return {
    get table() {
      if (!tableRef.current) throw new Error("Missing table");
      return tableRef.current;
    },
  };
}
