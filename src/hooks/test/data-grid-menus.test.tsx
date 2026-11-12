import type { ColumnDef } from "@tanstack/react-table";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import { DataGridFilterMenu as BaseDataGridFilterMenu } from "@/registry/bases/base/components/data-grid/data-grid-filter-menu";
import { DataGridSortMenu as BaseDataGridSortMenu } from "@/registry/bases/base/components/data-grid/data-grid-sort-menu";
import { useDataGrid as useBaseDataGrid } from "@/registry/bases/base/hooks/use-data-grid";
import { DataGridFilterMenu as RadixDataGridFilterMenu } from "@/registry/bases/radix/components/data-grid/data-grid-filter-menu";
import { DataGridSortMenu as RadixDataGridSortMenu } from "@/registry/bases/radix/components/data-grid/data-grid-sort-menu";
import { useDataGrid as useRadixDataGrid } from "@/registry/bases/radix/hooks/use-data-grid";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock("@/registry/bases/radix/ui/direction", () => ({
  useDirection: () => "ltr",
}));
vi.mock("@/registry/bases/base/ui/direction", () => ({
  useDirection: () => "ltr",
}));

interface Skater {
  id: string;
  name: string;
}

const bases = [
  ["radix", RadixDataGridFilterMenu, RadixDataGridSortMenu, useRadixDataGrid],
  ["base", BaseDataGridFilterMenu, BaseDataGridSortMenu, useBaseDataGrid],
] as const;

describe.each(bases)(
  "data grid menus (%s)",
  (_, DataGridFilterMenu, DataGridSortMenu, useDataGrid) => {
    it("shows the filter operator label", () => {
      function Grid() {
        const { table } = useDataGrid({
          data,
          columns,
          initialState: {
            columnFilters: [
              {
                id: "name",
                value: { operator: "notContains", value: "Tony" },
              },
            ],
          },
        });

        return <DataGridFilterMenu table={table} />;
      }

      render(<Grid />);
      fireEvent.click(screen.getByRole("button", { name: /filter/i }));

      expect(
        screen.getByLabelText("Name filter operator").textContent,
      ).toContain("Does not contain");
    });

    it.each([
      [false, "Asc"],
      [true, "Desc"],
    ])("shows the sort direction label when desc is %s", (desc, label) => {
      function Grid() {
        const { table } = useDataGrid({
          data,
          columns,
          initialState: { sorting: [{ id: "name", desc }] },
        });

        return <DataGridSortMenu table={table} />;
      }

      render(<Grid />);
      fireEvent.click(screen.getByRole("button", { name: /sort/i }));

      expect(
        screen.getByLabelText("Name sort direction").textContent,
      ).toContain(label);
    });
  },
);

const data: Skater[] = [
  { id: "1", name: "Tony Hawk" },
  { id: "2", name: "Rodney Mullen" },
];

const columns: ColumnDef<DataGridFeatures, Skater>[] = [
  {
    id: "name",
    accessorKey: "name",
    header: "Name",
    meta: { label: "Name", variant: "text" },
  },
];
