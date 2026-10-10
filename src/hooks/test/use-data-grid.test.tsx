import type { ColumnDef, SortingState, Table } from "@tanstack/react-table";
import type * as React from "react";

import { act, render, renderHook } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import {
  getCellKey,
  getFocusedCellPosition,
  stringifyUnknown,
} from "@/lib/data-grid-utils";
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

type GridBodyEventType =
  | "onClick"
  | "onDoubleClick"
  | "onMouseDown"
  | "onMouseOver"
  | "onMouseUp"
  | "onContextMenu";

function getFocusedCell(table: Table<DataGridFeatures, TestData> | undefined) {
  return getFocusedCellPosition(table?.atoms.cellSelection.get() ?? []);
}

function getSelectedCellKeys(
  table: Table<DataGridFeatures, TestData> | undefined,
) {
  return (table?.getSelectedCells() ?? []).map(({ rowId, columnId }) =>
    getCellKey(rowId, columnId),
  );
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
  cellElement.dataset.slot = "data-grid-cell-wrapper";
  cellElement.dataset.rowId = rowId;
  cellElement.dataset.columnId = columnId;
  container.append(cellElement);
  dataGridRef.current = container;

  try {
    dataGridBodyProps[type]({
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
    } as unknown as React.MouseEvent<HTMLElement>);
  } finally {
    dataGridRef.current = previousContainer;
  }
}

