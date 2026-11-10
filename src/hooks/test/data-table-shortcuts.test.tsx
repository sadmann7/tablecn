import { createColumnHelper } from "@tanstack/react-table";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { createDataTableConfig } from "@/lib/data-table-config";
import { DataTable as AriaDataTable } from "@/registry/bases/aria/components/data-table/data-table";
import { DataTableSortMenu as AriaDataTableSortMenu } from "@/registry/bases/aria/components/data-table/data-table-sort-menu";
import { useDataTable as useAriaDataTable } from "@/registry/bases/aria/hooks/use-data-table";
import { DataTable as BaseDataTable } from "@/registry/bases/base/components/data-table/data-table";
import { DataTableSortMenu as BaseDataTableSortMenu } from "@/registry/bases/base/components/data-table/data-table-sort-menu";
import { useDataTable as useBaseDataTable } from "@/registry/bases/base/hooks/use-data-table";
import { DataTable as RadixDataTable } from "@/registry/bases/radix/components/data-table/data-table";
import { DataTableSortMenu as RadixDataTableSortMenu } from "@/registry/bases/radix/components/data-table/data-table-sort-menu";
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

const bases = [
  ["radix", RadixDataTable, RadixDataTableSortMenu, useRadixDataTable],
  ["base", BaseDataTable, BaseDataTableSortMenu, useBaseDataTable],
  ["aria", AriaDataTable, AriaDataTableSortMenu, useAriaDataTable],
] as const;

describe.each(bases)(
  "menu shortcuts with two tables (%s)",
  (_, DataTable, DataTableSortMenu, useDataTable) => {
    function Table({
      config,
      label,
    }: {
      config: typeof firstConfig;
      label: string;
    }) {
      const { table } = useDataTable<Task>({
        config,
        mode: "client",
        data,
        columns,
        getRowId: (row) => row.id,
      });

      return (
        <DataTable aria-label={label} table={table}>
          <DataTableSortMenu table={table} />
        </DataTable>
      );
    }

    function renderTables() {
      return render(
        <NuqsTestingAdapter hasMemory>
          <Table config={firstConfig} label="First" />
          <Table config={secondConfig} label="Second" />
        </NuqsTestingAdapter>,
      );
    }

    it("opens only the menu of the table the key was pressed in", async () => {
      renderTables();
      const cell = getTableRoot("Second").querySelector(
        '[aria-label="Second"] tbody *',
      );
      if (!cell) throw new Error("Missing cell in the second table");

      await pressSortShortcut(cell);

      expect(screen.getAllByText("No sorting applied")).toHaveLength(1);
      expect(
        getTableRoot("Second").querySelector("button[aria-expanded='true']"),
      ).not.toBeNull();
    });

    it("opens only the first table's menu from outside every table", async () => {
      renderTables();

      await pressSortShortcut(document.body);

      expect(screen.getAllByText("No sorting applied")).toHaveLength(1);
      expect(
        getTableRoot("First").querySelector("button[aria-expanded='true']"),
      ).not.toBeNull();
    });
  },
);

const data: Task[] = Array.from({ length: 3 }, (_, index) => ({
  id: String(index),
  title: `Task ${index}`,
}));

const firstConfig = createDataTableConfig({
  id: "first",
  columns: { title: {} },
});
const secondConfig = createDataTableConfig({
  id: "second",
  columns: { title: {} },
});

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

const columns = columnHelper.columns([
  columnHelper.accessor("title", { id: "title", header: "Title" }),
]);

async function pressSortShortcut(target: Element) {
  await act(async () => {
    fireEvent.keyDown(target, {
      key: "s",
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
    });
  });
}

function getTableRoot(label: string) {
  const root = document
    .querySelector(`[aria-label="${label}"]`)
    ?.closest('[data-slot="data-table"]');
  if (!root) throw new Error(`Missing table ${label}`);
  return root;
}
