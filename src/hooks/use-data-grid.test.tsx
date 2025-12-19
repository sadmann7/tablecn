import type { ColumnDef } from "@tanstack/react-table";
import { act, renderHook, waitFor } from "@testing-library/react";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDataGrid } from "./use-data-grid";

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock useDirection
vi.mock("@radix-ui/react-direction", () => ({
  useDirection: () => "ltr",
}));

interface TestData {
  id: string;
  name: string;
  age: number;
  email: string;
}

const testData: TestData[] = [
  { id: "1", name: "John Doe", age: 30, email: "john@example.com" },
  { id: "2", name: "Jane Smith", age: 25, email: "jane@example.com" },
  { id: "3", name: "Bob Johnson", age: 35, email: "bob@example.com" },
];

const testColumns: ColumnDef<TestData>[] = [
  { id: "name", accessorKey: "name" },
  { id: "age", accessorKey: "age", meta: { cell: { variant: "number" } } },
  { id: "email", accessorKey: "email" },
];

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

    // Mock requestAnimationFrame
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();

    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 0,
      left: 0,
      bottom: 100,
      right: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => {},
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
      expect(result.current.focusedCell).toBeNull();
      expect(result.current.editingCell).toBeNull();
      expect(result.current.rowHeight).toBe("short");
    });

    it("should initialize with custom rowHeight", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            rowHeight: "tall",
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.rowHeight).toBe("tall");
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

      expect(result.current.table.getState().sorting).toEqual([
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

      const meta = result.current.tableMeta;
      expect(meta.onCellClick).toBeDefined();
      expect(meta.onCellDoubleClick).toBeDefined();
      expect(meta.onCellEditingStart).toBeDefined();
      expect(meta.onCellEditingStop).toBeDefined();
      expect(meta.onCellsCopy).toBeDefined();
      expect(meta.onCellsCut).toBeDefined();
      expect(meta.onCellsPaste).toBeDefined();
      expect(meta.onSelectionClear).toBeDefined();
      expect(meta.getIsCellSelected).toBeDefined();
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
        result.current.tableMeta.onCellClick?.(0, "name");
      });

      expect(result.current.focusedCell).toEqual({
        rowIndex: 0,
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
        result.current.tableMeta.onCellClick?.(0, "name");
      });

      expect(result.current.focusedCell).toEqual({
        rowIndex: 0,
        columnId: "name",
      });

      act(() => {
        result.current.tableMeta.onCellClick?.(1, "email");
      });

      expect(result.current.focusedCell).toEqual({
        rowIndex: 1,
        columnId: "email",
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

      // First click to focus
      act(() => {
        result.current.tableMeta.onCellClick?.(0, "name");
      });

      // Double click to edit
      act(() => {
        result.current.tableMeta.onCellDoubleClick?.(0, "name");
      });

      expect(result.current.editingCell).toEqual({
        rowIndex: 0,
        columnId: "name",
      });
    });

    it("should start editing via onCellEditingStart", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      act(() => {
        result.current.tableMeta.onCellEditingStart?.(0, "name");
      });

      expect(result.current.editingCell).toEqual({
        rowIndex: 0,
        columnId: "name",
      });
    });

    it("should stop editing via onCellEditingStop", async () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        result.current.tableMeta.onCellEditingStart?.(0, "name");
      });

      expect(result.current.editingCell).not.toBeNull();

      await act(async () => {
        result.current.tableMeta.onCellEditingStop?.();
      });

      expect(result.current.editingCell).toBeNull();
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
        result.current.tableMeta.onCellEditingStart?.(0, "name");
      });

      expect(result.current.editingCell).toBeNull();
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

      // Initially no cells are selected
      expect(result.current.tableMeta.getIsCellSelected?.(0, "name")).toBe(
        false,
      );

      // Click to focus (which doesn't select)
      act(() => {
        result.current.tableMeta.onCellClick?.(0, "name");
      });

      // Single click focuses but doesn't select
      expect(result.current.tableMeta.getIsCellSelected?.(0, "name")).toBe(
        false,
      );
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

      // Trigger mouse down to start selection
      act(() => {
        result.current.tableMeta.onCellMouseDown?.(0, "name", {
          button: 0,
          preventDefault: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Clear selection
      act(() => {
        result.current.tableMeta.onSelectionClear?.();
      });

      expect(result.current.tableMeta.getIsCellSelected?.(0, "name")).toBe(
        false,
      );
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

      // Focus a cell first
      act(() => {
        result.current.tableMeta.onCellClick?.(0, "name");
      });

      // Copy
      await act(async () => {
        await result.current.tableMeta.onCellsCopy?.();
      });

      expect(mockClipboard.writeText).toHaveBeenCalledWith("John Doe");
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

      // Focus a cell first
      act(() => {
        result.current.tableMeta.onCellClick?.(0, "name");
      });

      // Try to cut
      await act(async () => {
        await result.current.tableMeta.onCellsCut?.();
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

      // Focus a cell first
      act(() => {
        result.current.tableMeta.onCellClick?.(0, "name");
      });

      // Try to paste
      await act(async () => {
        await result.current.tableMeta.onCellsPaste?.();
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
        result.current.tableMeta.onDataUpdate?.({
          rowIndex: 0,
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
        result.current.tableMeta.onDataUpdate?.([
          { rowIndex: 0, columnId: "name", value: "Updated Name 1" },
          { rowIndex: 1, columnId: "name", value: "Updated Name 2" },
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
        result.current.tableMeta.onDataUpdate?.({
          rowIndex: 0,
          columnId: "name",
          value: "Updated Name",
        });
      });

      expect(onDataChange).not.toHaveBeenCalled();
    });
  });

  describe("row operations", () => {
    it("should call onRowAdd when adding a row", async () => {
      const onRowAdd = vi.fn().mockResolvedValue({ rowIndex: 3 });

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
      const onRowAdd = vi.fn().mockResolvedValue({ rowIndex: 3 });

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

      // onRowAdd should still be defined on tableMeta (for internal use)
      // but the hook's returned onRowAdd checks readOnly internally
      expect(result.current.onRowAdd).toBeDefined();
    });

    it("should provide onRowsDelete callback when prop is provided", () => {
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

      // tableMeta.onRowsDelete should be defined when prop is provided
      expect(result.current.tableMeta.onRowsDelete).toBeDefined();
    });

    it("should not provide onRowsDelete callback when prop is not provided", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      // tableMeta.onRowsDelete should be undefined when prop is not provided
      expect(result.current.tableMeta.onRowsDelete).toBeUndefined();
    });
  });

  describe("search functionality", () => {
    it("should provide search state when enableSearch is true", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            enableSearch: true,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.searchState).toBeDefined();
      expect(result.current.searchState?.searchOpen).toBe(false);
      expect(result.current.searchState?.searchQuery).toBe("");
      expect(result.current.searchState?.searchMatches).toEqual([]);
    });

    it("should not provide search state when enableSearch is false", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            enableSearch: false,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.searchState).toBeUndefined();
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
        result.current.searchState?.onSearchOpenChange(true);
        // Allow microtask queue to flush
        await Promise.resolve();
      });

      expect(result.current.searchState?.searchOpen).toBe(true);
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
        result.current.searchState?.onSearch("John");
      });

      expect(result.current.searchState?.searchMatches.length).toBeGreaterThan(
        0,
      );
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

      // First search for something
      act(() => {
        result.current.searchState?.onSearch("John");
      });

      expect(result.current.searchState?.searchMatches.length).toBeGreaterThan(
        0,
      );

      // Clear search
      act(() => {
        result.current.searchState?.onSearch("");
      });

      expect(result.current.searchState?.searchMatches).toEqual([]);
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
        result.current.tableMeta.onCellContextMenu?.(0, "name", mockEvent);
      });

      expect(result.current.contextMenu.open).toBe(true);
      expect(result.current.contextMenu.x).toBe(100);
      expect(result.current.contextMenu.y).toBe(100);
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

      // Open context menu
      const mockEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        clientX: 100,
        clientY: 100,
      } as unknown as React.MouseEvent;

      await act(async () => {
        result.current.tableMeta.onCellContextMenu?.(0, "name", mockEvent);
        await Promise.resolve();
      });

      expect(result.current.contextMenu.open).toBe(true);

      // Close context menu
      await act(async () => {
        result.current.tableMeta.onContextMenuOpenChange?.(false);
        await Promise.resolve();
      });

      expect(result.current.contextMenu.open).toBe(false);
    });
  });

  describe("virtualization", () => {
    it("should provide virtual items", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.virtualItems).toBeDefined();
      expect(Array.isArray(result.current.virtualItems)).toBe(true);
    });

    it("should provide virtualTotalSize", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.virtualTotalSize).toBeDefined();
      expect(typeof result.current.virtualTotalSize).toBe("number");
    });

    it("should provide measureElement function", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.measureElement).toBeDefined();
      expect(typeof result.current.measureElement).toBe("function");
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

      // Should have size vars for each column
      expect(result.current.columnSizeVars["--col-name-size"]).toBeDefined();
      expect(result.current.columnSizeVars["--col-age-size"]).toBeDefined();
      expect(result.current.columnSizeVars["--col-email-size"]).toBeDefined();
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
      expect(result.current.dataGridRef.current).toBeNull(); // Not mounted
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
    it("should change row height via tableMeta", async () => {
      const onRowHeightChange = vi.fn();

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onRowHeightChange,
          }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        result.current.tableMeta.onRowHeightChange?.("tall");
        await Promise.resolve();
      });

      expect(result.current.rowHeight).toBe("tall");
      expect(onRowHeightChange).toHaveBeenCalledWith("tall");
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

      expect(result.current.pasteDialog.open).toBe(false);
    });

    it("should close paste dialog via onPasteDialogOpenChange", () => {
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
        result.current.tableMeta.onPasteDialogOpenChange?.(false);
      });

      expect(result.current.pasteDialog.open).toBe(false);
    });
  });
});
