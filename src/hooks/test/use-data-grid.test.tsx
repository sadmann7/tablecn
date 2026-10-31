import type * as React from "react";

import {
  type ColumnDef,
  type ColumnFiltersState,
  sortFn_alphanumeric,
  type SortingState,
  type Table,
} from "@tanstack/react-table";
import { act, render, renderHook } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import {
  getCellKey,
  getFocusedCellPosition,
  getHasCustomCell,
  parseTsv,
  stringifyUnknown,
} from "@/lib/data-grid-utils";
import {
  useDataGrid,
  type UseDataGridProps,
} from "@/registry/bases/radix/hooks/use-data-grid";

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
  score: number;
}

const testData: TestData[] = [
  { id: "1", name: "Tony Hawk", trick: "900", score: 95 },
  { id: "2", name: "Rodney Mullen", trick: "Kickflip", score: 98 },
  { id: "3", name: "Nyjah Huston", trick: "Switch Heel", score: 92 },
];

const simpleFilterFn = (
  row: { getValue: (id: string) => unknown },
  _columnId: string,
  filterValue: string,
) => {
  const value = stringifyUnknown(row.getValue(_columnId));
  return value.toLowerCase().includes(filterValue.toLowerCase());
};

const testColumns: ColumnDef<DataGridFeatures, TestData>[] = [
  { id: "name", accessorKey: "name", filterFn: simpleFilterFn },
  { id: "trick", accessorKey: "trick", filterFn: simpleFilterFn },
  {
    id: "score",
    accessorKey: "score",
    meta: { cell: { variant: "number" } },
    filterFn: simpleFilterFn,
  },
];

const columnsWithSelect: ColumnDef<DataGridFeatures, TestData>[] = [
  { id: "select" },
  { id: "name", accessorKey: "name" },
  { id: "trick", accessorKey: "trick" },
  { id: "actions" },
];

type GridBodyEventType =
  | "onClick"
  | "onDoubleClick"
  | "onMouseDown"
  | "onMouseOver"
  | "onMouseUp"
  | "onContextMenu";

