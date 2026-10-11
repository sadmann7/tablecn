import { createColumnHelper } from "@tanstack/react-table";
import { fireEvent, render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { DataTable as BaseDataTable } from "@/registry/bases/base/components/data-table/data-table";
import { getDataTableActionsColumn as getBaseActionsColumn } from "@/registry/bases/base/components/data-table/data-table-actions-column";
import { useDataTable as useBaseDataTable } from "@/registry/bases/base/hooks/use-data-table";
import { DropdownMenuItem as BaseDropdownMenuItem } from "@/registry/bases/base/ui/dropdown-menu";
import { DataTable as RadixDataTable } from "@/registry/bases/radix/components/data-table/data-table";
import { getDataTableActionsColumn as getRadixActionsColumn } from "@/registry/bases/radix/components/data-table/data-table-actions-column";
import { useDataTable as useRadixDataTable } from "@/registry/bases/radix/hooks/use-data-table";
import { DropdownMenuItem as RadixDropdownMenuItem } from "@/registry/bases/radix/ui/dropdown-menu";

vi.mock("@/registry/bases/base/ui/direction", () => ({
  useDirection: () => "ltr",
}));
vi.mock("@/registry/bases/radix/ui/direction", () => ({
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

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

const bases = [
  {
    name: "base",
    DataTable: BaseDataTable,
    useDataTable: useBaseDataTable,
    getDataTableActionsColumn: getBaseActionsColumn,
    DropdownMenuItem: BaseDropdownMenuItem,
    openMenu: (trigger: HTMLElement) => fireEvent.click(trigger),
  },
  {
    name: "radix",
    DataTable: RadixDataTable,
    useDataTable: useRadixDataTable,
    getDataTableActionsColumn: getRadixActionsColumn,
    DropdownMenuItem: RadixDropdownMenuItem,
    openMenu: (trigger: HTMLElement) =>
      fireEvent.keyDown(trigger, { key: "Enter" }),
  },
] as const;

describe.each(bases)(
  "getDataTableActionsColumn ($name)",
  ({
    DataTable,
    useDataTable,
    getDataTableActionsColumn,
    DropdownMenuItem,
    openMenu,
  }) => {
    function renderTable(
      options: Partial<
        Parameters<typeof getDataTableActionsColumn<Task>>[0]
      > = {},
    ) {
      const columns = columnHelper.columns([
        columnHelper.accessor("title", { id: "title", header: "Title" }),
        getDataTableActionsColumn<Task>({
          actions: ({ row }) => (
            <DropdownMenuItem>Edit {row.original.title}</DropdownMenuItem>
          ),
          ...options,
        }),
      ]);

      function Harness() {
        const { table } = useDataTable({
          mode: "client",
          data,
          columns,
          getRowId: (row) => row.id,
        });
        return <DataTable table={table} />;
      }

      render(
        <NuqsTestingAdapter hasMemory>
          <Harness />
        </NuqsTestingAdapter>,
      );
    }

    it("renders a visually hidden header and a labeled trigger per row", () => {
      renderTable();

      expect(screen.getByText("Actions").classList.contains("sr-only")).toBe(
        true,
      );
      expect(
        screen.getAllByRole("button", { name: /^Open actions for row \d$/ }),
      ).toHaveLength(data.length);
      expect(
        screen.getByRole("button", { name: "Open actions for row 1" }),
      ).toBeDefined();
    });

    it("uses a custom trigger label", () => {
      renderTable({
        getAriaLabel: (row) => `Open actions for ${row.original.title}`,
      });

      expect(
        screen.getByRole("button", { name: "Open actions for Task 2" }),
      ).toBeDefined();
    });

    it("renders the row's actions when the menu opens", async () => {
      renderTable();

      openMenu(screen.getByRole("button", { name: "Open actions for row 2" }));

      expect(
        await screen.findByRole("menuitem", { name: "Edit Task 1" }),
      ).toBeDefined();
      expect(
        screen.queryByRole("menuitem", { name: "Edit Task 0" }),
      ).toBeNull();
    });

    it("can't be sorted or hidden by default", () => {
      const column = getDataTableActionsColumn<Task>({ actions: () => null });

      expect(column).toMatchObject({
        id: "actions",
        enableSorting: false,
        enableHiding: false,
      });
    });
  },
);
