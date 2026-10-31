import type { ColumnDef } from "@tanstack/react-table";

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import { insertTextAtSelection } from "@/lib/data-grid-utils";
import { DataGrid } from "@/registry/bases/radix/components/data-grid/data-grid";
import { getDataGridActionsColumn } from "@/registry/bases/radix/components/data-grid/data-grid-actions-column";
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

  it("gives custom headers their own hooks and renders memo headers", () => {
    function CountHeader({ label }: { label: string }) {
      const [count] = React.useState(1);
      return <span>{`${label} ${count}`}</span>;
    }
    const MemoHeader = React.memo(function MemoHeader() {
      return <span>memo header</span>;
    });
    const columns: ColumnDef<DataGridFeatures, TestData>[] = [
      {
        id: "name",
        accessorKey: "name",
        header: function NameHeader() {
          const [label] = React.useState("Name");
          return <CountHeader label={label} />;
        },
      },
      {
        id: "trick",
        accessorKey: "trick",
        header: function TrickHeader() {
          const [label] = React.useState("Trick");
          React.useMemo(() => label, [label]);
          return <CountHeader label={label} />;
        },
      },
      { id: "id", accessorKey: "id", header: MemoHeader },
    ];

    const { container, table } = renderGrid(columns);
    const headerText = () =>
      Array.from(
        container.querySelectorAll('[data-slot="data-grid-header-cell"]'),
        (header) => header.textContent,
      );

    expect(headerText()).toEqual(["Name 1", "Trick 1", "memo header"]);

    act(() => {
      table.getColumn("name")?.toggleVisibility(false);
    });

    expect(headerText()).toEqual(["Trick 1", "memo header"]);
  });

  it("remounts a cell when its column's renderer changes", () => {
    function Harness({
      columns,
    }: {
      columns: ColumnDef<DataGridFeatures, TestData>[];
    }) {
      const dataGrid = useDataGrid({
        data: testData,
        columns,
        getRowId: (row) => row.id,
      });
      return <DataGrid {...dataGrid} />;
    }

    const compact: ColumnDef<DataGridFeatures, TestData>[] = [
      {
        id: "name",
        accessorKey: "name",
        cell: function CompactCell({ getValue }) {
          return <span>{String(getValue())}</span>;
        },
      },
    ];
    const detailed: ColumnDef<DataGridFeatures, TestData>[] = [
      {
        id: "name",
        accessorKey: "name",
        cell: function DetailedCell({ row }) {
          const [prefix] = React.useState("Rider");
          const label = React.useMemo(
            () => `${prefix}: ${row.original.name}`,
            [prefix, row.original.name],
          );
          return <span>{label}</span>;
        },
      },
    ];

    const { container, rerender } = render(<Harness columns={compact} />);
    expect(getCellWrapper(container, "1", "name")?.textContent).toBe(
      "Tony Hawk",
    );

    rerender(<Harness columns={detailed} />);
    expect(getCellWrapper(container, "1", "name")?.textContent).toBe(
      "Rider: Tony Hawk",
    );
  });

  it("labels row action triggers by default or with getAriaLabel", () => {
    const { rerender } = render(<></>);

    function Grid({
      getAriaLabel,
    }: {
      getAriaLabel?: (row: { original: TestData }) => string;
    }) {
      const columns = React.useMemo<ColumnDef<DataGridFeatures, TestData>[]>(
        () => [
          ...testColumns,
          getDataGridActionsColumn<TestData>({
            actions: () => null,
            getAriaLabel,
          }),
        ],
        [getAriaLabel],
      );
      const dataGrid = useDataGrid({
        data: testData,
        columns,
        getRowId: (row) => row.id,
      });
      return <DataGrid {...dataGrid} />;
    }

    rerender(<Grid />);
    expect(
      screen.getByRole("button", { name: "Open actions for row 1" }),
    ).not.toBeNull();

    rerender(
      <Grid getAriaLabel={(row) => `Open actions for ${row.original.name}`} />,
    );
    expect(
      screen.getByRole("button", { name: "Open actions for Tony Hawk" }),
    ).not.toBeNull();
  });

  it("renders cells that are memo or forwardRef components", () => {
    type CellProps = { row: { original: TestData } };
    const MemoCell = React.memo(function MemoCell({ row }: CellProps) {
      return <span>memo {row.original.name}</span>;
    });
    const ForwardRefCell = React.forwardRef<HTMLSpanElement, CellProps>(
      function ForwardRefCell({ row }, ref) {
        return <span ref={ref}>ref {row.original.trick}</span>;
      },
    );
    const columns: ColumnDef<DataGridFeatures, TestData>[] = [
      { id: "memo", accessorKey: "name", cell: MemoCell },
      { id: "forwardRef", accessorKey: "trick", cell: ForwardRefCell },
    ];

    const { container } = renderGrid(columns);

    expect(getCellWrapper(container, "1", "memo")?.textContent).toBe(
      "memo Tony Hawk",
    );
    expect(getCellWrapper(container, "1", "forwardRef")?.textContent).toBe(
      "ref 900",
    );
  });

  it("re-renders cells whose value comes from an accessor or another field", () => {
    const columns: ColumnDef<DataGridFeatures, TestData>[] = [
      {
        id: "label",
        accessorFn: (row) => `${row.name} (${row.trick})`,
        header: "Label",
      },
      {
        id: "summary",
        accessorKey: "name",
        header: "Summary",
        cell: ({ row }) => `Trick: ${row.original.trick}`,
      },
    ];
    function Harness({ data }: { data: TestData[] }) {
      const dataGrid = useDataGrid({
        data,
        columns,
        getRowId: (row) => row.id,
      });
      return <DataGrid {...dataGrid} />;
    }

    const { container, rerender } = render(<Harness data={testData} />);
    expect(getCellWrapper(container, "1", "label")?.textContent).toBe(
      "Tony Hawk (900)",
    );
    expect(getCellWrapper(container, "1", "summary")?.textContent).toBe(
      "Trick: 900",
    );

    rerender(
      <Harness
        data={testData.map((row) =>
          row.id === "1" ? { ...row, trick: "Ollie" } : row,
        )}
      />,
    );

    expect(getCellWrapper(container, "1", "label")?.textContent).toBe(
      "Tony Hawk (Ollie)",
    );
    expect(getCellWrapper(container, "1", "summary")?.textContent).toBe(
      "Trick: Ollie",
    );
  });

  it("updates cells whose value comes from an accessor or another field through updateCells", () => {
    const { container, table } = renderGrid([
      { id: "trick", accessorKey: "trick", header: "Trick" },
      {
        id: "label",
        accessorFn: (row) => `${row.name} (${row.trick})`,
        header: "Label",
      },
      {
        id: "summary",
        accessorKey: "name",
        header: "Summary",
        cell: ({ row }) => `Trick: ${row.original.trick}`,
      },
    ]);

    act(() => {
      table.updateCells({ rowId: "1", columnId: "trick", value: "Ollie" });
    });

    expect(getCellWrapper(container, "1", "label")?.textContent).toBe(
      "Tony Hawk (Ollie)",
    );
    expect(getCellWrapper(container, "1", "summary")?.textContent).toBe(
      "Trick: Ollie",
    );
  });

  it("syncs a controlled textarea after inserting text at the caret", () => {
    function Editor() {
      const [value, setValue] = React.useState("900");
      const textareaRef = React.useRef<HTMLTextAreaElement>(null);

      return (
        <>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              const textarea = textareaRef.current;
              if (!textarea) return;
              textarea.focus();
              textarea.setSelectionRange(
                textarea.value.length,
                textarea.value.length,
              );
              insertTextAtSelection(textarea, "x");
            }}
          >
            insert
          </button>
        </>
      );
    }

    render(<Editor />);

    act(() => {
      screen.getByRole("button", { name: "insert" }).click();
    });

    expect(screen.getByRole("textbox")).toHaveProperty("value", "900x");
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
    const grid = container.querySelector<HTMLElement>(
      '[data-slot="data-grid"]',
    );
    const body = container.querySelector<HTMLElement>(
      '[data-slot="data-grid-body"]',
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

  it("outlines cells collaborators are on and only re-renders their rows", () => {
    const rowRenderCounts = new Map<string, number>();
    const { container, table } = renderGrid([
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
      table.setCellPresence([
        { rowId: "2", columnId: "trick", name: "Rodney", color: "#ff0000" },
      ]);
    });

    expect(
      table.getRow("2").getAllCellsByColumnId().trick?.getPresence(),
    ).toEqual({
      rowId: "2",
      columnId: "trick",
      name: "Rodney",
      color: "#ff0000",
    });
    expect(
      getCellWrapper(container, "2", "trick")?.style.getPropertyValue(
        "--tw-ring-color",
      ),
    ).toBe("#ff0000");
    expect(
      getCellWrapper(container, "2", "name")?.style.getPropertyValue(
        "--tw-ring-color",
      ),
    ).toBe("");
    expect(rowRenderCounts.get("1")).toBe(countsBefore.get("1"));
    expect(rowRenderCounts.get("3")).toBe(countsBefore.get("3"));

    act(() => {
      table.setCellPresence([]);
    });

    expect(
      getCellWrapper(container, "2", "trick")?.style.getPropertyValue(
        "--tw-ring-color",
      ),
    ).toBe("");
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
      '[data-slot="data-grid-header-cell"][data-column-id="name"] button',
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
      document.activeElement?.closest('[data-slot="data-grid-header"]'),
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

  it("highlights a resize handle while its column resizes", async () => {
    renderGrid();
    const resizer = screen.getByRole("separator", {
      name: "Resize Name column",
    });

    fireEvent.mouseDown(resizer, { clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 120 });
    expect(resizer.classList.contains("bg-primary")).toBe(true);

    fireEvent.mouseUp(document, { clientX: 120 });
    await waitFor(() =>
      expect(resizer.classList.contains("bg-primary")).toBe(false),
    );
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

  it("moves past columns that opt out of cell selection", () => {
    const { container, table } = renderGrid([
      testColumns[0],
      { ...testColumns[1], enableCellSelection: false },
    ] as ColumnDef<DataGridFeatures, TestData>[]);
    const getOrder = () =>
      table.getVisibleLeafColumns().map((column) => column.id);

    act(() => {
      getHeaderTrigger(container, "name")?.focus();
    });
    pressHeaderKey(getHeaderTrigger(container, "name"), "ArrowRight", {
      shiftKey: true,
    });
    expect(getOrder()).toEqual(["trick", "name"]);
  });

  it("keeps columns that opt out of ordering in place", () => {
    const { container, table } = renderGrid([
      { id: "rank", header: "Rank", enableOrdering: false },
      ...testColumns,
    ] as ColumnDef<DataGridFeatures, TestData>[]);
    const getOrder = () =>
      table.getVisibleLeafColumns().map((column) => column.id);

    act(() => {
      getHeaderTrigger(container, "rank")?.focus();
    });
    pressHeaderKey(getHeaderTrigger(container, "rank"), "ArrowRight", {
      shiftKey: true,
    });
    expect(getOrder()).toEqual(["rank", "name", "trick"]);

    act(() => {
      getHeaderTrigger(container, "name")?.focus();
    });
    pressHeaderKey(getHeaderTrigger(container, "name"), "ArrowLeft", {
      shiftKey: true,
    });
    expect(getOrder()).toEqual(["rank", "name", "trick"]);
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

  it("keeps focus in place when selecting all rows from the header", () => {
    const { table } = renderGrid([getDataGridSelectColumn(), ...testColumns]);
    const selectAll = screen.getByRole("checkbox", { name: "Select all" });

    act(() => {
      table.setFocusedCell("3", "name");
    });
    act(() => {
      selectAll.focus();
    });
    act(() => {
      selectAll.click();
    });

    expect(table.getIsAllRowsSelected()).toBe(true);
    expect(document.activeElement).toBe(selectAll);
    const focusedCell = table.getFocusedCell();
    expect(focusedCell?.row.id).toBe("3");
    expect(focusedCell?.column.id).toBe("name");
    expect(table.getIsCellSelected("1", "name")).toBe(true);
  });

  it("returns focus to the focused cell when the paste dialog closes", async () => {
    const { container, table } = renderGrid();

    act(() => {
      table.setFocusedCell("2", "trick");
    });
    act(() => {
      document.body.focus();
      table.setPasteDialog({ open: true, rowsNeeded: 1, clipboardText: "x" });
    });
    act(() => {
      screen.getByRole("button", { name: "Cancel" }).click();
    });
    await act(
      () =>
        new Promise((resolve) => requestAnimationFrame(() => resolve(null))),
    );

    expect(document.activeElement).toBe(
      getCellWrapper(container, "2", "trick"),
    );
  });

  it("only mounts the columns inside the horizontal viewport", () => {
    const wideColumns = Array.from(
      { length: 30 },
      (_, index): ColumnDef<DataGridFeatures, TestData> => ({
        id: `column${index}`,
        accessorFn: (row) => row.name,
        header: `Column ${index}`,
        size: 100,
      }),
    );
    const { container } = renderGrid(wideColumns);

    const firstRowCells = container.querySelectorAll(
      '[role="row"][aria-rowindex="2"] [role="gridcell"]',
    );
    expect(firstRowCells.length).toBeGreaterThan(0);
    expect(firstRowCells.length).toBeLessThan(wideColumns.length);
    expect(getCellWrapper(container, "1", "column0")).not.toBeNull();
    expect(getCellWrapper(container, "1", "column29")).toBeNull();
    expect(
      container.querySelectorAll('[data-slot="data-grid-header-cell"]').length,
    ).toBe(firstRowCells.length);
  });

  it("updates rendered cells when columns are hidden or reordered", () => {
    const { container, table } = renderGrid();

    function getRowColumnIds() {
      return Array.from(
        container.querySelectorAll<HTMLElement>(
          '[data-slot="data-grid-cell"][data-row-id="1"]',
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

  it("opens the context menu at the focused cell from the keyboard", () => {
    const { container, table } = renderGrid();
    const cell = getCellWrapper(container, "1", "name");

    function press(key: string, modifiers: KeyboardEventInit = {}) {
      act(() => {
        cell?.dispatchEvent(
          new KeyboardEvent("keydown", { key, bubbles: true, ...modifiers }),
        );
      });
    }

    act(() => {
      table.setFocusedCell("1", "name");
    });

    press("F10", { shiftKey: true });
    expect(table.atoms.contextMenu.get()).toEqual({
      open: true,
      x: 0,
      y: 600,
    });
    expect(screen.getByRole("menu")).not.toBeNull();

    act(() => {
      table.closeContextMenu();
    });
    press("F10");
    expect(table.atoms.contextMenu.get().open).toBe(false);

    press("ContextMenu");
    expect(table.atoms.contextMenu.get().open).toBe(true);
  });

  it("makes the focusable cell wrapper the gridcell", () => {
    const { container } = renderGrid();

    const wrapper = getCellWrapper(container, "1", "name");
    expect(wrapper?.getAttribute("role")).toBe("gridcell");
    expect(wrapper?.getAttribute("aria-colindex")).toBe("1");
    expect(wrapper?.parentElement?.getAttribute("role")).toBe("row");
    expect(
      wrapper
        ?.querySelector('[data-slot="data-grid-cell-content"]')
        ?.getAttribute("role"),
    ).toBeNull();
  });

  it("names the cell textbox only while editing", () => {
    const { container, table } = renderGrid();

    act(() => {
      table
        .getCoreRowModel()
        .rowsById["1"]?.getAllCellsByColumnId()
        .name?.startEditing();
    });

    expect(
      screen
        .getByRole("textbox", { name: "Name" })
        .closest('[data-slot="data-grid-cell"]'),
    ).toBe(getCellWrapper(container, "1", "name"));
  });

  it("counts the header row in aria-rowcount", () => {
    renderGrid();

    const rows = screen.getAllByRole("row");
    expect(screen.getByRole("grid").getAttribute("aria-rowcount")).toBe("4");
    expect(rows.at(-1)?.getAttribute("aria-rowindex")).toBe("4");
  });

  it("sets aria-sort only on the primary sorted column", () => {
    const { table } = renderGrid();

    act(() => {
      table.setSorting([
        { id: "trick", desc: true },
        { id: "name", desc: false },
      ]);
    });

    const sortedHeaders = screen
      .getAllByRole("columnheader")
      .filter((header) => header.hasAttribute("aria-sort"));
    expect(
      sortedHeaders.map((header) => [
        header.textContent,
        header.getAttribute("aria-sort"),
      ]),
    ).toEqual([["Trick", "descending"]]);
  });
});

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
    `[data-slot="data-grid-cell"][data-row-id="${rowId}"][data-column-id="${columnId}"]`,
  );
}

function getHeaderTrigger(container: HTMLElement, columnId: string) {
  return container.querySelector<HTMLElement>(
    `[data-slot="data-grid-header-cell"][data-column-id="${columnId}"] button`,
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