describe("useDataGrid", () => {
  let mockClipboard: {
    writeText: ReturnType<typeof vi.fn>;
    readText: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(""),
    };
    Object.defineProperty(navigator, "clipboard", {
      value: mockClipboard,
      writable: true,
      configurable: true,
    });

    // Frames run immediately so effects finish inside `act`, and ones requested
    // from inside a frame are dropped so self-scheduling loops end
    let isRunningFrame = false;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      if (isRunningFrame) return 0;
      isRunningFrame = true;
      try {
        cb(0);
      } finally {
        isRunningFrame = false;
      }
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("initialization", () => {
    it("should initialize with default values", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.table).toBeDefined();
      expect(getFocusedCell(result.current.table)).toBeNull();
      expect(result.current.table.getEditingCell()).toBeNull();
      expect(result.current.table.state.rowHeight).toBe("short");
    });

    it("should initialize with custom rowHeight", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            initialState: { rowHeight: "tall" },
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.table.state.rowHeight).toBe("tall");
      expect(result.current.table.getRowHeight()).toBe("tall");
      expect(result.current.table.getRowSize()).toBe(76);
    });

    it("should initialize with initial sorting state", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            initialState: {
              sorting: [{ id: "name", desc: false }],
            },
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.table.state.sorting).toEqual([
        { id: "name", desc: false },
      ]);
    });

    it("should provide table meta with required callbacks", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.dataGridBodyProps.onClick).toBeDefined();
      expect(result.current.dataGridBodyProps.onDoubleClick).toBeDefined();
      expect(result.current.table.clearSelection).toBeDefined();
      expect(result.current.table.getIsCellSelected).toBeDefined();
    });

    it("should apply option changes on the next render", () => {
      const { result, rerender } = renderHook(
        ({ enableSearch }: { enableSearch: boolean }) =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            enableSearch,
          }),
        { wrapper: createWrapper(), initialProps: { enableSearch: false } },
      );

      expect(result.current.table.options.enableSearch).toBe(false);

      rerender({ enableSearch: true });

      expect(result.current.table.options.enableSearch).toBe(true);
    });

    it("should keep the table options while only callbacks change", () => {
      const firstOnSortingChange = vi.fn();
      const secondOnSortingChange = vi.fn();

      const { result, rerender } = renderHook(
        ({ onSortingChange }: { onSortingChange: () => void }) =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onSortingChange,
          }),
        {
          wrapper: createWrapper(),
          initialProps: { onSortingChange: firstOnSortingChange },
        },
      );

      const initialOptions = result.current.table.options;

      rerender({ onSortingChange: secondOnSortingChange });

      expect(result.current.table.options).toBe(initialOptions);

      act(() => {
        result.current.table.getColumn("name")?.toggleSorting(false);
      });

      expect(firstOnSortingChange).not.toHaveBeenCalled();
      expect(secondOnSortingChange).toHaveBeenCalled();
    });
  });

  describe("cell focus", () => {
    it("should focus a cell via onCellClick", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
      });

      expect(getFocusedCell(result.current.table)).toEqual({
        rowId: "0",
        columnId: "name",
      });
    });

    it("should update focused cell when clicking different cells", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
      });

      expect(getFocusedCell(result.current.table)).toEqual({
        rowId: "0",
        columnId: "name",
      });

      act(() => {
        fireCellEvent(result, "onClick", "1", "trick");
      });

      expect(getFocusedCell(result.current.table)).toEqual({
        rowId: "1",
        columnId: "trick",
      });
    });
  });

  describe("cell editing", () => {
    it("should start editing on double click", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
      });

      act(() => {
        fireCellEvent(result, "onDoubleClick", "0", "name");
      });

      expect(result.current.table.getEditingCell()).toEqual({
        rowId: "0",
        columnId: "name",
      });
    });

    it("should start editing via cell.startEditing", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        startEditing(result.current.table, "0", "name");
      });

      expect(result.current.table.getEditingCell()).toEqual({
        rowId: "0",
        columnId: "name",
      });
    });

    it("should stop editing via table.stopEditing", async () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        startEditing(result.current.table, "0", "name");
      });

      expect(result.current.table.getEditingCell()).not.toBeNull();

      await act(async () => {
        result.current.table.stopEditing();
      });

      expect(result.current.table.getEditingCell()).toBeNull();
    });

    it("should not start editing in readOnly mode", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            readOnly: true,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        startEditing(result.current.table, "0", "name");
      });

      expect(result.current.table.getEditingCell()).toBeNull();
      expect(result.current.table.getColumn("name")?.getCanEdit()).toBe(false);
    });

    it("should expose editing state through the table API", async () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        result.current.table.setEditingCell({ rowId: "1", columnId: "trick" });
        await Promise.resolve();
      });

      expect(result.current.table.getEditingCell()).toEqual({
        rowId: "1",
        columnId: "trick",
      });
      expect(result.current.table.getEditingCell()).toEqual({
        rowId: "1",
        columnId: "trick",
      });

      const cells = result.current.table.getRow("1").getAllCells();
      expect(
        cells.find((cell) => cell.column.id === "trick")?.getIsEditing(),
      ).toBe(true);
      expect(
        cells.find((cell) => cell.column.id === "name")?.getIsEditing(),
      ).toBe(false);

      await act(async () => {
        result.current.table.resetEditingCell();
        await Promise.resolve();
      });

      expect(result.current.table.getEditingCell()).toBeNull();
    });

    it("should support controlled editing state", async () => {
      const onEditingCellChange = vi.fn();

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            state: { editingCell: { rowId: "0", columnId: "name" } },
            onEditingCellChange,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.table.getEditingCell()).toEqual({
        rowId: "0",
        columnId: "name",
      });

      await act(async () => {
        result.current.table.stopEditing();
        await Promise.resolve();
      });

      expect(onEditingCellChange).toHaveBeenCalled();
      const updater = onEditingCellChange.mock.calls.at(-1)?.[0];
      expect(
        typeof updater === "function"
          ? updater({ rowId: "0", columnId: "name" })
          : updater,
      ).toBeNull();
      expect(result.current.table.getEditingCell()).toEqual({
        rowId: "0",
        columnId: "name",
      });
    });

    it("should follow controlled editing state across renders", () => {
      const { result, rerender } = renderHook(
        ({
          editingCell,
        }: {
          editingCell: { rowId: string; columnId: string } | null;
        }) =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            state: { editingCell },
            onEditingCellChange: vi.fn(),
          }),
        {
          wrapper: createWrapper(),
          initialProps: {
            // oxlint-disable-next-line typescript/no-unnecessary-type-assertion -- widens the prop so the rerender below can pass `null`
            editingCell: { rowId: "0", columnId: "name" } as {
              rowId: string;
              columnId: string;
            } | null,
          },
        },
      );

      expect(result.current.table.getEditingCell()).toEqual({
        rowId: "0",
        columnId: "name",
      });

      rerender({ editingCell: null });

      expect(result.current.table.getEditingCell()).toBeNull();
    });

    it("should call the latest onEditingCellChange", async () => {
      const firstOnChange = vi.fn();
      const secondOnChange = vi.fn();

      const { result, rerender } = renderHook(
        ({ onEditingCellChange }: { onEditingCellChange: () => void }) =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onEditingCellChange,
          }),
        {
          wrapper: createWrapper(),
          initialProps: { onEditingCellChange: firstOnChange },
        },
      );

      rerender({ onEditingCellChange: secondOnChange });

      await act(async () => {
        startEditing(result.current.table, "0", "name");
      });

      expect(firstOnChange).not.toHaveBeenCalled();
      expect(secondOnChange).toHaveBeenCalledTimes(1);
    });

    it("should update column edit permissions when cell editing changes", () => {
      const { result, rerender } = renderHook(
        ({ enableCellEditing }: { enableCellEditing: boolean }) =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            enableCellEditing,
          }),
        {
          wrapper: createWrapper(),
          initialProps: { enableCellEditing: false },
        },
      );

      expect(result.current.table.getColumn("name")?.getCanEdit()).toBe(false);

      rerender({ enableCellEditing: true });

      expect(result.current.table.getColumn("name")?.getCanEdit()).toBe(true);
    });

    it("should not edit when cell editing is disabled for the table", () => {
      const onDataChange = vi.fn();

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            enableCellEditing: false,
            onDataChange,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        startEditing(result.current.table, "0", "name");
        result.current.table
          .getRow("0")
          .getAllCellsByColumnId()
          .name?.setValue("Changed");
      });

      expect(result.current.table.getEditingCell()).toBeNull();
      expect(onDataChange).not.toHaveBeenCalled();
    });

    it("should not edit columns with cell editing disabled", () => {
      const onDataChange = vi.fn();
      const columns: ColumnDef<DataGridFeatures, TestData>[] = [
        { id: "name", accessorKey: "name", enableCellEditing: false },
        { id: "trick", accessorKey: "trick" },
      ];

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns,
            onDataChange,
          }),
        { wrapper: createWrapper() },
      );

      const row = result.current.table.getRow("0");
      const nameCell = row
        .getAllCells()
        .find((cell) => cell.column.id === "name");
      expect(nameCell?.getCanEdit()).toBe(false);
      expect(result.current.table.getColumn("trick")?.getCanEdit()).toBe(true);

      act(() => {
        startEditing(result.current.table, "0", "name");
      });

      expect(result.current.table.getEditingCell()).toBeNull();

      act(() => {
        const cells = result.current.table.getRow("0").getAllCellsByColumnId();
        cells.name?.setValue("Changed");
        cells.trick?.setValue("Ollie");
      });

      expect(onDataChange).toHaveBeenCalledTimes(1);
      const updatedRow = onDataChange.mock.calls[0]?.[0]?.[0];
      expect(updatedRow).toMatchObject({ name: "Tony Hawk", trick: "Ollie" });
    });

    it("should skip read-only columns when pasting", async () => {
      const onDataChange = vi.fn();
      const columns: ColumnDef<DataGridFeatures, TestData>[] = [
        { id: "name", accessorKey: "name", enableCellEditing: false },
        { id: "trick", accessorKey: "trick" },
      ];
      mockClipboard.readText.mockResolvedValue("New Name\tNew Trick");

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns,
            onDataChange,
          }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        fireCellEvent(result, "onClick", "0", "name");
      });

      await act(async () => {
        await result.current.table.pasteCells();
      });

      expect(onDataChange).toHaveBeenCalledTimes(1);
      const updatedRow = onDataChange.mock.calls[0]?.[0]?.[0];
      expect(updatedRow).toMatchObject({
        name: "Tony Hawk",
        trick: "New Trick",
      });
    });
  });

  describe("cell selection", () => {
    it("should select cells with getIsCellSelected", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.table.getIsCellSelected("0", "name")).toBe(false);

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
      });

      expect(result.current.table.getIsCellSelected("0", "name")).toBe(false);
    });

    it("should clear selection via onSelectionClear", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onMouseDown", "0", "name", {
          button: 0,
          preventDefault: vi.fn(),
        });
      });

      act(() => {
        result.current.table.clearSelection();
      });

      expect(result.current.table.getIsCellSelected("0", "name")).toBe(false);
    });

    it("should extend the selection from the focused cell with Shift+click", () => {
      const { result } = renderHook(
        () => useDataGrid({ data: testData, columns: testColumns }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
      });
      act(() => {
        fireCellEvent(result, "onClick", "1", "trick", {
          shiftKey: true,
          preventDefault: vi.fn(),
        });
      });

      expect(getFocusedCell(result.current.table)).toEqual({
        rowId: "0",
        columnId: "name",
      });
      expect(result.current.table.getSelectedRangeCellCount()).toBe(4);
      expect(result.current.table.getIsCellSelected("1", "trick")).toBe(true);
      expect(result.current.table.getIsCellSelected("2", "name")).toBe(false);
    });

    it("should include and exclude cells with Ctrl/Cmd+click", () => {
      const { result } = renderHook(
        () => useDataGrid({ data: testData, columns: testColumns }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
      });
      act(() => {
        fireCellEvent(result, "onClick", "2", "score", {
          metaKey: true,
          preventDefault: vi.fn(),
        });
      });

      expect(getFocusedCell(result.current.table)).toEqual({
        rowId: "2",
        columnId: "score",
      });
      expect(getSelectedCellKeys(result.current.table)).toEqual([
        getCellKey("0", "name"),
        getCellKey("2", "score"),
      ]);

      act(() => {
        fireCellEvent(result, "onClick", "0", "name", {
          ctrlKey: true,
          preventDefault: vi.fn(),
        });
      });

      expect(getSelectedCellKeys(result.current.table)).toEqual([
        getCellKey("2", "score"),
      ]);
    });

    it("should select a range by dragging and keep focus on the drag start", () => {
      const { result } = renderHook(
        () => useDataGrid({ data: testData, columns: testColumns }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onMouseDown", "0", "trick", {
          button: 0,
          preventDefault: vi.fn(),
        });
      });
      act(() => {
        fireCellEvent(result, "onMouseOver", "2", "score");
      });
      act(() => {
        fireCellEvent(result, "onMouseUp", "0", "name");
      });

      expect(getFocusedCell(result.current.table)).toEqual({
        rowId: "0",
        columnId: "trick",
      });
      expect(result.current.table.getSelectedRangeCellCount()).toBe(6);
      expect(result.current.table.getIsCellSelected("1", "name")).toBe(false);

      act(() => {
        fireCellEvent(result, "onMouseOver", "2", "name");
      });

      expect(result.current.table.getSelectedRangeCellCount()).toBe(6);
    });

    it("should keep the selection when data changes", () => {
      const { result, rerender } = renderHook(
        ({ data }) => useDataGrid({ data, columns: testColumns }),
        { wrapper: createWrapper(), initialProps: { data: testData } },
      );

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
      });
      act(() => {
        fireCellEvent(result, "onClick", "1", "trick", {
          shiftKey: true,
          preventDefault: vi.fn(),
        });
      });

      rerender({
        data: testData.map((row) =>
          row.id === "1" ? { ...row, name: "Bob Burnquist" } : row,
        ),
      });

      expect(result.current.table.getSelectedRangeCellCount()).toBe(4);
      expect(getFocusedCell(result.current.table)).toEqual({
        rowId: "0",
        columnId: "name",
      });
    });
  });

  describe("copy/cut/paste", () => {
    it("should copy checked rows with the shortcut while the select cell is focused", async () => {
      const tableRef: {
        current: ReturnType<typeof useDataGrid<TestData>>["table"] | null;
      } = { current: null };

      function CopyGrid() {
        const grid = useDataGrid({
          data: testData,
          columns: columnsWithSelect,
        });
        tableRef.current = grid.table;
        return (
          <div ref={grid.dataGridRef} data-slot="data-grid" tabIndex={0} />
        );
      }

      const view = render(<CopyGrid />);
      const grid = view.container.querySelector<HTMLElement>(
        '[data-slot="data-grid"]',
      );

      act(() => {
        tableRef.current?.setFocusedCell("0", "select");
        tableRef.current?.setRowSelection({ "0": true, "1": true });
      });
      await act(async () => {
        grid?.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "c",
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }),
        );
        await Promise.resolve();
      });

      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        "Tony Hawk\t900\nRodney Mullen\tKickflip",
      );
    });

    it("should quote copied values that contain tabs or newlines", async () => {
      const data: TestData[] = [
        { id: "0", name: 'Line one\nLine "two"', trick: "900", score: 1 },
      ];
      const { result } = renderHook(
        () => useDataGrid({ data, columns: testColumns }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.selectCellRange({
          anchorRowId: "0",
          anchorColumnId: "name",
          focusRowId: "0",
          focusColumnId: "trick",
        });
      });
      await act(async () => {
        await result.current.table.copySelectedCells();
      });

      const text = mockClipboard.writeText.mock.calls.at(-1)?.[0] as string;
      expect(text).toBe('"Line one\nLine ""two"""\t900');
      expect(parseTsv(text, 2)).toEqual([['Line one\nLine "two"', "900"]]);
    });

    it("should copy focused cell to clipboard", async () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
      });

      await act(async () => {
        await result.current.table.copySelectedCells();
      });

      expect(mockClipboard.writeText).toHaveBeenCalledWith("Tony Hawk");
    });

    it("should not cut in readOnly mode", async () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            readOnly: true,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
      });

      await act(async () => {
        await result.current.table.cutSelectedCells();
      });

      expect(mockClipboard.writeText).not.toHaveBeenCalled();
    });

    it("should not paste in readOnly mode", async () => {
      const onDataChange = vi.fn();
      mockClipboard.readText.mockResolvedValue("New Value");

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            readOnly: true,
            onDataChange,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
      });

      await act(async () => {
        await result.current.table.pasteCells();
      });

      expect(onDataChange).not.toHaveBeenCalled();
    });
  });

  describe("undo and redo", () => {
    function renderEditableGrid(
      options: Partial<UseDataGridProps<TestData>> = {},
      initialData: TestData[] = testData,
    ) {
      return renderHook(
        () => {
          const [data, setData] = useState(initialData);
          const grid = useDataGrid({
            data,
            onDataChange: setData,
            columns: testColumns,
            getRowId: (row) => row.id,
            ...options,
          });
          return { ...grid, data, setData };
        },
        { wrapper: createWrapper() },
      );
    }

    function getNames(result: { current: { data: TestData[] } }) {
      return result.current.data.map((row) => row.name);
    }

    function getShownNames(result: {
      current: { table: Table<DataGridFeatures, TestData> };
    }) {
      return result.current.table
        .getRowModel()
        .rows.map((row) => row.original.name);
    }

    it("undoes and redoes a cell edit", () => {
      const { result } = renderEditableGrid();

      act(() => {
        result.current.table
          .getRow("1")
          .getAllCellsByColumnId()
          .name?.setValue("Edited");
      });
      expect(getNames(result)[0]).toBe("Edited");
      expect(result.current.table.getCanUndo()).toBe(true);

      act(() => {
        expect(result.current.table.undo()).toBe(1);
      });
      expect(getNames(result)[0]).toBe("Tony Hawk");
      expect(result.current.table.getCanUndo()).toBe(false);
      expect(result.current.table.getCanRedo()).toBe(true);

      act(() => {
        result.current.table.redo();
      });
      expect(getNames(result)[0]).toBe("Edited");
    });

    it("reports why the data changed", async () => {
      const reasons: string[] = [];
      mockClipboard.readText.mockResolvedValue("Pasted");

      const { result } = renderHook(
        () => {
          const [data, setData] = useState(testData);
          return useDataGrid({
            data,
            columns: testColumns,
            getRowId: (row) => row.id,
            onDataChange: (nextData, details) => {
              reasons.push(details.reason);
              setData(nextData);
            },
          });
        },
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table
          .getRow("1")
          .getAllCellsByColumnId()
          .name?.setValue("Edited");
      });
      act(() => {
        result.current.table.undo();
      });
      act(() => {
        result.current.table.redo();
      });
      act(() => {
        result.current.table.updateCells({
          rowId: "2",
          columnId: "name",
          value: "Updated",
        });
      });
      act(() => {
        result.current.table.setFocusedCell("3", "name");
      });
      await act(async () => {
        await result.current.table.pasteCells();
      });
      act(() => {
        result.current.table.addRows([
          { id: "new", name: "", trick: "", score: 0 },
        ]);
      });
      act(() => {
        result.current.table.deleteRows(["new"]);
      });

      expect(reasons).toEqual([
        "edit",
        "undo",
        "redo",
        "update-cells",
        "paste",
        "add-rows",
        "delete-rows",
      ]);
    });

    it("merges edits made in quick succession into one step", () => {
      const { result } = renderEditableGrid();
      const getNameCell = () =>
        result.current.table.getRow("1").getAllCellsByColumnId().name;

      act(() => {
        getNameCell()?.setValue("T");
      });
      act(() => {
        getNameCell()?.setValue("To");
      });
      act(() => {
        result.current.table.undo();
      });

      expect(getNames(result)[0]).toBe("Tony Hawk");
      expect(result.current.table.getCanUndo()).toBe(false);
    });

    it("keeps quick edits to different cells as separate steps", () => {
      const { result } = renderEditableGrid();

      act(() => {
        result.current.table
          .getRow("1")
          .getAllCellsByColumnId()
          .name?.setValue("A");
      });
      act(() => {
        result.current.table
          .getRow("2")
          .getAllCellsByColumnId()
          .name?.setValue("B");
      });
      act(() => {
        result.current.table.undo();
      });

      expect(getNames(result)).toEqual(["A", "Rodney Mullen", "Nyjah Huston"]);
      expect(result.current.table.getCanUndo()).toBe(true);
    });

    it("restores deleted rows where they were", () => {
      const { result } = renderEditableGrid();

      act(() => {
        result.current.table.deleteRows(["1", "3"]);
      });
      expect(result.current.data.map((row) => row.id)).toEqual(["2"]);

      act(() => {
        result.current.table.undo();
      });
      expect(result.current.data).toEqual(testData);

      act(() => {
        result.current.table.redo();
      });
      expect(result.current.data.map((row) => row.id)).toEqual(["2"]);
    });

    it("undoes an edit that moved a row while sorted", () => {
      const { result } = renderEditableGrid();

      act(() => {
        result.current.table.setSorting([{ id: "score", desc: true }]);
      });
      act(() => {
        result.current.table.updateCells({
          rowId: "3",
          columnId: "score",
          value: 99,
        });
      });
      expect(getShownNames(result)).toEqual([
        "Nyjah Huston",
        "Rodney Mullen",
        "Tony Hawk",
      ]);

      act(() => {
        result.current.table.undo();
      });
      expect(getShownNames(result)).toEqual([
        "Rodney Mullen",
        "Tony Hawk",
        "Nyjah Huston",
      ]);

      act(() => {
        result.current.table.redo();
      });
      expect(getShownNames(result)[0]).toBe("Nyjah Huston");
    });

    it("restores a deleted row into the sorted order", () => {
      const { result } = renderEditableGrid();

      act(() => {
        result.current.table.setSorting([{ id: "score", desc: false }]);
      });
      act(() => {
        result.current.table.deleteRows(["2"]);
      });
      expect(getShownNames(result)).toEqual(["Nyjah Huston", "Tony Hawk"]);

      act(() => {
        result.current.table.undo();
      });
      expect(getShownNames(result)).toEqual([
        "Nyjah Huston",
        "Tony Hawk",
        "Rodney Mullen",
      ]);
      expect(getNames(result)).toEqual(testData.map((row) => row.name));
    });

    it("brings back a row that an edit hid behind a filter", () => {
      const { result } = renderEditableGrid();

      act(() => {
        result.current.table.setColumnFilters([{ id: "name", value: "h" }]);
      });
      expect(getShownNames(result)).toEqual(["Tony Hawk", "Nyjah Huston"]);

      act(() => {
        result.current.table.updateCells({
          rowId: "1",
          columnId: "name",
          value: "Bucky Lasek",
        });
      });
      expect(getShownNames(result)).toEqual(["Nyjah Huston"]);

      act(() => {
        result.current.table.undo();
      });
      expect(getShownNames(result)).toEqual(["Tony Hawk", "Nyjah Huston"]);
    });

    it("clears history when new data replaces rows without getRowId", async () => {
      const { result } = renderEditableGrid({ getRowId: undefined });

      act(() => {
        result.current.table.deleteRows(["0"]);
      });
      expect(result.current.table.getCanUndo()).toBe(true);

      act(() => {
        result.current.setData([testData[2] as TestData]);
      });
      expect(result.current.table.getCanUndo()).toBe(false);
      // Rendering the grid reads the rows, which resets the stored state just after
      await act(async () => {
        result.current.table.getRowModel();
      });
      expect(result.current.table.atoms.undoRedo.get()).toEqual({
        canUndo: false,
        canRedo: false,
      });
      act(() => {
        expect(result.current.table.undo()).toBe(0);
      });
      expect(getNames(result)).toEqual(["Nyjah Huston"]);
    });

    it("undoes without getRowId before the new data comes back", () => {
      const { result } = renderEditableGrid({ getRowId: undefined });

      act(() => {
        result.current.table.addRows([
          { id: "4", name: "Leticia Bufoni", trick: "Kickflip", score: 90 },
        ]);
        expect(result.current.table.getCanUndo()).toBe(true);
        expect(result.current.table.undo()).toBe(1);
      });
      expect(getNames(result)).toEqual(testData.map((row) => row.name));
    });

    it("keeps history across new data with getRowId, without duplicating rows", () => {
      const { result } = renderEditableGrid();

      act(() => {
        result.current.table.deleteRows(["2"]);
      });
      act(() => {
        result.current.table.updateCells({
          rowId: "3",
          columnId: "name",
          value: "Edited",
        });
      });

      // A refetch brings the deleted row back and drops the edited one
      act(() => {
        result.current.setData(testData.slice(0, 2).map((row) => ({ ...row })));
      });
      expect(result.current.table.getCanUndo()).toBe(true);

      act(() => {
        result.current.table.undo();
      });
      act(() => {
        result.current.table.undo();
      });
      expect(getNames(result)).toEqual(["Tony Hawk", "Rodney Mullen"]);
    });

    it("removes added rows on undo and puts them back on redo", () => {
      const { result } = renderEditableGrid();
      const newRow = { id: "4", name: "New", trick: "", score: 0 };

      act(() => {
        expect(
          result.current.table.addRows([newRow], { afterRowId: "1" }),
        ).toEqual(["4"]);
      });
      expect(result.current.data.map((row) => row.id)).toEqual([
        "1",
        "4",
        "2",
        "3",
      ]);

      act(() => {
        result.current.table.undo();
      });
      expect(result.current.data).toEqual(testData);

      act(() => {
        result.current.table.redo();
      });
      expect(result.current.data.map((row) => row.id)).toEqual([
        "1",
        "4",
        "2",
        "3",
      ]);
    });

    it("keeps updates without history and read-only grids out of it", () => {
      const { result } = renderEditableGrid();

      act(() => {
        result.current.table.updateCells(
          { rowId: "1", columnId: "name", value: "Remote" },
          { history: false },
        );
      });
      expect(getNames(result)[0]).toBe("Remote");
      expect(result.current.table.getCanUndo()).toBe(false);

      const readOnly = renderEditableGrid({ readOnly: true });
      act(() => {
        readOnly.result.current.table.updateCells({
          rowId: "1",
          columnId: "name",
          value: "Code",
        });
      });
      expect(readOnly.result.current.table.getCanUndo()).toBe(false);
    });

    it("undoes only the recorded cells of a row that also took batched values", () => {
      const { result } = renderEditableGrid();

      act(() => {
        result.current.table.updateCells(
          { rowId: "1", values: { trick: "Ollie", score: 50 } },
          { batch: true },
        );
        result.current.table.updateCells({
          rowId: "1",
          columnId: "name",
          value: "Edited",
        });
      });
      act(() => {
        result.current.table.undo();
      });

      const row = result.current.table.getCoreRowModel().rowsById["1"];
      expect(row?.original).toMatchObject({
        name: "Tony Hawk",
        trick: "Ollie",
        score: 50,
      });
    });

    it("keeps the rows that stay when rows are added or removed", () => {
      const { result } = renderEditableGrid();
      const before = result.current.table.getCoreRowModel().rowsById;
      const third = before["3"];

      act(() => {
        result.current.table.deleteRows(["1"]);
      });
      const after = result.current.table.getCoreRowModel().rowsById;
      expect(after["3"]).toBe(third);
      expect(after["3"]?.index).toBe(1);
      expect(after["1"]).toBeUndefined();

      act(() => {
        result.current.table.undo();
      });
      const restored = result.current.table.getCoreRowModel();
      expect(restored.rowsById["3"]).toBe(third);
      expect(restored.rows.map((row) => [row.id, row.index])).toEqual([
        ["1", 0],
        ["2", 1],
        ["3", 2],
      ]);
    });

    it("keeps the same order as a full sort when edits move a few rows", () => {
      let seed = 7;
      const random = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      const rows: TestData[] = Array.from({ length: 300 }, (_, index) => ({
        id: String(index),
        name: `Skater ${Math.floor(random() * 40)}`,
        trick: "Ollie",
        score: Math.floor(random() * 20),
      }));
      const sorting = [
        { id: "score", desc: true },
        { id: "name", desc: false },
      ];
      const { result } = renderEditableGrid(
        { initialState: { sorting } },
        rows,
      );

      for (let round = 0; round < 6; round++) {
        act(() => {
          result.current.table.updateCells(
            Array.from({ length: 4 }, () => {
              const rowId = String(Math.floor(random() * rows.length));
              return random() < 0.5
                ? { rowId, columnId: "score", value: Math.floor(random() * 20) }
                : {
                    rowId,
                    columnId: "name",
                    value: `Skater ${Math.floor(random() * 40)}`,
                  };
            }),
          );
        });
        const { result: fresh } = renderHook(
          () =>
            useDataGrid({
              data: result.current.data,
              columns: testColumns,
              getRowId: (row) => row.id,
              initialState: { sorting },
            }),
          { wrapper: createWrapper() },
        );
        expect(
          result.current.table.getRowModel().rows.map((row) => row.id),
        ).toEqual(fresh.current.table.getRowModel().rows.map((row) => row.id));
      }
    });

    it("adds rows at the end, or before or after a row", () => {
      const { result } = renderEditableGrid();
      const getIds = () => result.current.data.map((row) => row.id);
      const newRow = (id: string) => ({ id, name: id, trick: "", score: 0 });

      act(() => {
        result.current.table.addRows([newRow("end")]);
      });
      act(() => {
        result.current.table.addRows([newRow("a"), newRow("b")], {
          beforeRowId: "1",
        });
      });
      act(() => {
        result.current.table.addRows([newRow("c")], { afterRowId: "2" });
      });

      expect(getIds()).toEqual(["a", "b", "1", "2", "c", "3", "end"]);
    });

    it("keeps at most maxHistory steps", () => {
      const { result } = renderEditableGrid({ maxHistory: 1 });

      act(() => {
        result.current.table.deleteRows(["1"]);
      });
      act(() => {
        result.current.table.deleteRows(["2"]);
      });
      act(() => {
        result.current.table.undo();
      });

      expect(result.current.table.getCanUndo()).toBe(false);
      expect(result.current.data.map((row) => row.id)).toEqual(["2", "3"]);
    });

    describe("with sorting, filtering, and other state", () => {
      function editCell(
        result: { current: { table: Table<DataGridFeatures, TestData> } },
        rowId: string,
        columnId: keyof TestData,
        value: unknown,
      ) {
        act(() => {
          result.current.table.updateCells({ rowId, columnId, value });
        });
      }

      function undo(result: {
        current: { table: Table<DataGridFeatures, TestData> };
      }) {
        act(() => {
          result.current.table.undo();
        });
      }

      function redo(result: {
        current: { table: Table<DataGridFeatures, TestData> };
      }) {
        act(() => {
          result.current.table.redo();
        });
      }

      it("undoes an edit that both moved and hid a row", () => {
        const { result } = renderEditableGrid();

        act(() => {
          result.current.table.setSorting([{ id: "score", desc: true }]);
          result.current.table.setColumnFilters([{ id: "trick", value: "i" }]);
        });
        expect(getShownNames(result)).toEqual([
          "Rodney Mullen",
          "Nyjah Huston",
        ]);

        editCell(result, "2", "trick", "Manual");
        editCell(result, "3", "score", 99);
        expect(getShownNames(result)).toEqual(["Nyjah Huston"]);

        undo(result);
        expect(getShownNames(result)).toEqual(["Nyjah Huston"]);
        expect(result.current.data[2]?.score).toBe(92);

        undo(result);
        expect(getShownNames(result)).toEqual([
          "Rodney Mullen",
          "Nyjah Huston",
        ]);
        expect(result.current.data).toEqual(testData);

        redo(result);
        redo(result);
        expect(getShownNames(result)).toEqual(["Nyjah Huston"]);
        expect(result.current.data[1]?.trick).toBe("Manual");
        expect(result.current.data[2]?.score).toBe(99);
      });

      it("keeps history when sorting or filtering changes after an edit", () => {
        const { result } = renderEditableGrid();

        editCell(result, "1", "name", "Bucky Lasek");
        act(() => {
          result.current.table.setSorting([{ id: "name", desc: false }]);
        });
        act(() => {
          result.current.table.setColumnFilters([{ id: "name", value: "a" }]);
        });
        expect(result.current.table.getCanUndo()).toBe(true);

        undo(result);
        expect(getNames(result)).toEqual(testData.map((row) => row.name));
        expect(getShownNames(result)).toEqual(["Nyjah Huston", "Tony Hawk"]);

        redo(result);
        expect(getShownNames(result)).toEqual(["Bucky Lasek", "Nyjah Huston"]);
      });

      it("doesn't record sorting or filtering as steps", () => {
        const { result } = renderEditableGrid();

        act(() => {
          result.current.table.setSorting([{ id: "score", desc: true }]);
        });
        act(() => {
          result.current.table.setColumnFilters([{ id: "name", value: "o" }]);
        });

        expect(result.current.table.getCanUndo()).toBe(false);
      });

      it("undoes steps made under different sorts and filters in order", () => {
        const { result } = renderEditableGrid();

        editCell(result, "1", "score", 50);
        act(() => {
          result.current.table.setSorting([{ id: "score", desc: false }]);
        });
        editCell(result, "2", "score", 10);
        act(() => {
          result.current.table.setColumnFilters([{ id: "name", value: "y" }]);
        });
        editCell(result, "3", "name", "Bob Burnquist");
        expect(getShownNames(result)).toEqual(["Rodney Mullen", "Tony Hawk"]);

        undo(result);
        expect(getShownNames(result)).toEqual([
          "Rodney Mullen",
          "Tony Hawk",
          "Nyjah Huston",
        ]);

        undo(result);
        expect(getShownNames(result)).toEqual([
          "Tony Hawk",
          "Nyjah Huston",
          "Rodney Mullen",
        ]);

        undo(result);
        expect(result.current.data).toEqual(testData);
        expect(result.current.table.getCanUndo()).toBe(false);

        redo(result);
        redo(result);
        redo(result);
        expect(result.current.data.map((row) => row.score)).toEqual([
          50, 10, 92,
        ]);
        expect(result.current.data[2]?.name).toBe("Bob Burnquist");
      });

      it("undoes an edit after the sort and filter are cleared", () => {
        const { result } = renderEditableGrid();

        act(() => {
          result.current.table.setSorting([{ id: "score", desc: true }]);
          result.current.table.setColumnFilters([{ id: "name", value: "n" }]);
        });
        editCell(result, "3", "score", 100);
        act(() => {
          result.current.table.resetSorting();
          result.current.table.resetColumnFilters();
        });

        undo(result);
        expect(result.current.data).toEqual(testData);
        expect(getShownNames(result)).toEqual(testData.map((row) => row.name));
      });

      it("restores deleted rows behind a sort and filter", () => {
        const { result } = renderEditableGrid();

        act(() => {
          result.current.table.setSorting([{ id: "score", desc: false }]);
          result.current.table.setColumnFilters([{ id: "name", value: "a" }]);
        });
        expect(getShownNames(result)).toEqual(["Nyjah Huston", "Tony Hawk"]);

        act(() => {
          result.current.table.deleteRows(["3"]);
        });
        expect(getShownNames(result)).toEqual(["Tony Hawk"]);

        undo(result);
        expect(result.current.data).toEqual(testData);
        expect(getShownNames(result)).toEqual(["Nyjah Huston", "Tony Hawk"]);

        redo(result);
        expect(result.current.data.map((row) => row.id)).toEqual(["1", "2"]);
      });

      it("removes and puts back a row added behind a sort and filter", () => {
        const { result } = renderEditableGrid();

        act(() => {
          result.current.table.setSorting([{ id: "score", desc: true }]);
          result.current.table.setColumnFilters([{ id: "name", value: "a" }]);
        });
        act(() => {
          result.current.table.addRows([
            { id: "4", name: "Leticia Bufoni", trick: "Boardslide", score: 97 },
          ]);
        });
        expect(getShownNames(result)).toEqual([
          "Leticia Bufoni",
          "Tony Hawk",
          "Nyjah Huston",
        ]);

        undo(result);
        expect(result.current.data).toEqual(testData);
        expect(getShownNames(result)).toEqual(["Tony Hawk", "Nyjah Huston"]);

        redo(result);
        expect(getShownNames(result)[0]).toBe("Leticia Bufoni");
      });

      it("undoes a paste that ran down the sorted rows", async () => {
        mockClipboard.readText.mockResolvedValue("First\nSecond");
        const { result } = renderEditableGrid();

        act(() => {
          result.current.table.setSorting([{ id: "score", desc: true }]);
        });
        act(() => {
          result.current.table.setFocusedCell("2", "name");
        });
        await act(async () => {
          await result.current.table.pasteCells();
        });
        expect(getShownNames(result)).toEqual([
          "First",
          "Second",
          "Nyjah Huston",
        ]);
        expect(result.current.data[0]?.name).toBe("Second");
        expect(result.current.data[1]?.name).toBe("First");

        undo(result);
        expect(result.current.data).toEqual(testData);

        redo(result);
        expect(getShownNames(result)).toEqual([
          "First",
          "Second",
          "Nyjah Huston",
        ]);
      });

      it("keeps history across view changes", () => {
        const { result } = renderEditableGrid();

        editCell(result, "1", "trick", "Ollie");
        act(() => {
          result.current.table.setColumnVisibility({ trick: false });
        });
        act(() => {
          result.current.table.setColumnOrder(["score", "name", "trick"]);
        });
        act(() => {
          result.current.table.setColumnPinning({ start: ["name"], end: [] });
        });
        act(() => {
          result.current.table.setRowHeight("tall");
        });
        act(() => {
          result.current.table.setRowSelection({ "2": true });
        });
        act(() => {
          result.current.table.setFocusedCell("3", "score");
        });
        expect(result.current.table.getCanUndo()).toBe(true);

        undo(result);
        expect(result.current.data).toEqual(testData);

        redo(result);
        expect(result.current.data[0]?.trick).toBe("Ollie");
      });

      it("drops redo once a new edit lands under a sort", () => {
        const { result } = renderEditableGrid();

        act(() => {
          result.current.table.setSorting([{ id: "score", desc: true }]);
        });
        editCell(result, "1", "score", 10);
        undo(result);
        editCell(result, "2", "score", 20);

        expect(result.current.table.getCanRedo()).toBe(false);
        expect(getShownNames(result)).toEqual([
          "Tony Hawk",
          "Nyjah Huston",
          "Rodney Mullen",
        ]);
      });
    });
  });

  describe("data updates", () => {
    it("should call onDataChange when updating data", () => {
      const onDataChange = vi.fn();

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onDataChange,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.updateCells({
          rowId: "0",
          columnId: "name",
          value: "Updated Name",
        });
      });

      expect(onDataChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: "Updated Name" }),
        ]),
        {
          reason: "update-cells",
          changes: [
            {
              rowId: "0",
              columnId: "name",
              previousValue: "Tony Hawk",
              newValue: "Updated Name",
            },
          ],
          addedRows: [],
          removedRows: [],
        },
      );
    });

    it("should handle batch updates", () => {
      const onDataChange = vi.fn();

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onDataChange,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.updateCells([
          { rowId: "0", columnId: "name", value: "Updated Name 1" },
          { rowId: "1", columnId: "name", value: "Updated Name 2" },
        ]);
      });

      expect(onDataChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: "Updated Name 1" }),
          expect.objectContaining({ name: "Updated Name 2" }),
        ]),
        expect.objectContaining({
          changes: expect.arrayContaining([
            expect.objectContaining({ newValue: "Updated Name 1" }),
            expect.objectContaining({ newValue: "Updated Name 2" }),
          ]),
        }),
      );
    });

    it("should not edit data in readOnly mode", () => {
      const onDataChange = vi.fn();

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onDataChange,
            readOnly: true,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table
          .getRow("0")
          .getAllCellsByColumnId()
          .name?.setValue("Updated Name");
        result.current.table.clearCells([{ rowId: "0", columnId: "name" }]);
      });

      expect(onDataChange).not.toHaveBeenCalled();
    });

    it("updates data from code in readOnly mode", () => {
      const onDataChange = vi.fn();

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onDataChange,
            readOnly: true,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.updateCells({
          rowId: "0",
          columnId: "name",
          value: "Updated Name",
        });
      });

      expect(onDataChange).toHaveBeenCalledTimes(1);
      expect(onDataChange.mock.calls[0]?.[0]?.[0]).toMatchObject({
        name: "Updated Name",
      });
    });

    it("shows updates right away and notifies only the changed cells", () => {
      const { result } = renderHook(
        () => useDataGrid({ data: testData, columns: testColumns }),
        { wrapper: createWrapper() },
      );
      const { table } = result.current;
      const onNameChange = vi.fn();
      const onTrickChange = vi.fn();
      table.subscribeCell("0", "name", onNameChange);
      table.subscribeCell("0", "trick", onTrickChange);

      act(() => {
        table.updateCells({ rowId: "0", columnId: "name", value: "Patched" });
      });

      expect(onNameChange).toHaveBeenCalledTimes(1);
      expect(onTrickChange).not.toHaveBeenCalled();
      expect(table.getRow("0").getValue("name")).toBe("Patched");
      expect(testData[0]?.name).not.toBe("Patched");
    });

    it("notifies computed columns and custom cells when another field changes", () => {
      const columns: ColumnDef<DataGridFeatures, TestData>[] = [
        { id: "name", accessorKey: "name" },
        { id: "trick", accessorKey: "trick", cell: ({ row }) => row.id },
        { id: "score", accessorKey: "score" },
        {
          id: "label",
          accessorFn: (row) => `${row.name} (${row.score})`,
        },
      ];
      const { result } = renderHook(
        () => useDataGrid({ data: testData, columns }),
        { wrapper: createWrapper() },
      );
      const { table } = result.current;
      const onNameChange = vi.fn();
      const onTrickChange = vi.fn();
      const onLabelChange = vi.fn();
      table.subscribeCell("0", "name", onNameChange);
      table.subscribeCell("0", "trick", onTrickChange);
      table.subscribeCell("0", "label", onLabelChange);

      act(() => {
        table.updateCells({ rowId: "0", columnId: "score", value: 50 });
      });

      expect(onNameChange).not.toHaveBeenCalled();
      expect(onTrickChange).toHaveBeenCalledTimes(1);
      expect(onLabelChange).toHaveBeenCalledTimes(1);
      expect(table.getRow("0").getValue("label")).toBe("Tony Hawk (50)");
    });

    it("updates a computed cell that mounts after its row's batched values", () => {
      const columns: ColumnDef<DataGridFeatures, TestData>[] = [
        { id: "name", accessorKey: "name" },
        { id: "score", accessorKey: "score" },
        {
          id: "label",
          accessorFn: (row) => `${row.name} (${row.score})`,
        },
      ];
      const { result } = renderHook(
        () => useDataGrid({ data: testData, columns }),
        { wrapper: createWrapper() },
      );
      const { table } = result.current;

      act(() => {
        table.updateCells(
          { rowId: "1", columnId: "score", value: 60 },
          { batch: true },
        );
      });
      table.subscribeCell("1", "name", vi.fn());
      const onLabelChange = vi.fn();
      table.subscribeCell("1", "label", onLabelChange);

      expect(onLabelChange).toHaveBeenCalledTimes(1);
      expect(table.getRow("1").getValue("label")).toBe("Rodney Mullen (60)");
    });

    it("reports batched updates once per batch delay", () => {
      vi.useFakeTimers();
      const onDataChange = vi.fn();
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onDataChange,
            batchUpdateDelay: 200,
          }),
        { wrapper: createWrapper() },
      );
      const { table } = result.current;
      const onNameChange = vi.fn();
      table.subscribeCell("0", "name", onNameChange);

      act(() => {
        table.updateCells(
          { rowId: "0", columnId: "name", value: "One" },
          { batch: true },
        );
        table.updateCells(
          { rowId: "1", columnId: "name", value: "Two" },
          { batch: true },
        );
      });

      // This suite runs animation frames immediately, so cells hear right away
      expect(table.getRow("0").getValue("name")).toBe("One");
      expect(onNameChange).toHaveBeenCalledTimes(1);
      expect(onDataChange).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(onDataChange).toHaveBeenCalledTimes(1);
      const nextData = onDataChange.mock.calls[0]?.[0];
      expect(nextData?.[0]).toMatchObject({ name: "One" });
      expect(nextData?.[1]).toMatchObject({ name: "Two" });
      expect(nextData?.[2]).toBe(testData[2]);
    });

    it("applies row updates and notifies the cells they change", () => {
      const onDataChange = vi.fn();
      const { result } = renderHook(
        () =>
          useDataGrid({ data: testData, columns: testColumns, onDataChange }),
        { wrapper: createWrapper() },
      );
      const { table } = result.current;
      const onNameChange = vi.fn();
      const onTrickChange = vi.fn();
      table.subscribeCell("0", "name", onNameChange);
      table.subscribeCell("0", "trick", onTrickChange);

      act(() => {
        table.updateCells({
          rowId: "0",
          values: { name: "Patched", trick: testData[0]?.trick, score: 1 },
        });
      });

      expect(onNameChange).toHaveBeenCalledTimes(1);
      expect(onTrickChange).not.toHaveBeenCalled();
      expect(onDataChange).toHaveBeenCalledTimes(1);
      expect(onDataChange.mock.calls[0]?.[0]?.[0]).toMatchObject({
        name: "Patched",
        trick: testData[0]?.trick,
        score: 1,
      });
    });

    it("skips values that don't change", () => {
      const onDataChange = vi.fn();
      const { result } = renderHook(
        () =>
          useDataGrid({ data: testData, columns: testColumns, onDataChange }),
        { wrapper: createWrapper() },
      );
      const onNameChange = vi.fn();
      result.current.table.subscribeCell("0", "name", onNameChange);

      act(() => {
        result.current.table.updateCells({
          rowId: "0",
          columnId: "name",
          value: testData[0]?.name,
        });
      });

      expect(onNameChange).not.toHaveBeenCalled();
      expect(onDataChange).not.toHaveBeenCalled();
    });

    it("keeps updates itself without onDataChange, so sorting follows them", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            initialState: { sorting: [{ id: "score", desc: true }] },
          }),
        { wrapper: createWrapper() },
      );
      expect(result.current.table.getRowModel().rows[0]?.id).toBe("1");

      act(() => {
        result.current.table.updateCells({
          rowId: "2",
          columnId: "score",
          value: 100,
        });
      });

      expect(result.current.table.getRowModel().rows[0]?.id).toBe("2");
      expect(testData[2]?.score).toBe(92);
    });

    it("sorts by updated values when onDataChange feeds them back", () => {
      const { result } = renderHook(
        () => {
          const [data, setData] = useState(testData);
          return useDataGrid({
            data,
            onDataChange: setData,
            columns: testColumns,
            initialState: { sorting: [{ id: "score", desc: true }] },
          });
        },
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.updateCells({
          rowId: "2",
          columnId: "score",
          value: 100,
        });
      });

      expect(
        result.current.table.getRowModel().rows.map((row) => row.id),
      ).toEqual(["2", "1", "0"]);
    });

    it("starts over from a new data prop without onDataChange", () => {
      const { result, rerender } = renderHook(
        ({ data }) => useDataGrid({ data, columns: testColumns }),
        { wrapper: createWrapper(), initialProps: { data: testData } },
      );

      act(() => {
        result.current.table.updateCells({
          rowId: "0",
          columnId: "name",
          value: "Patched",
        });
      });
      expect(result.current.table.getRow("0").getValue("name")).toBe("Patched");

      const nextData = testData.map((row) => ({ ...row }));
      rerender({ data: nextData });
      expect(result.current.table.getRow("0").getValue("name")).toBe(
        testData[0]?.name,
      );
    });

    it("holds batched values for rows out of view until they come into view", () => {
      vi.useFakeTimers();
      const frames: FrameRequestCallback[] = [];
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
        frames.push(cb);
        return frames.length;
      });
      const onDataChange = vi.fn();
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onDataChange,
            batchUpdateDelay: 200,
          }),
        { wrapper: createWrapper() },
      );
      const { table } = result.current;
      table.subscribeCell("0", "name", vi.fn());

      act(() => {
        table.updateCells(
          [
            { rowId: "0", values: { name: "Shown" } },
            { rowId: "1", values: { name: "Hidden" } },
            { rowId: "2", values: { name: "Later" } },
          ],
          { batch: true },
        );
        frames[0]?.(0);
      });

      expect(table.getRow("0").getValue("name")).toBe("Shown");
      expect(table.getRow("1").getValue("name")).toBe(testData[1]?.name);

      table.subscribeCell("1", "name", vi.fn());
      expect(table.getRow("1").getValue("name")).toBe("Hidden");

      act(() => {
        vi.advanceTimersByTime(200);
      });
      const nextData = onDataChange.mock.calls[0]?.[0];
      expect(nextData?.map((row: TestData) => row.name)).toEqual([
        "Shown",
        "Hidden",
        "Later",
      ]);
    });

    it("doesn't report rows whose values come back the same", () => {
      const onDataChange = vi.fn();
      const { result } = renderHook(
        () =>
          useDataGrid({ data: testData, columns: testColumns, onDataChange }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.updateCells({
          rowId: "0",
          values: { name: testData[0]?.name, score: testData[0]?.score },
        });
      });

      expect(onDataChange).not.toHaveBeenCalled();
    });

    it("tells each changed cell of a row coming into view, as it subscribes", () => {
      const { result } = renderHook(
        () => useDataGrid({ data: testData, columns: testColumns }),
        { wrapper: createWrapper() },
      );
      const { table } = result.current;

      act(() => {
        table.updateCells(
          { rowId: "1", values: { name: "Hidden", trick: "Ollie" } },
          { batch: true },
        );
      });

      const onName = vi.fn();
      const onTrick = vi.fn();
      const onScore = vi.fn();
      table.subscribeCell("1", "name", onName);
      table.subscribeCell("1", "trick", onTrick);
      table.subscribeCell("1", "score", onScore);

      expect(onName).toHaveBeenCalledTimes(1);
      expect(onTrick).toHaveBeenCalledTimes(1);
      expect(onScore).not.toHaveBeenCalled();
      expect(table.getRow("1").getValue("trick")).toBe("Ollie");
    });

    it("applies batched updates once a frame, keeping each cell's latest", () => {
      const frames: FrameRequestCallback[] = [];
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
        frames.push(cb);
        return frames.length;
      });
      const { result } = renderHook(
        () => useDataGrid({ data: testData, columns: testColumns }),
        { wrapper: createWrapper() },
      );
      const { table } = result.current;
      const onNameChange = vi.fn();
      table.subscribeCell("0", "name", onNameChange);

      act(() => {
        table.updateCells(
          { rowId: "0", columnId: "name", value: "First" },
          { batch: true },
        );
        table.updateCells(
          { rowId: "0", values: { name: "Second" } },
          { batch: true },
        );
      });

      expect(frames).toHaveLength(1);
      expect(table.getRow("0").getValue("name")).toBe(testData[0]?.name);
      expect(onNameChange).not.toHaveBeenCalled();

      act(() => {
        frames[0]?.(0);
      });

      expect(table.getRow("0").getValue("name")).toBe("Second");
      expect(onNameChange).toHaveBeenCalledTimes(1);
    });

    it("should update data correctly when filtering is applied", () => {
      const onDataChange = vi.fn();

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onDataChange,
            initialState: {
              columnFilters: [{ id: "name", value: "Hawk" }],
            },
          }),
        { wrapper: createWrapper() },
      );

      const filteredRows = result.current.table.getRowModel().rows;
      expect(filteredRows.length).toBe(1);
      expect(filteredRows[0]?.original.name).toBe("Tony Hawk");

      act(() => {
        result.current.table.updateCells({
          rowId: filteredRows[0]?.id ?? "",
          columnId: "score",
          value: 100,
        });
      });

      // onDataChange should be called with ALL rows (not just filtered)
      expect(onDataChange).toHaveBeenCalledTimes(1);
      const updatedData = onDataChange.mock.calls[0]?.[0] as TestData[];

      expect(updatedData).toHaveLength(3);

      expect(updatedData[0]).toMatchObject({
        id: "1",
        name: "Tony Hawk",
        score: 100,
      });

      expect(updatedData[1]).toMatchObject({
        id: "2",
        name: "Rodney Mullen",
        score: 98,
      });
      expect(updatedData[2]).toMatchObject({
        id: "3",
        name: "Nyjah Huston",
        score: 92,
      });
    });

    it("should update multiple filtered rows correctly", () => {
      const onDataChange = vi.fn();

      const extendedData: TestData[] = [
        ...testData,
        { id: "4", name: "Bob Burnquist", trick: "Loop", score: 90 },
        { id: "5", name: "Bam Margera", trick: "Tailslide", score: 85 },
      ];

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: extendedData,
            columns: testColumns,
            onDataChange,
            initialState: {
              columnFilters: [{ id: "name", value: "B" }],
            },
          }),
        { wrapper: createWrapper() },
      );

      const filteredRows = result.current.table.getRowModel().rows;
      expect(filteredRows.length).toBe(2);

      act(() => {
        result.current.table.updateCells({
          rowId: filteredRows[0]?.id ?? "",
          columnId: "score",
          value: 95,
        });
      });

      expect(onDataChange).toHaveBeenCalledTimes(1);
      const updatedData = onDataChange.mock.calls[0]?.[0] as TestData[];

      expect(updatedData).toHaveLength(5);

      expect(updatedData[3]).toMatchObject({
        id: "4",
        name: "Bob Burnquist",
        score: 95,
      });

      expect(updatedData[0]?.score).toBe(95);
      expect(updatedData[1]?.score).toBe(98);
      expect(updatedData[2]?.score).toBe(92);
      expect(updatedData[4]?.score).toBe(85);
    });
  });

  describe("row operations", () => {
    it("should call createRow when adding a row", async () => {
      const createRow = vi.fn(async (): Promise<TestData | null> => ({
        id: "4",
        name: "New",
        trick: "",
        score: 0,
      }));

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            createRow,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.onRowAdd).toBeDefined();

      await act(async () => {
        await result.current.onRowAdd?.();
      });

      expect(createRow).toHaveBeenCalled();
    });

    it("should not provide onRowAdd in readOnly mode", () => {
      const createRow = vi.fn(async (): Promise<TestData | null> => ({
        id: "4",
        name: "New",
        trick: "",
        score: 0,
      }));

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            createRow,
            readOnly: true,
          }),
        { wrapper: createWrapper() },
      );

      // The returned onRowAdd checks readOnly internally
      expect(result.current.onRowAdd).toBeDefined();
    });

    it("should delete rows and focus the row that takes their place", () => {
      const onDataChange = vi.fn();

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onDataChange,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onClick", "0", "trick");
      });

      act(() => {
        result.current.table.deleteRows(["0"]);
      });

      expect(onDataChange).toHaveBeenCalledWith([testData[1], testData[2]], {
        reason: "delete-rows",
        changes: [],
        addedRows: [],
        removedRows: [testData[0]],
      });
      expect(getFocusedCell(result.current.table)).toEqual({
        rowId: "1",
        columnId: "trick",
      });
    });

    it("deletes rows from code even when read-only", () => {
      const onDataChange = vi.fn();

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onDataChange,
            readOnly: true,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.deleteRows(["0"]);
      });

      expect(onDataChange.mock.calls[0]?.[1]?.removedRows).toEqual([
        testData[0],
      ]);
    });

    it("should focus a data cell in the next row when deleting from the select column", async () => {
      const columns: ColumnDef<DataGridFeatures, TestData>[] = [
        { id: "select", enableCellSelection: false, size: 40 },
        ...testColumns,
      ];

      const { result, rerender } = renderHook(
        ({ data }) =>
          useDataGrid({
            data,
            columns,
            getRowId: (row) => row.id,
            onDataChange: (nextData) => {
              rerender({ data: nextData });
            },
          }),
        { wrapper: createWrapper(), initialProps: { data: testData } },
      );

      act(() => {
        result.current.table.setFocusedCell("2", "select");
      });
      act(() => {
        result.current.table.deleteRows(["2"]);
      });

      const focusedCell = result.current.table.getFocusedCell();
      expect(focusedCell?.row.id).toBe("3");
      expect(focusedCell?.column.id).toBe("name");
    });
  });

  describe("search functionality", () => {
    it("should start with search closed when enableSearch is true", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            enableSearch: true,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.table.options.enableSearch).toBe(true);
      expect(result.current.table.getSearchOpen()).toBe(false);
      expect(result.current.table.getSearchQuery()).toBe("");
      expect(result.current.table.getSearchMatches()).toEqual([]);
    });

    it("should keep search disabled when enableSearch is false", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            enableSearch: false,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.table.options.enableSearch).toBe(false);
    });

    it("should open search panel", async () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            enableSearch: true,
          }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        result.current.table.openSearch();
        // Lets the microtask queue flush
        await Promise.resolve();
      });

      expect(result.current.table.getSearchOpen()).toBe(true);
    });

    it("should find matches when searching", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            enableSearch: true,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.setSearchQuery("Tony");
      });

      expect(result.current.table.getSearchMatches().length).toBeGreaterThan(0);
    });

    it("should clear search results when query is empty", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            enableSearch: true,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.setSearchQuery("Tony");
      });

      expect(result.current.table.getSearchMatches().length).toBeGreaterThan(0);

      act(() => {
        result.current.table.setSearchQuery("");
      });

      expect(result.current.table.getSearchMatches()).toEqual([]);
    });
  });

  describe("search feature", () => {
    function getCell(
      table: ReturnType<typeof useDataGrid<TestData>>["table"],
      rowId: string,
      columnId: string,
    ) {
      return table.getCoreRowModel().rowsById[rowId]?.getAllCellsByColumnId()[
        columnId
      ];
    }

    it("should focus the first match and flag matching cells", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            enableSearch: true,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.openSearch();
        result.current.table.setSearchQuery("rodney");
      });

      expect(result.current.table.getSearchMatches()).toEqual([
        { rowId: "1", columnId: "name" },
      ]);
      expect(getFocusedCell(result.current.table)).toEqual({
        rowId: "1",
        columnId: "name",
      });

      const table = result.current.table;
      expect(getCell(table, "1", "name")?.getIsSearchMatch()).toBe(true);
      expect(getCell(table, "1", "name")?.getIsActiveSearchMatch()).toBe(true);
      expect(getCell(table, "0", "name")?.getIsSearchMatch()).toBe(false);
    });

    it("should recompute matches when data changes", () => {
      const { result, rerender } = renderHook(
        ({ data }) =>
          useDataGrid({
            data,
            columns: testColumns,
            enableSearch: true,
          }),
        { wrapper: createWrapper(), initialProps: { data: testData } },
      );

      act(() => {
        result.current.table.setSearchQuery("ollie");
      });
      expect(result.current.table.getSearchMatches()).toEqual([]);

      rerender({
        data: [...testData, { id: "4", name: "Ollie", trick: "", score: 0 }],
      });
      expect(result.current.table.getSearchMatches()).toEqual([
        { rowId: "3", columnId: "name" },
      ]);
    });

    it("should narrow matches as the query grows and widen them when it shrinks", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            enableSearch: true,
          }),
        { wrapper: createWrapper() },
      );

      function search(query: string) {
        act(() => {
          result.current.table.setSearchQuery(query);
        });
        return result.current.table.getSearchMatches();
      }

      // Every row and column checked directly, without any earlier query to narrow from
      function getExpected(query: string) {
        return testData.flatMap((row, index) =>
          (["name", "trick", "score"] as const)
            .filter((columnId) =>
              String(row[columnId]).toLowerCase().includes(query),
            )
            .map((columnId) => ({ rowId: `${index}`, columnId })),
        );
      }

      for (const query of ["n", "ny", "nyj", "ki", "k", "9", "92", "2"]) {
        expect(search(query)).toEqual(getExpected(query));
      }

      // Rows matching the same columns share one set, so unchanged rows keep the same reference
      search("o");
      const matchesByRowId = result.current.table.getSearchMatchesByRowId();
      expect(matchesByRowId.get("0")).toEqual(new Set(["name"]));
      expect(matchesByRowId.get("0")).toBe(matchesByRowId.get("1"));
      search("on");
      expect(result.current.table.getSearchMatchesByRowId().get("0")).toBe(
        matchesByRowId.get("0"),
      );
    });

    it("should group matches by row past 31 columns", () => {
      const columnIds = Array.from({ length: 40 }, (_, index) => `c${index}`);
      const data = [
        Object.fromEntries([
          ["id", "0"],
          ...columnIds.map((id, index) => [
            id,
            index === 11 || index === 21 ? "match" : "",
          ]),
        ]),
      ] as Record<string, string>[];
      const columns: ColumnDef<DataGridFeatures, Record<string, string>>[] =
        columnIds.map((id) => ({ id, accessorKey: id }));

      const { result } = renderHook(
        () => useDataGrid({ data, columns, enableSearch: true }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.setSearchQuery("match");
      });
      expect(result.current.table.getSearchMatchesByRowId().get("0")).toEqual(
        new Set(["c11", "c21"]),
      );
    });

    it("should recompute matches when a row is edited or a column is hidden", () => {
      const { result, rerender } = renderHook(
        ({ data }) =>
          useDataGrid({
            data,
            columns: testColumns,
            enableSearch: true,
          }),
        { wrapper: createWrapper(), initialProps: { data: testData } },
      );

      act(() => {
        result.current.table.setSearchQuery("rodney");
      });
      expect(result.current.table.getSearchMatches()).toEqual([
        { rowId: "1", columnId: "name" },
      ]);

      rerender({
        data: testData.map((row) =>
          row.id === "1" ? { ...row, trick: "Rodney flip" } : row,
        ),
      });
      expect(result.current.table.getSearchMatches()).toEqual([
        { rowId: "0", columnId: "trick" },
        { rowId: "1", columnId: "name" },
      ]);

      act(() => {
        result.current.table.setColumnVisibility({ name: false });
      });
      expect(result.current.table.getSearchMatches()).toEqual([
        { rowId: "0", columnId: "trick" },
      ]);
    });

    it("should skip utility columns", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: [
              { id: "select", accessorFn: () => "Tony" },
              ...testColumns,
            ],
            enableSearch: true,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.setSearchQuery("tony");
      });

      expect(result.current.table.getSearchMatches()).toEqual([
        { rowId: "0", columnId: "name" },
      ]);
    });

    it("should not open without enableSearch", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.openSearch();
      });

      expect(result.current.table.getSearchOpen()).toBe(false);
    });

    it("should keep focus on the active match after closing", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            enableSearch: true,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.openSearch();
        result.current.table.setSearchQuery("kickflip");
      });
      act(() => {
        result.current.table.closeSearch();
      });

      expect(result.current.table.getSearchQuery()).toBe("");
      expect(result.current.table.getSearchMatches()).toEqual([]);
      expect(getFocusedCell(result.current.table)).toEqual({
        rowId: "1",
        columnId: "trick",
      });
    });
  });

  describe("context menu", () => {
    it("should open context menu on cell right-click", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      const mockEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientX: 100,
        clientY: 100,
      } as unknown as React.MouseEvent;

      act(() => {
        fireCellEvent(result, "onContextMenu", "0", "name", mockEvent);
      });

      expect(result.current.table.getContextMenu().open).toBe(true);
      expect(result.current.table.getContextMenu().x).toBe(100);
      expect(result.current.table.getContextMenu().y).toBe(100);
    });

    it("should close context menu via onContextMenuOpenChange", async () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      const mockEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientX: 100,
        clientY: 100,
      } as unknown as React.MouseEvent;

      await act(async () => {
        fireCellEvent(result, "onContextMenu", "0", "name", mockEvent);
        await Promise.resolve();
      });

      expect(result.current.table.getContextMenu().open).toBe(true);

      await act(async () => {
        result.current.table.closeContextMenu();
        await Promise.resolve();
      });

      expect(result.current.table.getContextMenu().open).toBe(false);
    });
  });

  describe("virtualization", () => {
    it("should provide virtualizer options for the grid body", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.rowVirtualizerOptions).toEqual({ overscan: 6 });
    });
  });

  describe("column size vars", () => {
    it("should compute column size CSS variables", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.columnSizeVars).toBeDefined();
      expect(typeof result.current.columnSizeVars).toBe("object");

      expect(result.current.columnSizeVars["--col-name-size"]).toBeDefined();
      expect(result.current.columnSizeVars["--col-trick-size"]).toBeDefined();
      expect(result.current.columnSizeVars["--col-score-size"]).toBeDefined();
    });
  });

  describe("refs", () => {
    it("should provide dataGridRef", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.dataGridRef).toBeDefined();
      expect(result.current.dataGridRef.current).toBeNull();
    });

    it("should provide headerRef", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.headerRef).toBeDefined();
    });

    it("should provide footerRef", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.footerRef).toBeDefined();
    });
  });

  describe("row height", () => {
    it("should change row height via the table API", async () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        result.current.table.setRowHeight("tall");
        await Promise.resolve();
      });

      expect(result.current.table.state.rowHeight).toBe("tall");
      expect(result.current.table.getRowSize()).toBe(76);
      expect(result.current.table.getRowLineCount()).toBe(3);

      await act(async () => {
        result.current.table.resetRowHeight();
        await Promise.resolve();
      });

      expect(result.current.table.state.rowHeight).toBe("short");
    });

    it("should support controlled row height", async () => {
      const onRowHeightChange = vi.fn();

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            state: { rowHeight: "medium" },
            onRowHeightChange,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.table.state.rowHeight).toBe("medium");

      await act(async () => {
        result.current.table.setRowHeight("tall");
        await Promise.resolve();
      });

      expect(onRowHeightChange).toHaveBeenCalledTimes(1);
      const updater = onRowHeightChange.mock.calls[0]?.[0];
      expect(typeof updater === "function" ? updater("medium") : updater).toBe(
        "tall",
      );
      expect(result.current.table.state.rowHeight).toBe("medium");
    });
  });

  describe("paste dialog", () => {
    it("should have closed paste dialog initially", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.table.getPasteDialog().open).toBe(false);
    });

    it("should close paste dialog via table.resetPasteDialog", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      // Already closed, but resetting still runs the callback
      act(() => {
        result.current.table.resetPasteDialog(true);
      });

      expect(result.current.table.getPasteDialog().open).toBe(false);
    });
  });

  describe("clipboard feature", () => {
    it("should ask before adding rows a paste needs", async () => {
      const createRow = vi.fn((): TestData => ({
        id: "new",
        name: "",
        trick: "",
        score: 0,
      }));
      mockClipboard.readText.mockResolvedValue("a\nb\nc");

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            createRow,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.setFocusedCell("2", "name");
      });

      await act(async () => {
        await result.current.table.pasteCells();
      });

      expect(result.current.table.getPasteDialog()).toEqual({
        open: true,
        rowsNeeded: 2,
        clipboardText: "a\nb\nc",
      });
      expect(createRow).not.toHaveBeenCalled();
    });

    it("should paste only what fits when the dialog declines new rows", async () => {
      const createRow = vi.fn((): TestData => ({
        id: "new",
        name: "",
        trick: "",
        score: 0,
      }));
      const onDataChange = vi.fn();
      mockClipboard.readText.mockResolvedValue("a\nb\nc");

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            createRow,
            onDataChange,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.setFocusedCell("2", "name");
      });
      await act(async () => {
        await result.current.table.pasteCells();
      });
      await act(async () => {
        await result.current.table.pasteCells({ expandRows: false });
      });

      expect(createRow).not.toHaveBeenCalled();
      expect(onDataChange).toHaveBeenCalledTimes(1);
      expect(onDataChange.mock.calls[0]?.[0][2].name).toBe("a");
      expect(result.current.table.getPasteDialog().open).toBe(false);
    });

    it("should add rows through createRow when expanding", async () => {
      const createRow = vi.fn((): TestData => ({
        id: "new",
        name: "",
        trick: "",
        score: 0,
      }));
      mockClipboard.readText.mockResolvedValue("a\nb");
      vi.useFakeTimers();

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            createRow,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.setFocusedCell("2", "name");
      });

      await act(async () => {
        const paste = result.current.table.pasteCells({ expandRows: true });
        await vi.runAllTimersAsync();
        await paste;
      });
      vi.useRealTimers();

      expect(createRow).toHaveBeenCalledTimes(1);
      expect(createRow).toHaveBeenCalledWith({ reason: "paste" });
    });

    it("should report results through onClipboardNotice", async () => {
      const onClipboardNotice = vi.fn();

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onClipboardNotice,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.setFocusedCell("0", "name");
      });
      await act(async () => {
        await result.current.table.copySelectedCells();
      });

      expect(onClipboardNotice).toHaveBeenCalledWith({
        variant: "success",
        message: "1 cell copied",
      });
    });

    it("should track cut cells and clear them on copy", async () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.setFocusedCell("0", "name");
      });
      await act(async () => {
        await result.current.table.cutSelectedCells();
      });
      expect(result.current.table.getCutCellGrid()).toEqual([
        [{ rowId: "0", columnId: "name" }],
      ]);

      await act(async () => {
        await result.current.table.copySelectedCells();
      });
      expect(result.current.table.getCutCellGrid()).toEqual([]);
    });
  });

  describe("advanced paste operations", () => {
    it("should parse numbers correctly when pasting", async () => {
      const onDataChange = vi.fn();
      mockClipboard.readText.mockResolvedValue("42");

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onDataChange,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onClick", "0", "score");
      });

      await act(async () => {
        await result.current.table.pasteCells();
      });

      expect(onDataChange).toHaveBeenCalled();
    });

    it("should handle paste with clipboardText in pasteDialog state", async () => {
      const onDataChange = vi.fn();
      const createRow = vi.fn(async (): Promise<TestData | null> => ({
        id: "4",
        name: "New",
        trick: "",
        score: 0,
      }));

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onDataChange,
            createRow,
            enablePaste: true,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
      });

      await act(async () => {
        mockClipboard.readText.mockResolvedValue("Test\nValue\nNew");
        await result.current.table.pasteCells();
      });
    });

    it("should skip invalid data during paste", async () => {
      const onDataChange = vi.fn();
      mockClipboard.readText.mockResolvedValue("invalid_number");

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onDataChange,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onClick", "0", "score");
      });

      await act(async () => {
        await result.current.table.pasteCells();
      });

      expect(onDataChange).not.toHaveBeenCalled();
    });

    it("should preserve multiline content within cells when pasting", async () => {
      const onDataChange = vi.fn();
      mockClipboard.readText.mockResolvedValue(
        'Alice\tKickflip\t95\nBob\t"Trick with\nmultiple\nlines"\t98',
      );

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onDataChange,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
      });

      await act(async () => {
        await result.current.table.pasteCells();
      });

      const nextData = onDataChange.mock.calls[0]?.[0];
      expect(nextData?.[0]).toMatchObject({
        name: "Alice",
        trick: "Kickflip",
        score: 95,
      });
      expect(nextData?.[1]).toMatchObject({
        name: "Bob",
        trick: "Trick with\nmultiple\nlines",
        score: 98,
      });
    });

    it("should preserve unquoted multiline content when pasting (Excel format)", async () => {
      const onDataChange = vi.fn();
      mockClipboard.readText.mockResolvedValue(
        "Alice\tKickflip\t95\nBob\tTrick with\nmultiple\nlines\t98",
      );

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onDataChange,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
      });

      await act(async () => {
        await result.current.table.pasteCells();
      });

      const nextData = onDataChange.mock.calls[0]?.[0];
      expect(nextData?.[0]).toMatchObject({
        name: "Alice",
        trick: "Kickflip",
        score: 95,
      });
      expect(nextData?.[1]).toMatchObject({
        name: "Bob",
        trick: "Trick with\nmultiple\nlines",
        score: 98,
      });
    });
  });

  describe("cut operations", () => {
    it("should track cut cells after cutting", async () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
      });

      await act(async () => {
        await result.current.table.cutSelectedCells();
      });

      expect(mockClipboard.writeText).toHaveBeenCalledWith("Tony Hawk");
    });

    it("should keep cut sources whose destinations were skipped", async () => {
      const onDataChange = vi.fn();
      const columns: ColumnDef<DataGridFeatures, TestData>[] = [
        { id: "name", accessorKey: "name" },
        { id: "trick", accessorKey: "trick" },
        { id: "score", accessorKey: "score", enableCellEditing: false },
      ];

      const { result } = renderHook(
        () => useDataGrid({ data: testData, columns, onDataChange }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onMouseDown", "0", "name", {
          button: 0,
          preventDefault: vi.fn(),
        });
      });
      act(() => {
        fireCellEvent(result, "onMouseOver", "0", "trick");
      });

      await act(async () => {
        await result.current.table.cutSelectedCells();
      });

      expect(mockClipboard.writeText).toHaveBeenCalledWith("Tony Hawk\t900");
      mockClipboard.readText.mockResolvedValue("Tony Hawk\t900");

      act(() => {
        fireCellEvent(result, "onClick", "1", "trick");
      });

      await act(async () => {
        await result.current.table.pasteCells();
      });

      expect(onDataChange).toHaveBeenCalledTimes(1);
      const [firstRow, secondRow] = onDataChange.mock.calls[0]?.[0] ?? [];
      expect(firstRow).toMatchObject({ name: "", trick: "900" });
      expect(secondRow).toMatchObject({ trick: "Tony Hawk", score: 98 });
    });

    it("should not clear cut sources that were pasted over", async () => {
      const onDataChange = vi.fn();

      const { result } = renderHook(
        () =>
          useDataGrid({ data: testData, columns: testColumns, onDataChange }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onMouseDown", "0", "name", {
          button: 0,
          preventDefault: vi.fn(),
        });
      });
      act(() => {
        fireCellEvent(result, "onMouseOver", "1", "name");
      });

      await act(async () => {
        await result.current.table.cutSelectedCells();
      });

      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        "Tony Hawk\nRodney Mullen",
      );
      mockClipboard.readText.mockResolvedValue("Tony Hawk\nRodney Mullen");

      act(() => {
        fireCellEvent(result, "onClick", "1", "name");
      });

      await act(async () => {
        await result.current.table.pasteCells();
      });

      expect(onDataChange).toHaveBeenCalledTimes(1);
      const nextData = onDataChange.mock.calls[0]?.[0] ?? [];
      expect(nextData.map((row: TestData) => row.name)).toEqual([
        "",
        "Tony Hawk",
        "Rodney Mullen",
      ]);
    });

    it("should copy selected cells when multiple cells are selected", async () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
      });

      act(() => {
        fireCellEvent(result, "onMouseDown", "0", "name", {
          button: 0,
          preventDefault: vi.fn(),
        });
      });

      await act(async () => {
        await result.current.table.copySelectedCells();
      });

      expect(mockClipboard.writeText).toHaveBeenCalled();
    });
  });

  describe("selection mechanisms", () => {
    it("should handle Ctrl+Click for multi-selection", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      const mockEvent = {
        preventDefault: vi.fn(),
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
      } as unknown as React.MouseEvent;

      act(() => {
        fireCellEvent(result, "onClick", "0", "name", mockEvent);
      });

      expect(getFocusedCell(result.current.table)).toEqual({
        rowId: "0",
        columnId: "name",
      });
    });

    it("should handle Shift+Click for range selection", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
      });

      const mockEvent = {
        preventDefault: vi.fn(),
        shiftKey: true,
        ctrlKey: false,
        metaKey: false,
      } as unknown as React.MouseEvent;

      act(() => {
        fireCellEvent(result, "onClick", "1", "trick", mockEvent);
      });

      expect(result.current.table.getIsCellSelected("0", "name")).toBe(true);
    });

    it("should handle mouse drag selection", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onMouseDown", "0", "name", {
          button: 0,
          preventDefault: vi.fn(),
          ctrlKey: false,
          metaKey: false,
          shiftKey: false,
        });
      });

      act(() => {
        fireCellEvent(result, "onMouseOver", "1", "score");
      });

      act(() => {
        fireCellEvent(result, "onMouseUp", "0", "name");
      });

      expect(result.current.table.getIsCellSelected("0", "name")).toBe(true);
    });

    it("should stop selection when document mouseup fires during auto-scroll", () => {
      // Mounts with the synchronous RAF from beforeEach, so every setup effect
      // finishes before the test takes over RAF scheduling
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      // Defer RAF from this point forward so that onAutoScrollStart can
      // register the document mouseup listener without tick() immediately
      // calling onAutoScrollStop (which would remove the listener)
      const pendingRafs: FrameRequestCallback[] = [];
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
        pendingRafs.push(cb);
        return pendingRafs.length;
      });
      vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

      // Give onAutoScrollStart a real container so it doesn't bail early
      const mockContainer = document.createElement("div");
      result.current.dataGridRef.current = mockContainer;

      // Mousedown sets dragStartCell, and onAutoScrollStart registers the
      // document mouseup listener before queuing the deferred RAF
      act(() => {
        fireCellEvent(result, "onMouseDown", "0", "name", {
          button: 0,
          preventDefault: vi.fn(),
          ctrlKey: false,
          metaKey: false,
          shiftKey: false,
        });
      });

      act(() => {
        fireCellEvent(result, "onMouseOver", "1", "score");
      });

      expect(result.current.table.getIsCellSelected("0", "name")).toBe(true);

      // Releasing the mouse outside the grid reaches the document listener from
      // onAutoScrollStart, which clears dragStartCell
      act(() => {
        document.dispatchEvent(new MouseEvent("mouseup"));
      });

      // A subsequent onCellMouseEnter must be a no-op because the drag has
      // ended — so row 2 should never enter the selected set
      act(() => {
        fireCellEvent(result, "onMouseOver", "2", "score");
      });

      expect(result.current.table.getIsCellSelected("2", "score")).toBe(false);
    });

    it("should select column when enableColumnSelection is true", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            enableColumnSelection: true,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.selectColumnCells("name");
      });

      expect(result.current.table.getIsCellSelected("0", "name")).toBe(true);
      expect(result.current.table.getIsCellSelected("1", "name")).toBe(true);
      expect(result.current.table.getIsCellSelected("2", "name")).toBe(true);
    });

    it("should select data cells with Cmd+A and skip non-navigable columns", () => {
      const gridRef: {
        current?: ReturnType<typeof useDataGrid<TestData>>;
      } = {};

      function Harness() {
        const api = useDataGrid({
          data: testData.slice(0, 2),
          columns: columnsWithSelect,
        });

        useEffect(() => {
          gridRef.current = api;
        });

        return <div ref={api.dataGridRef} />;
      }

      const { container } = render(<Harness />);
      const grid = gridRef.current;
      const gridElement = container.firstElementChild as HTMLElement;

      act(() => {
        if (grid) fireCellEvent({ current: grid }, "onClick", "0", "name");
      });

      act(() => {
        gridElement.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "a",
            metaKey: true,
            bubbles: true,
            cancelable: true,
          }),
        );
      });

      expect(grid?.table.getSelectedRangeCellCount()).toBe(4);
      expect(grid?.table.getIsCellSelected("0", "name")).toBe(true);
      expect(grid?.table.getIsCellSelected("1", "trick")).toBe(true);
      expect(grid?.table.getIsCellSelected("0", "select")).toBe(false);
      expect(grid?.table.getIsCellSelected("1", "actions")).toBe(false);
      expect(getFocusedCell(gridRef.current?.table)).toEqual({
        rowId: "0",
        columnId: "name",
      });
      expect(getSelectedCellKeys(grid?.table)).toEqual([
        getCellKey("0", "name"),
        getCellKey("0", "trick"),
        getCellKey("1", "name"),
        getCellKey("1", "trick"),
      ]);
    });

    it("should not count non-navigable columns when selecting rows", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData.slice(0, 2),
            columns: columnsWithSelect,
            getRowId: (row) => row.id,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.toggleAllRowsSelected(true);
      });

      expect(result.current.table.getSelectedRangeCellCount()).toBe(4);
      expect(result.current.table.getIsCellSelected("1", "select")).toBe(false);
      expect(result.current.table.getIsCellSelected("1", "actions")).toBe(
        false,
      );
      expect(result.current.table.getIsCellSelected("2", "name")).toBe(true);
    });

    it("should mirror non-contiguous selected rows as separate ranges", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: columnsWithSelect,
            getRowId: (row) => row.id,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.getRow("1").toggleSelected(true);
      });
      act(() => {
        result.current.table.getRow("3").toggleSelected(true);
      });

      expect(result.current.table.getCellSelectionBounds()).toEqual([
        {
          minRowIndex: 0,
          maxRowIndex: 0,
          minColumnIndex: 1,
          maxColumnIndex: 2,
        },
        {
          minRowIndex: 2,
          maxRowIndex: 2,
          minColumnIndex: 1,
          maxColumnIndex: 2,
        },
      ]);
      expect(result.current.table.getIsCellSelected("2", "name")).toBe(false);
    });

    it("should clear selection when clicking column with enableColumnSelection false", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            enableColumnSelection: false,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onMouseDown", "0", "name", {
          button: 0,
          preventDefault: vi.fn(),
        });
      });

      act(() => {
        result.current.table.selectColumnCells("name");
      });

      expect(result.current.table.getIsCellSelected("0", "name")).toBe(false);
    });

    it("should handle right-click without affecting existing selection", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      const mockRightClickEvent = {
        button: 2,
        preventDefault: vi.fn(),
      } as unknown as React.MouseEvent;

      act(() => {
        fireCellEvent(result, "onClick", "0", "name", mockRightClickEvent);
      });

      expect(getFocusedCell(result.current.table)).toBeNull();
    });
  });

  describe("search navigation", () => {
    it("should navigate to next search match", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            enableSearch: true,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.setSearchQuery("Kickflip");
      });

      act(() => {
        result.current.table.goToNextSearchMatch();
      });

      expect(result.current.table.getSearchMatchIndex()).toBeDefined();
    });

    it("should navigate to previous search match", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            enableSearch: true,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.setSearchQuery("Kickflip");
      });

      act(() => {
        result.current.table.goToNextSearchMatch();
      });

      act(() => {
        result.current.table.goToPrevSearchMatch();
      });

      expect(result.current.table.getSearchMatchIndex()).toBe(0);
    });

    it("should wrap around when navigating past last match", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            enableSearch: true,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.setSearchQuery("Kickflip");
      });

      const matchCount = result.current.table.getSearchMatches().length ?? 0;

      for (let i = 0; i < matchCount; i++) {
        act(() => {
          result.current.table.goToNextSearchMatch();
        });
      }

      expect(result.current.table.getSearchMatchIndex()).toBe(0);
    });

    it("should provide searchMatchesByRow computed value", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            enableSearch: true,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.setSearchQuery("Tony");
      });

      expect(result.current.table.getSearchMatchesByRowId()).toBeDefined();
    });

    it("should provide activeSearchMatch", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            enableSearch: true,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.setSearchQuery("Tony");
      });

      expect(result.current.table.getActiveSearchMatch()).toBeDefined();
    });

    it("should update search query", async () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            enableSearch: true,
          }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        result.current.table.setSearchQuery("test query");
        await Promise.resolve();
      });

      expect(result.current.table.getSearchQuery()).toBe("test query");
    });

    it("should close search and restore focus to last match", async () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            enableSearch: true,
          }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        result.current.table.openSearch();
        await Promise.resolve();
      });

      act(() => {
        result.current.table.setSearchQuery("Tony");
      });

      await act(async () => {
        result.current.table.closeSearch();
        await Promise.resolve();
      });

      expect(result.current.table.getSearchOpen()).toBe(false);
      expect(result.current.table.getSearchQuery()).toBe("");
    });
  });

  describe("row selection operations", () => {
    it("should select row via onRowSelect", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            getRowId: (row) => row.id,
          }),
        { wrapper: createWrapper() },
      );

      const firstRowId = result.current.table.getRowModel().rows[0]?.id;
      act(() => {
        result.current.table.getRow(firstRowId ?? "1").toggleSelected(true);
      });

      const rowSelection = result.current.table.atoms.rowSelection.get();
      expect(Object.keys(rowSelection).length).toBeGreaterThan(0);
    });

    it("should select range of rows with Shift key", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            getRowId: (row) => row.id,
          }),
        { wrapper: createWrapper() },
      );

      const rows = result.current.table.getRowModel().rows;
      const firstRowId = rows[0]?.id;
      const thirdRowId = rows[2]?.id;

      act(() => {
        result.current.table
          .getRow(firstRowId ?? "1")
          .getToggleSelectedHandler()({ target: { checked: true } });
      });

      act(() => {
        result.current.table
          .getRow(thirdRowId ?? "3")
          .getToggleSelectedHandler()({
          target: { checked: true },
          shiftKey: true,
        });
      });

      const rowSelection = result.current.table.atoms.rowSelection.get();
      expect(rowSelection).toEqual({ "1": true, "2": true, "3": true });
    });

    it("should deselect row", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            getRowId: (row) => row.id,
          }),
        { wrapper: createWrapper() },
      );

      const firstRowId = result.current.table.getRowModel().rows[0]?.id;

      act(() => {
        result.current.table.getRow(firstRowId ?? "1").toggleSelected(true);
      });

      act(() => {
        result.current.table.getRow(firstRowId ?? "1").toggleSelected(false);
      });

      const rowSelection = result.current.table.atoms.rowSelection.get();
      expect(rowSelection[firstRowId ?? "1"]).toBeFalsy();
    });

    it("should select correct row when filtering is applied", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            getRowId: (row) => row.id,
            initialState: {
              columnFilters: [{ id: "name", value: "Tony" }],
            },
          }),
        { wrapper: createWrapper() },
      );

      const rows = result.current.table.getRowModel().rows;
      expect(rows.length).toBe(1);
      const visibleRowId = rows[0]?.id;
      expect(visibleRowId).toBe("1");

      act(() => {
        result.current.table.getRow(visibleRowId ?? "1").toggleSelected(true);
      });

      const rowSelection = result.current.table.atoms.rowSelection.get();
      expect(rowSelection["1"]).toBe(true);
      expect(Object.keys(rowSelection).length).toBe(1);
    });
  });

  describe("cell editing with navigation", () => {
    it("should move to next row on Enter while editing", async () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        startEditing(result.current.table, "0", "name");
      });

      expect(result.current.table.getEditingCell()).toEqual({
        rowId: "0",
        columnId: "name",
      });

      await act(async () => {
        result.current.table.stopEditing({ moveToNextRow: true });
      });

      expect(result.current.table.getEditingCell()).toBeNull();
      expect(getFocusedCell(result.current.table)).toEqual({
        rowId: "1",
        columnId: "name",
      });
    });

    it("should navigate in direction on Tab while editing", async () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        startEditing(result.current.table, "0", "name");
      });

      await act(async () => {
        result.current.table.stopEditing({ direction: "right" });
      });

      expect(result.current.table.getEditingCell()).toBeNull();
      expect(getFocusedCell(result.current.table)).toEqual({
        rowId: "0",
        columnId: "trick",
      });
    });

    it("should start editing on second click of same cell", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
      });

      expect(getFocusedCell(result.current.table)).toEqual({
        rowId: "0",
        columnId: "name",
      });
      expect(result.current.table.getEditingCell()).toBeNull();

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
      });

      expect(result.current.table.getEditingCell()).toEqual({
        rowId: "0",
        columnId: "name",
      });
    });
  });

  describe("navigation feature", () => {
    function renderGrid(
      props: Partial<Parameters<typeof useDataGrid<TestData>>[0]> = {},
    ) {
      return renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            ...props,
          }),
        { wrapper: createWrapper() },
      );
    }

    it("should move the focused cell and stop at the grid edges", () => {
      const { result } = renderGrid();

      act(() => {
        result.current.table.setFocusedCell("0", "name");
      });

      act(() => {
        result.current.table.navigate("down");
        result.current.table.navigate("right");
      });
      expect(getFocusedCell(result.current.table)).toEqual({
        rowId: "1",
        columnId: "trick",
      });

      act(() => {
        result.current.table.navigate("ctrl+end");
      });
      expect(getFocusedCell(result.current.table)).toEqual({
        rowId: "2",
        columnId: "score",
      });

      let target: unknown;
      act(() => {
        target = result.current.table.navigate("down");
      });
      expect(target).toBeNull();
      expect(getFocusedCell(result.current.table)).toEqual({
        rowId: "2",
        columnId: "score",
      });
    });

    it("should extend the selection without moving the focused cell", () => {
      const { result } = renderGrid();

      act(() => {
        result.current.table.setFocusedCell("0", "name");
      });

      act(() => {
        result.current.table.navigate("right", { extend: true });
        result.current.table.navigate("down", { extend: true });
      });

      expect(getFocusedCell(result.current.table)).toEqual({
        rowId: "0",
        columnId: "name",
      });
      expect(getSelectedCellKeys(result.current.table)).toHaveLength(4);
    });

    it("should stop editing when navigating", () => {
      const { result } = renderGrid();

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
        startEditing(result.current.table, "0", "name");
      });
      expect(result.current.table.getEditingCell()).not.toBeNull();

      act(() => {
        result.current.table.navigate("down");
      });
      expect(result.current.table.getEditingCell()).toBeNull();
    });

    it("should reach utility columns with arrows but skip them for home, end and tab", () => {
      const { result } = renderGrid({ columns: columnsWithSelect });

      act(() => {
        result.current.table.setFocusedCell("0", "name");
      });

      act(() => {
        result.current.table.navigate("left");
      });
      expect(getFocusedCell(result.current.table)?.columnId).toBe("select");

      act(() => {
        result.current.table.navigate("end");
      });
      expect(getFocusedCell(result.current.table)?.columnId).toBe("trick");

      act(() => {
        result.current.table.navigate("tab");
      });
      expect(getFocusedCell(result.current.table)).toEqual({
        rowId: "1",
        columnId: "name",
      });

      expect(
        result.current.table.getNavigationTarget(
          { rowId: "1", columnId: "name" },
          "left",
          { extend: true },
        ),
      ).toBeNull();
    });

    it("should mirror horizontal arrows in RTL", () => {
      const { result } = renderGrid({ dir: "rtl" });

      act(() => {
        result.current.table.setFocusedCell("0", "trick");
      });

      act(() => {
        result.current.table.navigate("left");
      });
      expect(getFocusedCell(result.current.table)?.columnId).toBe("score");
    });

    it("should use the page size for page up and down", () => {
      const { result } = renderGrid();

      expect(
        result.current.table.getNavigationTarget(
          { rowId: "0", columnId: "name" },
          "pagedown",
          { pageSize: 2 },
        ),
      ).toEqual({ rowId: "2", columnId: "name" });
    });
  });

  describe("auto focus", () => {
    it("should auto focus first cell when autoFocus is true", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            autoFocus: true,
          }),
        { wrapper: createWrapper() },
      );

      expect(getFocusedCell(result.current.table)).toBeDefined();
    });

    it("should auto focus specific cell when autoFocus is object", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            autoFocus: { rowId: "1", columnId: "trick" },
          }),
        { wrapper: createWrapper() },
      );

      expect(getFocusedCell(result.current.table)).toBeDefined();
    });

    it("should not auto focus when autoFocus is false", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            autoFocus: false,
          }),
        { wrapper: createWrapper() },
      );

      expect(getFocusedCell(result.current.table)).toBeNull();
    });
  });

  describe("sorting and filtering", () => {
    it("should hand sorting to onSortingChange when controlled", () => {
      const onSortingChange = vi.fn();

      const { result } = renderHook(
        () => {
          const [sorting, setSorting] = useState<SortingState>([]);
          return useDataGrid({
            data: testData,
            columns: testColumns,
            state: { sorting },
            onSortingChange: (updater) => {
              onSortingChange(updater);
              setSorting(updater);
            },
          });
        },
        { wrapper: createWrapper() },
      );

      const nameColumn = result.current.table.getColumn("name");

      act(() => {
        nameColumn?.toggleSorting(false);
      });

      expect(onSortingChange).toHaveBeenCalled();
      expect(result.current.table.state.sorting).toEqual([
        { id: "name", desc: false },
      ]);
    });

    it("should sort rows like the built-in sorted row model", () => {
      interface SortData {
        id: string;
        label: string;
        group: string;
        score?: number;
      }

      const data: SortData[] = [
        { id: "a", label: "Item10", group: "b", score: 2 },
        { id: "b", label: "item2", group: "a" },
        { id: "c", label: "Item1", group: "b", score: 1 },
        { id: "d", label: "item2", group: "a", score: 3 },
        { id: "e", label: "item20", group: "c", score: 2 },
      ];
      const columns: ColumnDef<DataGridFeatures, SortData>[] = [
        { id: "label", accessorKey: "label" },
        { id: "group", accessorKey: "group" },
        { id: "score", accessorKey: "score", sortUndefined: "last" },
        {
          id: "length",
          accessorFn: (row) => row.label.length,
          sortFn: (rowA, rowB) =>
            rowA.original.label.length - rowB.original.label.length,
        },
      ];

      const { result } = renderHook(
        () => useDataGrid({ data, columns, getRowId: (row) => row.id }),
        { wrapper: createWrapper() },
      );

      function getSortedIds(sorting: SortingState) {
        act(() => {
          result.current.table.setSorting(sorting);
        });
        return result.current.table.getRowModel().rows.map((row) => row.id);
      }

      // Natural, case-insensitive order with ties kept in data order
      expect(getSortedIds([{ id: "label", desc: false }])).toEqual([
        "c",
        "b",
        "d",
        "a",
        "e",
      ]);
      expect(getSortedIds([{ id: "label", desc: true }])).toEqual([
        "e",
        "a",
        "b",
        "d",
        "c",
      ]);
      expect(
        getSortedIds([
          { id: "group", desc: false },
          { id: "score", desc: true },
        ]),
      ).toEqual(["d", "b", "a", "c", "e"]);
      expect(getSortedIds([{ id: "score", desc: false }])).toEqual([
        "c",
        "a",
        "e",
        "d",
        "b",
      ]);
      expect(getSortedIds([{ id: "length", desc: false }])).toEqual([
        "b",
        "c",
        "d",
        "a",
        "e",
      ]);
    });

    it("should match TanStack's natural order for tricky values", () => {
      const labels = [
        "item10",
        "Item2",
        "item02",
        "item2b",
        "item",
        "",
        "0",
        "00",
        "007",
        "10a",
        "1a",
        "a-1",
        "a 1",
        "a01",
        "a1",
        "ab",
        "2024-01-05",
        "2024-1-5",
        "1234567890123456789",
        "Zoë 3",
        "zoe 3",
      ];
      const data = labels.map((label, index) => ({ id: `${index}`, label }));
      const columns: ColumnDef<DataGridFeatures, (typeof data)[number]>[] = [
        { id: "label", accessorKey: "label", sortFn: "alphanumeric" },
      ];

      const { result } = renderHook(
        () => useDataGrid({ data, columns, getRowId: (row) => row.id }),
        { wrapper: createWrapper() },
      );

      const resolve =
        sortFn_alphanumeric.resolveDataValue ?? ((value: unknown) => value);
      const expected = [...data]
        .map((row, index) => ({ row, index }))
        .sort(
          (a, b) =>
            sortFn_alphanumeric.sort(
              resolve(a.row.label),
              resolve(b.row.label),
              {} as never,
              {} as never,
              "label",
            ) || a.index - b.index,
        )
        .map(({ row }) => row.id);

      for (const desc of [false, true]) {
        act(() => {
          result.current.table.setSorting([{ id: "label", desc }]);
        });
        const ids = result.current.table
          .getRowModel()
          .rows.map((row) => row.id);
        // Descending flips the comparison but keeps ties in data order
        expect(ids).toEqual(
          desc
            ? [...data]
                .map((row, index) => ({ row, index }))
                .sort(
                  (a, b) =>
                    -sortFn_alphanumeric.sort(
                      resolve(a.row.label),
                      resolve(b.row.label),
                      {} as never,
                      {} as never,
                      "label",
                    ) || a.index - b.index,
                )
                .map(({ row }) => row.id)
            : expected,
        );
      }

      // Without the out-of-range values every label takes the precomputed key path
      const latinData = data.filter(
        (row) => !row.label.includes("ë") && row.label.length < 16,
      );
      const { result: latinResult } = renderHook(
        () =>
          useDataGrid({ data: latinData, columns, getRowId: (row) => row.id }),
        { wrapper: createWrapper() },
      );
      act(() => {
        latinResult.current.table.setSorting([{ id: "label", desc: false }]);
      });
      expect(
        latinResult.current.table.getRowModel().rows.map((row) => row.id),
      ).toEqual(
        expected.filter((id) => latinData.some((row) => row.id === id)),
      );
    });

    it("should flip sort directions to the same order as a fresh sort", () => {
      interface TieData {
        id: string;
        group: string;
        score: number;
      }
      const data: TieData[] = Array.from({ length: 40 }, (_, index) => ({
        id: `${index}`,
        group: ["b", "a", "c"][index % 3] ?? "a",
        score: (index * 7) % 5,
      }));
      const columns: ColumnDef<DataGridFeatures, TieData>[] = [
        { id: "group", accessorKey: "group" },
        { id: "score", accessorKey: "score" },
      ];

      function getFreshIds(rows: TieData[], sorting: SortingState) {
        const { result } = renderHook(
          () => useDataGrid({ data: rows, columns, getRowId: (row) => row.id }),
          { wrapper: createWrapper() },
        );
        act(() => {
          result.current.table.setSorting(sorting);
        });
        return result.current.table.getRowModel().rows.map((row) => row.id);
      }

      const { result, rerender } = renderHook(
        ({ rows }) =>
          useDataGrid({ data: rows, columns, getRowId: (row) => row.id }),
        { wrapper: createWrapper(), initialProps: { rows: data } },
      );

      function getIds(sorting: SortingState) {
        act(() => {
          result.current.table.setSorting(sorting);
        });
        return result.current.table.getRowModel().rows.map((row) => row.id);
      }

      const toggles: SortingState[] = [
        [{ id: "score", desc: false }],
        [{ id: "score", desc: true }],
        [{ id: "score", desc: false }],
        [
          { id: "group", desc: false },
          { id: "score", desc: true },
        ],
        [
          { id: "group", desc: true },
          { id: "score", desc: false },
        ],
        // Flipping only one of the sorts needs a full sort
        [
          { id: "group", desc: true },
          { id: "score", desc: true },
        ],
      ];
      for (const sorting of toggles) {
        expect(getIds(sorting)).toEqual(getFreshIds(data, sorting));
      }

      // New data must not reuse the order computed for the old rows
      const edited = data.map((row) =>
        row.id === "0" ? { ...row, group: "z" } : row,
      );
      rerender({ rows: edited });
      const flipped: SortingState = [
        { id: "group", desc: false },
        { id: "score", desc: false },
      ];
      expect(getIds(flipped)).toEqual(getFreshIds(edited, flipped));
    });

    it("should keep sorted results when filters and data change", () => {
      interface FilterSortData {
        id: string;
        group: string;
        score: number;
        note: string;
      }
      const data: FilterSortData[] = Array.from({ length: 60 }, (_, index) => ({
        id: `${index}`,
        group: ["b", "a", "c", "ab"][index % 4] ?? "a",
        score: (index * 7) % 9,
        note: `note ${index}`,
      }));
      const columns: ColumnDef<DataGridFeatures, FilterSortData>[] = [
        { id: "group", accessorKey: "group", filterFn: simpleFilterFn },
        { id: "score", accessorKey: "score", filterFn: simpleFilterFn },
        { id: "note", accessorKey: "note", filterFn: simpleFilterFn },
      ];

      function getFreshIds(
        rows: FilterSortData[],
        sorting: SortingState,
        columnFilters: ColumnFiltersState,
      ) {
        const { result } = renderHook(
          () => useDataGrid({ data: rows, columns, getRowId: (row) => row.id }),
          { wrapper: createWrapper() },
        );
        act(() => {
          result.current.table.setColumnFilters(columnFilters);
          result.current.table.setSorting(sorting);
        });
        return result.current.table.getRowModel().rows.map((row) => row.id);
      }

      const { result, rerender } = renderHook(
        ({ rows }) =>
          useDataGrid({ data: rows, columns, getRowId: (row) => row.id }),
        { wrapper: createWrapper(), initialProps: { rows: data } },
      );
      let rows = data;
      let sorting: SortingState = [
        { id: "score", desc: false },
        { id: "group", desc: true },
      ];
      let columnFilters: ColumnFiltersState = [];

      function expectFreshOrder() {
        const ids = result.current.table
          .getRowModel()
          .rows.map((row) => row.id);
        expect(ids).toEqual(getFreshIds(rows, sorting, columnFilters));
      }

      function update(next: {
        sorting?: SortingState;
        columnFilters?: ColumnFiltersState;
      }) {
        sorting = next.sorting ?? sorting;
        columnFilters = next.columnFilters ?? columnFilters;
        act(() => {
          result.current.table.setSorting(sorting);
          result.current.table.setColumnFilters(columnFilters);
        });
        expectFreshOrder();
      }

      update({});
      update({ columnFilters: [{ id: "group", value: "a" }] });
      update({ columnFilters: [{ id: "group", value: "ab" }] });
      update({
        sorting: [
          { id: "score", desc: true },
          { id: "group", desc: false },
        ],
      });
      update({ columnFilters: [{ id: "note", value: "1" }] });
      update({ columnFilters: [] });

      rows = rows.map((row) =>
        row.id === "12" ? { ...row, note: "edited" } : row,
      );
      rerender({ rows });
      update({ columnFilters: [{ id: "note", value: "edit" }] });
      update({ columnFilters: [{ id: "group", value: "a" }] });

      rows = rows.map((row) => (row.id === "13" ? { ...row, score: 99 } : row));
      rerender({ rows });
      expectFreshOrder();
      update({ columnFilters: [{ id: "group", value: "b" }] });
    });

    it("should reuse unchanged rows when data changes", () => {
      const { result, rerender } = renderHook(
        ({ data }) =>
          useDataGrid({
            data,
            columns: testColumns,
            getRowId: (row) => row.id,
          }),
        { wrapper: createWrapper(), initialProps: { data: testData } },
      );

      const before = result.current.table.getCoreRowModel();
      const edited = testData.map((row) =>
        row.id === "2" ? { ...row, trick: "Impossible" } : row,
      );
      rerender({ data: edited });

      const after = result.current.table.getCoreRowModel();
      expect(after).not.toBe(before);
      expect(after.rows[0]).toBe(before.rows[0]);
      expect(after.rows[2]).toBe(before.rows[2]);
      expect(after.rows[1]).not.toBe(before.rows[1]);
      expect(after.rows[1]?.getValue("trick")).toBe("Impossible");
      expect(after.rowsById["2"]).toBe(after.rows[1]);
      expect(after.flatRows).toEqual(after.rows);

      rerender({
        data: [
          ...edited.filter((row) => row.id !== "2"),
          { id: "4", name: "Elissa Steamer", trick: "Boardslide", score: 90 },
        ],
      });

      const rebuilt = result.current.table.getCoreRowModel();
      expect(rebuilt.rows.map((row) => row.id)).toEqual(["1", "3", "4"]);
      expect(rebuilt.rows.map((row) => row.index)).toEqual([0, 1, 2]);
      expect(rebuilt.rowsById["2"]).toBeUndefined();
      expect(rebuilt.rowsById["4"]?.getValue("name")).toBe("Elissa Steamer");
      expect(rebuilt.rows[0]).toBe(after.rows[0]);
    });

    it("should record per-row filter results and meta like TanStack's model", () => {
      const columns: ColumnDef<DataGridFeatures, TestData>[] = [
        {
          id: "name",
          accessorKey: "name",
          filterFn: (row, columnId, value: string, addMeta) => {
            const isMatch = String(row.getValue(columnId)).includes(value);
            if (isMatch) addMeta?.({ matchedBy: value });
            return isMatch;
          },
        },
        {
          id: "score",
          accessorKey: "score",
          filterFn: (row, columnId, value: number) =>
            Number(row.getValue(columnId)) >= value,
        },
      ];

      const { result } = renderHook(
        () =>
          useDataGrid({ data: testData, columns, getRowId: (row) => row.id }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.setColumnFilters([
          { id: "name", value: "o" },
          { id: "score", value: 93 },
        ]);
      });

      const { table } = result.current;
      expect(table.getRowModel().rows.map((row) => row.id)).toEqual(["1", "2"]);

      const coreRows = table.getCoreRowModel().rowsById;
      expect(coreRows["1"]?.columnFilters).toEqual({ name: true, score: true });
      expect(coreRows["3"]?.columnFilters).toEqual({
        name: true,
        score: false,
      });
      expect(coreRows["1"]?.columnFiltersMeta).toEqual({
        name: { matchedBy: "o" },
      });
      expect(coreRows["2"]?.columnFiltersMeta).toEqual({
        name: { matchedBy: "o" },
      });

      act(() => {
        table.setColumnFilters([]);
      });
      expect(table.getRowModel().rows).toHaveLength(3);
      expect(coreRows["1"]?.columnFilters).toEqual({});
      expect(coreRows["1"]?.columnFiltersMeta).toEqual({});
    });

    it("should hand column filters to onColumnFiltersChange", () => {
      const onColumnFiltersChange = vi.fn();

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onColumnFiltersChange,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.setColumnFilters([{ id: "name", value: "Tony" }]);
      });

      expect(onColumnFiltersChange).toHaveBeenCalled();
    });

    it("should maintain sorting state", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            initialState: {
              sorting: [{ id: "score", desc: true }],
            },
          }),
        { wrapper: createWrapper() },
      );

      const sorting = result.current.table.state.sorting;
      expect(sorting).toEqual([{ id: "score", desc: true }]);
    });

    it("should maintain filter state", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            initialState: {
              columnFilters: [{ id: "name", value: "Tony" }],
            },
          }),
        { wrapper: createWrapper() },
      );

      const filters = result.current.table.state.columnFilters;
      expect(filters).toEqual([{ id: "name", value: "Tony" }]);
    });
  });

  describe("file operations", () => {
    it("should provide uploadFiles when prop is provided", () => {
      const uploadFiles = vi.fn().mockResolvedValue([]);

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            uploadFiles,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.table.options.uploadFiles).toBeDefined();
    });

    it("should not provide uploadFiles when prop is not provided", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.table.options.uploadFiles).toBeUndefined();
    });

    it("should provide deleteFiles when prop is provided", () => {
      const deleteFiles = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            deleteFiles,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.table.options.deleteFiles).toBeDefined();
    });

    it("should not provide deleteFiles when prop is not provided", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.table.options.deleteFiles).toBeUndefined();
    });
  });

  describe("direction (RTL) support", () => {
    it("should handle RTL direction", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            dir: "rtl",
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.dir).toBeDefined();
    });
  });

  describe("context menu advanced", () => {
    it("should focus a non-selected cell before opening context menu", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      const mockEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientX: 100,
        clientY: 100,
      } as unknown as React.MouseEvent;

      act(() => {
        fireCellEvent(result, "onContextMenu", "0", "name", mockEvent);
      });

      expect(getFocusedCell(result.current.table)).toEqual({
        rowId: "0",
        columnId: "name",
      });
      expect(getSelectedCellKeys(result.current.table)).toEqual([
        getCellKey("0", "name"),
      ]);
      expect(result.current.table.getContextMenu().open).toBe(true);
    });

    it("should keep selection when right-clicking already selected cell", async () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        fireCellEvent(result, "onMouseDown", "0", "name", {
          button: 0,
          preventDefault: vi.fn(),
          ctrlKey: false,
          metaKey: false,
          shiftKey: false,
        });
        await Promise.resolve();
      });

      await act(async () => {
        fireCellEvent(result, "onMouseOver", "1", "trick");
        await Promise.resolve();
      });

      await act(async () => {
        fireCellEvent(result, "onMouseUp", "0", "name");
        await Promise.resolve();
      });

      const mockEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientX: 100,
        clientY: 100,
      } as unknown as React.MouseEvent;

      await act(async () => {
        fireCellEvent(result, "onContextMenu", "0", "name", mockEvent);
        await Promise.resolve();
      });

      expect(result.current.table.getContextMenu().open).toBe(true);
    });
  });

  describe("cell selection bounds", () => {
    it("should only count a range once more than the focused cell is selected", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.table.getHasCellRangeSelection()).toBe(false);

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
      });

      expect(result.current.table.getHasCellRangeSelection()).toBe(false);
      expect(result.current.table.getSelectedRangeCellCount()).toBe(0);

      act(() => {
        fireCellEvent(result, "onClick", "1", "trick", {
          shiftKey: true,
          preventDefault: vi.fn(),
        });
      });

      expect(result.current.table.getCellSelectionBounds()).toEqual([
        {
          minRowIndex: 0,
          maxRowIndex: 1,
          minColumnIndex: 0,
          maxColumnIndex: 1,
        },
      ]);
    });
  });

  describe("overscan configuration", () => {
    it("should use custom overscan value", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            overscan: 10,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.rowVirtualizerOptions.overscan).toBe(10);
    });
  });

  describe("enable paste flag", () => {
    it("should respect enablePaste flag", async () => {
      const onDataChange = vi.fn();
      mockClipboard.readText.mockResolvedValue("New Value");

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onDataChange,
            enablePaste: true,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
      });

      await act(async () => {
        await result.current.table.pasteCells();
      });

      expect(onDataChange).toHaveBeenCalled();
    });
  });

  describe("column operations", () => {
    it("should handle column resizing", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      const nameColumn = result.current.table.getColumn("name");

      act(() => {
        nameColumn?.resetSize();
      });

      expect(result.current.columnSizeVars["--col-name-size"]).toBeDefined();
    });

    it("should have min and max column sizes", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      const columns = result.current.table.getAllColumns();
      const nameColumn = columns.find((c) => c.id === "name");

      expect(nameColumn?.columnDef.minSize).toBeDefined();
      expect(nameColumn?.columnDef.maxSize).toBeDefined();
    });

    it("moves a column one place at a time and stops at the edges", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );
      const getOrder = () =>
        result.current.table.getVisibleLeafColumns().map(({ id }) => id);
      const nameColumn = result.current.table.getColumn("name");

      expect(nameColumn?.getCanMove(-1)).toBe(false);
      expect(nameColumn?.getCanMove(1)).toBe(true);

      act(() => {
        nameColumn?.move(1);
      });
      expect(getOrder().slice(0, 3)).toEqual(["trick", "name", "score"]);

      act(() => {
        nameColumn?.move(-1);
        nameColumn?.move(-1);
      });
      expect(getOrder().slice(0, 3)).toEqual(["name", "trick", "score"]);
    });

    it("keeps a pinned column's moves inside its pinned region", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            initialState: {
              columnPinning: { start: ["name", "trick"], end: [] },
            },
          }),
        { wrapper: createWrapper() },
      );
      const trickColumn = result.current.table.getColumn("trick");

      expect(trickColumn?.getCanMove(1)).toBe(false);

      act(() => {
        trickColumn?.move(-1);
      });
      expect(result.current.table.atoms.columnPinning.get().start).toEqual([
        "trick",
        "name",
      ]);
    });
  });

  describe("initial table state", () => {
    it("should start with no focus, editing, selection or menu", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      expect(getFocusedCell(result.current.table)).toBeNull();
      expect(result.current.table.getEditingCell()).toBeNull();
      expect(result.current.table.getSelectedRangeCellCount()).toBe(0);
      expect(result.current.table.getSearchOpen()).toBe(false);
      expect(result.current.table.getContextMenu().open).toBe(false);
    });

    it("should reflect readOnly on the table", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            readOnly: true,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.table.getIsReadOnly()).toBe(true);
    });
  });

  describe("batch data updates", () => {
    it("should handle empty update array", () => {
      const onDataChange = vi.fn();

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onDataChange,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.updateCells([]);
      });

      expect(onDataChange).not.toHaveBeenCalled();
    });

    it("should ignore updates to non-existent rows", () => {
      const onDataChange = vi.fn();

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onDataChange,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.updateCells({
          rowId: "999",
          columnId: "name",
          value: "Invalid",
        });
      });

      expect(onDataChange).not.toHaveBeenCalled();
    });
  });

  describe("clear selection on outside click", () => {
    it("should handle clicking on select column without clearing selection", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onMouseDown", "0", "name", {
          button: 0,
          preventDefault: vi.fn(),
        });
      });

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
      });

      expect(getFocusedCell(result.current.table)).toBeDefined();
    });
  });

  describe("createRow with error handling", () => {
    it("should not proceed if createRow throws an error", async () => {
      const createRow = vi.fn().mockRejectedValue(new Error("Failed to add"));

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            createRow,
          }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await result.current.onRowAdd?.();
      });

      expect(createRow).toHaveBeenCalled();
    });

    it("should not proceed if createRow returns null", async () => {
      const createRow = vi.fn().mockResolvedValue(null);

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            createRow,
          }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await result.current.onRowAdd?.();
      });

      expect(createRow).toHaveBeenCalled();
    });

    it("should add the created row at the end and focus its first data cell", async () => {
      const createRow = vi.fn(() => ({
        id: "4",
        name: "New",
        trick: "",
        score: 0,
      }));
      const onDataChange = vi.fn();

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            getRowId: (row) => row.id,
            createRow,
            onDataChange,
          }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await result.current.onRowAdd?.();
      });

      expect(createRow).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "add-row-press" }),
      );
      expect(
        onDataChange.mock.calls[0]?.[0]?.map((row: TestData) => row.id),
      ).toEqual(["1", "2", "3", "4"]);
      expect(getFocusedCell(result.current.table)).toEqual({
        rowId: "4",
        columnId: "name",
      });
    });
  });

  describe("double click behavior", () => {
    it("should start editing on double click", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
      });

      act(() => {
        fireCellEvent(result, "onDoubleClick", "0", "name");
      });

      expect(result.current.table.getEditingCell()).toEqual({
        rowId: "0",
        columnId: "name",
      });
    });
  });

  describe("insert row below", () => {
    it("should pass the focused row to createRow and keep the column on Shift+Enter", async () => {
      const createRow = vi.fn(() => ({
        id: "4",
        name: "New",
        trick: "",
        score: 0,
      }));
      const onDataChange = vi.fn();
      const tableRef: {
        current: ReturnType<typeof useDataGrid<TestData>>["table"] | null;
      } = { current: null };

      function InsertGrid() {
        const grid = useDataGrid({
          data: testData,
          columns: testColumns,
          getRowId: (row) => row.id,
          createRow,
          onDataChange,
        });
        tableRef.current = grid.table;
        return (
          <div ref={grid.dataGridRef} data-slot="data-grid" tabIndex={0} />
        );
      }

      const view = render(<InsertGrid />);
      const grid = view.container.querySelector<HTMLElement>(
        '[data-slot="data-grid"]',
      );

      act(() => {
        tableRef.current?.setFocusedCell("2", "trick");
      });
      await act(async () => {
        grid?.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            shiftKey: true,
            bubbles: true,
            cancelable: true,
          }),
        );
        await Promise.resolve();
      });

      expect(createRow).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "insert-below", afterRowId: "2" }),
      );
      expect(
        onDataChange.mock.calls[0]?.[0]?.map((row: TestData) => row.id),
      ).toEqual(["1", "2", "4", "3"]);
      expect(getFocusedCell(tableRef.current ?? undefined)).toEqual({
        rowId: "4",
        columnId: "trick",
      });
    });
  });

  describe("custom cells", () => {
    it("should render a column's own cell read-only unless it has a variant", () => {
      const columns: ColumnDef<DataGridFeatures, TestData>[] = [
        { id: "name", accessorKey: "name" },
        {
          id: "score",
          accessorKey: "score",
          cell: ({ getValue }) => `${String(getValue())} pts`,
        },
        {
          id: "trick",
          accessorKey: "trick",
          cell: () => "unused",
          meta: { cell: { variant: "short-text" } },
        },
      ];
      const { result } = renderHook(
        () => useDataGrid({ data: testData, columns }),
        { wrapper: createWrapper() },
      );
      const column = (id: string) => {
        const found = result.current.table.getColumn(id);
        if (!found) throw new Error(`Missing column ${id}`);
        return found;
      };

      expect(getHasCustomCell(column("name"))).toBe(false);
      expect(getHasCustomCell(column("score"))).toBe(true);
      expect(getHasCustomCell(column("trick"))).toBe(false);
      expect(column("name").getCanEdit()).toBe(true);
      expect(column("score").getCanEdit()).toBe(false);
      expect(column("trick").getCanEdit()).toBe(true);
    });
  });

  describe("row identity", () => {
    const sortedByScoreDesc = {
      data: testData,
      columns: testColumns,
      getRowId: (row: TestData) => row.id,
      initialState: { sorting: [{ id: "score", desc: true }] },
    };

    it("keeps focus on the same row when sorting changes", () => {
      const { result } = renderHook(() => useDataGrid(sortedByScoreDesc), {
        wrapper: createWrapper(),
      });

      act(() => {
        fireCellEvent(result, "onClick", "1", "name");
      });

      act(() => {
        result.current.table.setSorting([{ id: "score", desc: false }]);
      });

      expect(getFocusedCell(result.current.table)).toEqual({
        rowId: "1",
        columnId: "name",
      });
    });

    it("writes updates to the matching data row when sorted", () => {
      const onDataChange = vi.fn();
      const { result } = renderHook(
        () => useDataGrid({ ...sortedByScoreDesc, onDataChange }),
        { wrapper: createWrapper() },
      );

      expect(result.current.table.getRowModel().rows[0]?.id).toBe("2");

      act(() => {
        result.current.table.updateCells({
          rowId: "2",
          columnId: "score",
          value: 99,
        });
      });

      const updatedData = onDataChange.mock.calls[0]?.[0] as TestData[];
      expect(updatedData[1]).toMatchObject({ id: "2", score: 99 });
      expect(updatedData[0]).toBe(testData[0]);
      expect(updatedData[2]).toBe(testData[2]);
    });

    it("keeps changes the consumer doesn't pass back, until new data arrives", () => {
      const onDataChange = vi.fn();
      const { result, rerender } = renderHook(
        ({ data }: { data: TestData[] }) =>
          useDataGrid({
            data,
            columns: testColumns,
            getRowId: (row) => row.id,
            onDataChange,
          }),
        { initialProps: { data: testData }, wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.updateCells({
          rowId: "1",
          columnId: "name",
          value: "Edited",
        });
      });
      act(() => {
        result.current.table.addRows([
          { id: "new", name: "New", trick: "", score: 0 },
        ]);
      });

      expect(onDataChange).toHaveBeenCalledTimes(2);
      expect(result.current.table.getRow("1").getValue("name")).toBe("Edited");
      expect(result.current.table.getRowModel().rows).toHaveLength(
        testData.length + 1,
      );

      const nextData = testData.slice(0, 2);
      rerender({ data: nextData });
      expect(
        result.current.table.getRowModel().rows.map((row) => row.original),
      ).toEqual(nextData);
    });

    it("reports deleted rows through onDataChange", () => {
      const onDataChange = vi.fn();
      const { result } = renderHook(
        () => useDataGrid({ ...sortedByScoreDesc, onDataChange }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.table.deleteRows(["3", "missing"]);
      });

      expect(onDataChange).toHaveBeenCalledWith([testData[0], testData[1]], {
        reason: "delete-rows",
        changes: [],
        addedRows: [],
        removedRows: [testData[2]],
      });
    });

    it("copies a range in display order", async () => {
      const { result } = renderHook(() => useDataGrid(sortedByScoreDesc), {
        wrapper: createWrapper(),
      });

      act(() => {
        fireCellEvent(result, "onMouseDown", "2", "name", {
          button: 0,
          preventDefault: vi.fn(),
        });
      });

      act(() => {
        fireCellEvent(result, "onMouseOver", "1", "name");
      });

      await act(async () => {
        await result.current.table.copySelectedCells();
      });

      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        "Rodney Mullen\nTony Hawk",
      );
    });
  });
});

