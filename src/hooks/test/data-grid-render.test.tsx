import type { ColumnDef } from "@tanstack/react-table";

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import { DataGrid } from "@/registry/bases/radix/components/data-grid/data-grid";
import { useDataGrid } from "@/registry/bases/radix/hooks/use-data-grid";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/registry/bases/radix/ui/direction", () => ({
  useDirection: () => "ltr",
}));

interface TestData {
  id: string;
  name: string;
  trick: string;
}

const testData: TestData[] = [
  { id: "1", name: "Tony Hawk", trick: "900" },
  { id: "2", name: "Rodney Mullen", trick: "Kickflip" },
  { id: "3", name: "Nyjah Huston", trick: "Switch Heel" },
];

const testColumns: ColumnDef<DataGridFeatures, TestData>[] = [
  { id: "name", accessorKey: "name", header: "Name" },
  { id: "trick", accessorKey: "trick", header: "Trick" },
];

function renderGrid() {
  const gridRef: { current?: ReturnType<typeof useDataGrid<TestData>> } = {};
  let hookRenderCount = 0;

  function Harness() {
    const dataGrid = useDataGrid({
      data: testData,
      columns: testColumns,
      getRowId: (row) => row.id,
      enableSearch: true,
    });
    hookRenderCount++;
    gridRef.current = dataGrid;
    return <DataGrid {...dataGrid} />;
  }

  const view = render(<Harness />);
  const table = gridRef.current?.table;
  if (!table) throw new Error("Grid did not render");

  return {
    ...view,
    table,
    getHookRenderCount: () => hookRenderCount,
  };
}

function getCellWrapper(
  container: HTMLElement,
  rowId: string,
  columnId: string,
) {
  return container.querySelector(
    `[data-slot="grid-cell-wrapper"][data-row-id="${rowId}"][data-column-id="${columnId}"]`,
  );
}

describe("DataGrid rendering", () => {
  beforeEach(() => {
    // The virtualizer only renders rows once its scroll element has a size
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      toJSON: () => ({}),
    });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(800);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("moves the focus highlight between rows without re-rendering the hook", () => {
    const { container, table, getHookRenderCount } = renderGrid();
    expect(getCellWrapper(container, "1", "name")).not.toBeNull();

    const renderCountBefore = getHookRenderCount();

    act(() => {
      table.setFocusedCell("1", "name");
    });

    expect(
      getCellWrapper(container, "1", "name")?.hasAttribute("data-focused"),
    ).toBe(true);

    act(() => {
      table.setFocusedCell("2", "trick");
    });

    expect(
      getCellWrapper(container, "1", "name")?.hasAttribute("data-focused"),
    ).toBe(false);
    expect(
      getCellWrapper(container, "2", "trick")?.hasAttribute("data-focused"),
    ).toBe(true);
    expect(getHookRenderCount()).toBe(renderCountBefore);
  });

  it("shows search and the context menu from their own subscriptions", () => {
    const { table, getHookRenderCount } = renderGrid();
    const renderCountBefore = getHookRenderCount();

    expect(screen.queryByPlaceholderText(/find/i)).toBeNull();

    act(() => {
      table.openSearch();
    });

    expect(screen.getByPlaceholderText(/find/i)).not.toBeNull();

    act(() => {
      table.setFocusedCell("1", "name");
      table.openContextMenu({ x: 10, y: 10 });
    });

    expect(screen.getByRole("menu")).not.toBeNull();
    expect(getHookRenderCount()).toBe(renderCountBefore);
  });
});
