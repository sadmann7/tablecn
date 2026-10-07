import type { ColumnDef } from "@tanstack/react-table";

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import { DataGrid } from "@/registry/bases/radix/components/data-grid/data-grid";
import { getDataGridSelectColumn } from "@/registry/bases/radix/components/data-grid/data-grid-select-column";
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

function renderGrid(columns = testColumns) {
  const gridRef: { current?: ReturnType<typeof useDataGrid<TestData>> } = {};
  let hookRenderCount = 0;

  function Harness() {
    const dataGrid = useDataGrid({
      data: testData,
      columns,
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
  return container.querySelector<HTMLElement>(
    `[data-slot="grid-cell-wrapper"][data-row-id="${rowId}"][data-column-id="${columnId}"]`,
  );
}

function getHeaderTrigger(container: HTMLElement, columnId: string) {
  return container.querySelector<HTMLElement>(
    `[data-slot="grid-header-cell"][data-column-id="${columnId}"] button`,
  );
}

function pressHeaderKey(
  target: HTMLElement | null,
  key: string,
  modifiers: Pick<KeyboardEventInit, "altKey" | "shiftKey">,
) {
  act(() => {
    target?.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, ...modifiers }),
    );
  });
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

  it("sizes the body and scrolls without re-rendering the hook", async () => {
    const { container, getHookRenderCount } = renderGrid();
    const grid = container.querySelector<HTMLElement>('[data-slot="grid"]');
    const body = container.querySelector<HTMLElement>(
      '[data-slot="grid-body"]',
    );
    expect(body?.style.height).toMatch(/^\d+px$/);

    const renderCountBefore = getHookRenderCount();

    await act(async () => {
      if (!grid) return;
      grid.scrollTop = 36;
      grid.dispatchEvent(new Event("scroll"));
    });

    expect(getHookRenderCount()).toBe(renderCountBefore);
  });

  it("only re-renders the row whose selection changed", () => {
    const rowRenderCounts = new Map<string, number>();
    const { table } = renderGrid([
      {
        id: "select",
        header: () => null,
        cell: ({ row }) => {
          rowRenderCounts.set(row.id, (rowRenderCounts.get(row.id) ?? 0) + 1);
          return null;
        },
      },
      ...testColumns,
    ]);
    const countsBefore = new Map(rowRenderCounts);

    act(() => {
      table.getRow("2").toggleSelected(true);
    });

    expect(rowRenderCounts.get("1")).toBe(countsBefore.get("1"));
    expect(rowRenderCounts.get("2")).toBeGreaterThan(
      countsBefore.get("2") ?? 0,
    );
    expect(rowRenderCounts.get("3")).toBe(countsBefore.get("3"));
  });

  it("hides the focused cell while a column header has focus", () => {
    const { container, table } = renderGrid();

    act(() => {
      table.getRow("1").toggleSelected(true);
    });

    expect(
      getCellWrapper(container, "1", "name")?.hasAttribute("data-focused"),
    ).toBe(true);

    const headerTrigger = container.querySelector<HTMLElement>(
      '[data-slot="grid-header-cell"][data-column-id="name"] button',
    );
    act(() => {
      headerTrigger?.focus();
    });

    expect(container.querySelector("[data-focused]")).toBeNull();
    expect(
      container
        .querySelector('[role="row"][aria-rowindex="2"]')
        ?.getAttribute("aria-selected"),
    ).toBe("true");

    act(() => {
      table.setFocusedCell("2", "trick");
      getCellWrapper(container, "2", "trick")?.focus();
    });

    expect(
      getCellWrapper(container, "2", "trick")?.hasAttribute("data-focused"),
    ).toBe(true);
  });

  it("clears cell and row selection when moving up into the header", () => {
    const { container, table } = renderGrid();

    act(() => {
      table.getRow("1").toggleSelected(true);
    });
    const cell = getCellWrapper(container, "1", "name");
    expect(cell?.hasAttribute("data-focused")).toBe(true);

    act(() => {
      cell?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
      );
    });

    expect(
      document.activeElement?.closest('[data-slot="grid-header"]'),
    ).not.toBeNull();
    expect(table.atoms.cellSelection.get()).toEqual([]);
    expect(table.atoms.rowSelection.get()).toEqual({});
  });

  it("resizes the focused header column with Alt+Arrow within its bounds", () => {
    const { container, table } = renderGrid([
      { ...testColumns[0], size: 100, maxSize: 115 },
      ...testColumns.slice(1),
    ] as ColumnDef<DataGridFeatures, TestData>[]);
    const headerTrigger = getHeaderTrigger(container, "name");

    act(() => {
      headerTrigger?.focus();
    });
    pressHeaderKey(headerTrigger, "ArrowRight", { altKey: true });
    expect(table.getColumn("name")?.getSize()).toBe(110);

    pressHeaderKey(headerTrigger, "ArrowRight", { altKey: true });
    expect(table.getColumn("name")?.getSize()).toBe(115);

    pressHeaderKey(headerTrigger, "ArrowLeft", { altKey: true });
    expect(table.getColumn("name")?.getSize()).toBe(105);
    expect(document.activeElement).toBe(headerTrigger);
  });

  it("exposes each column's own size bounds on its resize handle", () => {
    renderGrid([
      { ...testColumns[0], minSize: 80, maxSize: 300 },
      ...testColumns.slice(1),
    ] as ColumnDef<DataGridFeatures, TestData>[]);

    const nameResizer = screen.getByRole("separator", {
      name: "Resize Name column",
    });
    expect(nameResizer.getAttribute("aria-valuemin")).toBe("80");
    expect(nameResizer.getAttribute("aria-valuemax")).toBe("300");

    const trickResizer = screen.getByRole("separator", {
      name: "Resize Trick column",
    });
    expect(trickResizer.getAttribute("aria-valuemin")).toBe("60");
    expect(trickResizer.getAttribute("aria-valuemax")).toBe("800");
  });

  it("moves the focused header column with Shift+Arrow", () => {
    const { container, table } = renderGrid([
      getDataGridSelectColumn(),
      ...testColumns,
    ]);
    const getOrder = () =>
      table.getVisibleLeafColumns().map((column) => column.id);

    act(() => {
      getHeaderTrigger(container, "name")?.focus();
    });
    pressHeaderKey(getHeaderTrigger(container, "name"), "ArrowLeft", {
      shiftKey: true,
    });
    expect(getOrder()).toEqual(["select", "name", "trick"]);

    pressHeaderKey(getHeaderTrigger(container, "name"), "ArrowRight", {
      shiftKey: true,
    });
    expect(getOrder()).toEqual(["select", "trick", "name"]);

    pressHeaderKey(getHeaderTrigger(container, "name"), "ArrowRight", {
      shiftKey: true,
    });
    expect(getOrder()).toEqual(["select", "trick", "name"]);
  });

  it("selects a range of rows with Shift+click on the select checkbox", () => {
    const { table } = renderGrid([getDataGridSelectColumn(), ...testColumns]);
    const [firstCheckbox, , thirdCheckbox] = screen.getAllByRole("checkbox", {
      name: "Select row",
    });

    act(() => {
      firstCheckbox?.click();
    });
    act(() => {
      thirdCheckbox?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, shiftKey: true }),
      );
    });

    expect(table.atoms.rowSelection.get()).toEqual({
      "1": true,
      "2": true,
      "3": true,
    });
  });

  it("keeps focus on the select cell while toggling rows", () => {
    const { table } = renderGrid([getDataGridSelectColumn(), ...testColumns]);
    const secondCheckbox = screen.getAllByRole("checkbox", {
      name: "Select row",
    })[1];

    act(() => {
      table.setFocusedCell("1", "select");
    });
    act(() => {
      secondCheckbox?.click();
    });

    const focusedCell = table.getFocusedCell();
    expect(focusedCell?.row.id).toBe("2");
    expect(focusedCell?.column.id).toBe("select");
    expect(table.getIsCellSelected("2", "name")).toBe(true);
    expect(table.getIsCellSelected("2", "select")).toBe(false);
  });

  it("updates rendered cells when columns are hidden or reordered", () => {
    const { container, table } = renderGrid();

    function getRowColumnIds() {
      return Array.from(
        container.querySelectorAll<HTMLElement>(
          '[data-slot="grid-cell-wrapper"][data-row-id="1"]',
        ),
        (element) => element.dataset.columnId,
      );
    }

    expect(getRowColumnIds()).toEqual(["name", "trick"]);

    act(() => {
      table.setColumnOrder(["trick", "name"]);
    });

    expect(getRowColumnIds()).toEqual(["trick", "name"]);

    act(() => {
      table.getColumn("trick")?.toggleVisibility(false);
    });

    expect(getRowColumnIds()).toEqual(["name"]);
  });

  it("scrolls to a cell without moving focus or selection", () => {
    const { table } = renderGrid();

    act(() => {
      table.setFocusedCell("1", "name");
    });
    const selectionBefore = table.atoms.cellSelection.get();

    act(() => {
      table.scrollToCell("3", "trick");
    });

    expect(table.atoms.cellSelection.get()).toBe(selectionBefore);
    expect(table.getEditingCell()).toBeNull();
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