function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  };
}

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

    // Run animation frames immediately so effects finish inside `act`.
    // Frames requested from inside a frame are dropped so self-scheduling loops terminate.
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
        result.current.table.updateCells({
          rowId: "0",
          columnId: "name",
          value: "Changed",
        });
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
        result.current.table.updateCells([
          { rowId: "0", columnId: "name", value: "Changed" },
          { rowId: "0", columnId: "trick", value: "Ollie" },
        ]);
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
        } as unknown as React.MouseEvent);
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
        } as unknown as React.MouseEvent);
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
        } as unknown as React.MouseEvent);
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
        } as unknown as React.MouseEvent);
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
        } as unknown as React.MouseEvent);
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
        } as unknown as React.MouseEvent);
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
      );
    });

    it("should not update data in readOnly mode", () => {
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

      expect(onDataChange).not.toHaveBeenCalled();
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
    it("should call onRowAdd when adding a row", async () => {
      const onRowAdd = vi.fn().mockResolvedValue({ rowId: "3" });

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onRowAdd,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.onRowAdd).toBeDefined();

      await act(async () => {
        await result.current.onRowAdd?.();
      });

      expect(onRowAdd).toHaveBeenCalled();
    });

    it("should not provide onRowAdd in readOnly mode", () => {
      const onRowAdd = vi.fn().mockResolvedValue({ rowId: "3" });

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onRowAdd,
            readOnly: true,
          }),
        { wrapper: createWrapper() },
      );

      // The returned onRowAdd checks readOnly internally
      expect(result.current.onRowAdd).toBeDefined();
    });

    it("should delete rows and focus the row that takes their place", async () => {
      const onRowsDelete = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onRowsDelete,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onClick", "0", "trick");
      });

      await act(async () => {
        await result.current.table.deleteRows(["0"]);
      });

      expect(onRowsDelete).toHaveBeenCalledWith([testData[0]], ["0"]);
      expect(getFocusedCell(result.current.table)).toEqual({
        rowId: "1",
        columnId: "trick",
      });
    });

    it("should not delete rows without onRowsDelete or when read-only", async () => {
      const onRowsDelete = vi.fn();

      const { result, rerender } = renderHook(
        ({ readOnly }) =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onRowsDelete: readOnly === undefined ? undefined : onRowsDelete,
            readOnly,
          }),
        {
          wrapper: createWrapper(),
          initialProps: { readOnly: undefined as boolean | undefined },
        },
      );

      await act(async () => {
        await result.current.table.deleteRows(["0"]);
      });

      rerender({ readOnly: true });

      await act(async () => {
        await result.current.table.deleteRows(["0"]);
      });

      expect(onRowsDelete).not.toHaveBeenCalled();
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
        // Allow microtask queue to flush
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

      // Close it (even though it's already closed, this tests the callback)
      act(() => {
        result.current.table.resetPasteDialog(true);
      });

      expect(result.current.table.getPasteDialog().open).toBe(false);
    });
  });

  describe("clipboard feature", () => {
    it("should ask before adding rows a paste needs", async () => {
      const onRowsAdd = vi.fn();
      mockClipboard.readText.mockResolvedValue("a\nb\nc");

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onRowsAdd,
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
      expect(onRowsAdd).not.toHaveBeenCalled();
    });

    it("should paste only what fits when the dialog declines new rows", async () => {
      const onRowsAdd = vi.fn();
      const onDataChange = vi.fn();
      mockClipboard.readText.mockResolvedValue("a\nb\nc");

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onRowsAdd,
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

      expect(onRowsAdd).not.toHaveBeenCalled();
      expect(onDataChange).toHaveBeenCalledTimes(1);
      expect(onDataChange.mock.calls[0]?.[0][2].name).toBe("a");
      expect(result.current.table.getPasteDialog().open).toBe(false);
    });

    it("should add rows through onRowsAdd when expanding", async () => {
      const onRowsAdd = vi.fn();
      mockClipboard.readText.mockResolvedValue("a\nb");
      vi.useFakeTimers();

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onRowsAdd,
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

      expect(onRowsAdd).toHaveBeenCalledWith(1);
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
      const onRowAdd = vi.fn().mockResolvedValue({ rowId: "3" });

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onDataChange,
            onRowAdd,
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

    it("should call onPaste callback when provided", async () => {
      const onPaste = vi.fn().mockResolvedValue(undefined);
      mockClipboard.readText.mockResolvedValue("New Name");

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onPaste,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
      });

      await act(async () => {
        await result.current.table.pasteCells();
      });

      expect(onPaste).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            rowId: "0",
            columnId: "name",
            value: "New Name",
          }),
        ]),
      );
    });

    it("should preserve multiline content within cells when pasting", async () => {
      const onPaste = vi.fn().mockResolvedValue(undefined);
      mockClipboard.readText.mockResolvedValue(
        'Alice\tKickflip\t95\nBob\t"Trick with\nmultiple\nlines"\t98',
      );

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onPaste,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
      });

      await act(async () => {
        await result.current.table.pasteCells();
      });

      expect(onPaste).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            rowId: "0",
            columnId: "score",
            value: 95,
          }),
          expect.objectContaining({
            rowId: "1",
            columnId: "trick",
            value: "Trick with\nmultiple\nlines",
          }),
          expect.objectContaining({
            rowId: "1",
            columnId: "score",
            value: 98,
          }),
        ]),
      );
    });

    it("should preserve unquoted multiline content when pasting (Excel format)", async () => {
      const onPaste = vi.fn().mockResolvedValue(undefined);
      mockClipboard.readText.mockResolvedValue(
        "Alice\tKickflip\t95\nBob\tTrick with\nmultiple\nlines\t98",
      );

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onPaste,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
      });

      await act(async () => {
        await result.current.table.pasteCells();
      });

      expect(onPaste).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            rowId: "0",
            columnId: "score",
            value: 95,
          }),
          expect.objectContaining({
            rowId: "1",
            columnId: "trick",
            value: "Trick with\nmultiple\nlines",
          }),
          expect.objectContaining({
            rowId: "1",
            columnId: "score",
            value: 98,
          }),
        ]),
      );
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
        } as unknown as React.MouseEvent);
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
        } as unknown as React.MouseEvent);
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
        } as unknown as React.MouseEvent);
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
        } as unknown as React.MouseEvent);
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
      // Initialize the hook with the synchronous RAF from beforeEach so that
      // all setup effects complete before we take over RAF scheduling.
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
      // calling onAutoScrollStop (which would remove the listener).
      const pendingRafs: FrameRequestCallback[] = [];
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
        pendingRafs.push(cb);
        return pendingRafs.length;
      });
      vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

      // Give onAutoScrollStart a real container so it doesn't bail early.
      const mockContainer = document.createElement("div");
      result.current.dataGridRef.current = mockContainer;

      // Start the drag — this sets dragStartCell which triggers
      // onAutoScrollStart, which synchronously registers the document mouseup
      // listener before queuing the deferred RAF.
      act(() => {
        fireCellEvent(result, "onMouseDown", "0", "name", {
          button: 0,
          preventDefault: vi.fn(),
          ctrlKey: false,
          metaKey: false,
          shiftKey: false,
        } as unknown as React.MouseEvent);
      });

      act(() => {
        fireCellEvent(result, "onMouseOver", "1", "score");
      });

      expect(result.current.table.getIsCellSelected("0", "name")).toBe(true);

      // Simulate the user releasing the mouse outside the grid.  The
      // document-level mouseup listener (registered by onAutoScrollStart)
      // should clear dragStartCell.
      act(() => {
        document.dispatchEvent(new MouseEvent("mouseup"));
      });

      // A subsequent onCellMouseEnter must be a no-op because the drag has
      // ended — so row 2 should never enter the selected set.
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
        } as unknown as React.MouseEvent);
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
    it("should provide onFilesUpload when prop is provided", () => {
      const onFilesUpload = vi.fn().mockResolvedValue([]);

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onFilesUpload,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.table.options.onFilesUpload).toBeDefined();
    });

    it("should not provide onFilesUpload when prop is not provided", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.table.options.onFilesUpload).toBeUndefined();
    });

    it("should provide onFilesDelete when prop is provided", () => {
      const onFilesDelete = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onFilesDelete,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.table.options.onFilesDelete).toBeDefined();
    });

    it("should not provide onFilesDelete when prop is not provided", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.table.options.onFilesDelete).toBeUndefined();
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
        } as unknown as React.MouseEvent);
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
        } as unknown as React.MouseEvent);
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
        } as unknown as React.MouseEvent);
      });

      act(() => {
        fireCellEvent(result, "onClick", "0", "name");
      });

      expect(getFocusedCell(result.current.table)).toBeDefined();
    });
  });

  describe("onRowAdd with error handling", () => {
    it("should not proceed if onRowAdd throws an error", async () => {
      const onRowAdd = vi.fn().mockRejectedValue(new Error("Failed to add"));

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onRowAdd,
          }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await result.current.onRowAdd?.();
      });

      expect(onRowAdd).toHaveBeenCalled();
    });

    it("should not proceed if onRowAdd returns null", async () => {
      const onRowAdd = vi.fn().mockResolvedValue(null);

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onRowAdd,
          }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await result.current.onRowAdd?.();
      });

      expect(onRowAdd).toHaveBeenCalled();
    });

    it("should not proceed if event is defaultPrevented", async () => {
      const onRowAdd = vi.fn().mockResolvedValue({ rowId: "3" });

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onRowAdd,
          }),
        { wrapper: createWrapper() },
      );

      const mockEvent = {
        defaultPrevented: true,
      } as React.MouseEvent<HTMLDivElement>;

      await act(async () => {
        await result.current.onRowAdd?.(mockEvent);
      });

      expect(onRowAdd).toHaveBeenCalled();
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

    it("passes the deleted rows and their ids to onRowsDelete", async () => {
      const onRowsDelete = vi.fn();
      const { result } = renderHook(
        () => useDataGrid({ ...sortedByScoreDesc, onRowsDelete }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await result.current.table.deleteRows(["3", "missing"]);
      });

      expect(onRowsDelete).toHaveBeenCalledWith([testData[2]], ["3"]);
    });

    it("copies a range in display order", async () => {
      const { result } = renderHook(() => useDataGrid(sortedByScoreDesc), {
        wrapper: createWrapper(),
      });

      act(() => {
        fireCellEvent(result, "onMouseDown", "2", "name", {
          button: 0,
          preventDefault: vi.fn(),
        } as unknown as React.MouseEvent);
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
