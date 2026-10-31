import type { ColumnDef } from "@tanstack/react-table";

import { act, render } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import { DataGrid } from "@/registry/bases/radix/components/data-grid/data-grid";
import { useDataGrid } from "@/registry/bases/radix/hooks/use-data-grid";
import { TooltipProvider } from "@/registry/bases/radix/ui/tooltip";

const renders = vi.hoisted(() => ({ cells: 0 }));

vi.mock("@/lib/data-grid-utils", async (importOriginal) => {
  const utils = await importOriginal<typeof import("@/lib/data-grid-utils")>();
  return {
    ...utils,
    getCellLayoutStyle: (
      ...args: Parameters<typeof utils.getCellLayoutStyle>
    ) => {
      renders.cells++;
      return utils.getCellLayoutStyle(...args);
    },
  };
});

vi.mock("@/registry/bases/radix/ui/direction", () => ({
  useDirection: () => "ltr",
}));

interface Trick {
  id: string;
  name: string;
  spot: string;
}

const tricks: Trick[] = Array.from({ length: 20 }, (_, index) => ({
  id: String(index),
  name: `Trick ${index}`,
  spot: `Spot ${index}`,
}));

const columns: ColumnDef<DataGridFeatures, Trick>[] = [
  { id: "name", accessorKey: "name", size: 150, meta: { variant: "text" } },
  { id: "spot", accessorKey: "spot", size: 150, meta: { variant: "text" } },
];

describe("DataGrid renders", () => {
  let frames: FrameRequestCallback[] = [];

  beforeEach(() => {
    frames = [];
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ width: 1000, height: 800 }),
    );
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(1000);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(800);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("commits a row height change once", () => {
    const { table, getCommits } = renderGrid();

    act(() => table.setRowHeight("tall"));
    flushFrames();

    expect(getCommits()).toBe(1);
  });

  it("re-renders no data cells while a column resizes", () => {
    const { table } = renderGrid();

    act(() => table.setColumnSizing({ name: 200 }));
    flushFrames();

    expect(renders.cells).toBe(0);
  });

  function flushFrames() {
    act(() => {
      for (const frame of frames.splice(0)) frame(0);
    });
  }

  function renderGrid() {
    const gridRef: {
      current?: ReturnType<typeof useDataGrid<Trick>>["table"];
    } = {};
    let commits = 0;

    function Harness() {
      const dataGrid = useDataGrid({
        data: tricks,
        columns,
        getRowId: (row) => row.id,
      });
      gridRef.current = dataGrid.table;
      return (
        <React.Profiler id="grid" onRender={() => commits++}>
          <DataGrid {...dataGrid} height={800} />
        </React.Profiler>
      );
    }

    render(<Harness />, { wrapper: TooltipProvider });
    flushFrames();
    const table = gridRef.current;
    if (!table) throw new Error("Grid did not render");
    expect(
      document.querySelectorAll('[data-slot="data-grid-cell"]').length,
    ).toBeGreaterThan(0);

    commits = 0;
    renders.cells = 0;
    return { table, getCommits: () => commits };
  }
});