function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  };
}

function getFocusedCell(table: Table<DataGridFeatures, TestData> | undefined) {
  return getFocusedCellPosition(table?.atoms.cellSelection.get() ?? []);
}

function fireCellEvent(
  result: { current: ReturnType<typeof useDataGrid<TestData>> },
  type: GridBodyEventType,
  rowId: string,
  columnId: string,
  init: object = {},
) {
  const { dataGridRef, dataGridBodyProps } = result.current;
  const previousContainer = dataGridRef.current;
  const container = document.createElement("div");
  container.dataset.slot = "data-grid";
  const cellElement = document.createElement("div");
  cellElement.dataset.slot = "data-grid-cell";
  cellElement.dataset.rowId = rowId;
  cellElement.dataset.columnId = columnId;
  container.append(cellElement);
  dataGridRef.current = container;

  try {
    dataGridBodyProps[type]?.({
      target: cellElement,
      currentTarget: container,
      button: 0,
      clientX: 0,
      clientY: 0,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      defaultPrevented: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      ...init,
    } as unknown as React.MouseEvent<HTMLDivElement>);
  } finally {
    dataGridRef.current = previousContainer;
  }
}

function startEditing(
  table: ReturnType<typeof useDataGrid<TestData>>["table"],
  rowId: string,
  columnId: string,
) {
  const cellsByColumnId = table
    .getCoreRowModel()
    .rowsById[rowId]?.getAllCellsByColumnId();
  cellsByColumnId?.[columnId]?.startEditing();
}

function getSelectedCellKeys(
  table: Table<DataGridFeatures, TestData> | undefined,
) {
  return (table?.getSelectedCells() ?? []).map(({ rowId, columnId }) =>
    getCellKey(rowId, columnId),
  );
}
