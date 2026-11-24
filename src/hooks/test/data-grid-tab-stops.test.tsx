import type { ColumnDef } from "@tanstack/react-table";

import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type { FileCellData } from "@/lib/data-grid-types";

import { DataGrid as BaseDataGrid } from "@/registry/bases/base/components/data-grid/data-grid";
import { useDataGrid as useBaseDataGrid } from "@/registry/bases/base/hooks/use-data-grid";
import { TooltipProvider as BaseTooltipProvider } from "@/registry/bases/base/ui/tooltip";
import { DataGrid as RadixDataGrid } from "@/registry/bases/radix/components/data-grid/data-grid";
import { useDataGrid as useRadixDataGrid } from "@/registry/bases/radix/hooks/use-data-grid";
import { TooltipProvider as RadixTooltipProvider } from "@/registry/bases/radix/ui/tooltip";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/registry/bases/radix/ui/direction", () => ({
  useDirection: () => "ltr",
}));
vi.mock("@/registry/bases/base/ui/direction", () => ({
  useDirection: () => "ltr",
}));

interface Skater {
  id: string;
  bio: string;
  stance: string;
  tricks: string[];
  joined: string;
  media: FileCellData[];
}

const data: Skater[] = [
  {
    id: "1",
    bio: "Landed the 900",
    stance: "goofy",
    tricks: ["900"],
    joined: "2024-01-15",
    media: [],
  },
  {
    id: "2",
    bio: "Invented the flatground ollie",
    stance: "regular",
    tricks: [],
    joined: "2024-02-01",
    media: [],
  },
];

const options = [
  { label: "Goofy", value: "goofy" },
  { label: "Regular", value: "regular" },
  { label: "900", value: "900" },
];

const columns: ColumnDef<DataGridFeatures, Skater>[] = [
  {
    id: "bio",
    accessorKey: "bio",
    header: "Bio",
    meta: { variant: "long-text" },
  },
  {
    id: "stance",
    accessorKey: "stance",
    header: "Stance",
    meta: { variant: "select", options },
  },
  {
    id: "tricks",
    accessorKey: "tricks",
    header: "Tricks",
    meta: { variant: "multi-select", options },
  },
  {
    id: "joined",
    accessorKey: "joined",
    header: "Joined",
    meta: { variant: "date" },
  },
  {
    id: "media",
    accessorKey: "media",
    header: "Media",
    meta: { variant: "file", multiple: true },
  },
];

const bases = [
  ["radix", RadixDataGrid, useRadixDataGrid, RadixTooltipProvider],
  ["base", BaseDataGrid, useBaseDataGrid, BaseTooltipProvider],
] as const;

describe.each(bases)(
  "DataGrid tab stops (%s)",
  (_, DataGrid, useDataGrid, TooltipProvider) => {
    beforeEach(() => {
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 2400,
        bottom: 600,
        width: 2400,
        height: 600,
        toJSON: () => ({}),
      });
      vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(
        600,
      );
      vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(
        2400,
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("adds no tab stops for popover cells", () => {
      function Grid() {
        const dataGrid = useDataGrid({
          data,
          columns,
          getRowId: (row) => row.id,
        });

        return <DataGrid {...dataGrid} />;
      }

      render(<Grid />, { wrapper: TooltipProvider });

      const grid = document.querySelector('[role="grid"]');
      if (!grid) throw new Error("No grid");

      expect(
        grid.querySelectorAll('[data-slot="data-grid-cell"]'),
      ).toHaveLength(data.length * columns.length);
      expect(grid.querySelectorAll('[role="button"]')).toHaveLength(0);
      expect(
        grid.querySelectorAll('[data-slot="data-grid-cell"] [tabindex="0"]'),
      ).toHaveLength(0);
    });
  },
);
