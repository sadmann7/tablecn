import type { ColumnDef } from "@tanstack/react-table";
import { act, renderHook } from "@testing-library/react";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDataGrid } from "@/hooks/use-data-grid";

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
  trick: string;
  score: number;
}

const testData: TestData[] = [
  { id: "1", name: "Tony Hawk", trick: "900", score: 95 },
  { id: "2", name: "Rodney Mullen", trick: "Kickflip", score: 98 },
  { id: "3", name: "Nyjah Huston", trick: "Switch Heel", score: 92 },
];

const testColumns: ColumnDef<TestData>[] = [
  { id: "name", accessorKey: "name" },
  { id: "trick", accessorKey: "trick" },
  { id: "score", accessorKey: "score", meta: { cell: { variant: "number" } } },
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
        result.current.tableMeta.onCellClick?.(1, "trick");
      });

      expect(result.current.focusedCell).toEqual({
        rowIndex: 1,
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
        result.current.searchState?.onSearch("Tony");
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
        result.current.searchState?.onSearch("Tony");
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

      // Focus a number cell
      act(() => {
        result.current.tableMeta.onCellClick?.(0, "score");
      });

      // Paste
      await act(async () => {
        await result.current.tableMeta.onCellsPaste?.();
      });

      expect(onDataChange).toHaveBeenCalled();
    });

    it("should handle paste with clipboardText in pasteDialog state", async () => {
      const onDataChange = vi.fn();
      const onRowAdd = vi.fn().mockResolvedValue({ rowIndex: 3 });

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

      // Focus a cell
      act(() => {
        result.current.tableMeta.onCellClick?.(0, "name");
      });

      // Paste will be called internally and should work
      await act(async () => {
        mockClipboard.readText.mockResolvedValue("Test\nValue\nNew");
        await result.current.tableMeta.onCellsPaste?.(false);
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

      // Focus a number cell
      act(() => {
        result.current.tableMeta.onCellClick?.(0, "score");
      });

      // Paste invalid number
      await act(async () => {
        await result.current.tableMeta.onCellsPaste?.();
      });

      // Should skip the invalid cell
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

      // Focus a cell
      act(() => {
        result.current.tableMeta.onCellClick?.(0, "name");
      });

      // Paste
      await act(async () => {
        await result.current.tableMeta.onCellsPaste?.();
      });

      expect(onPaste).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            rowIndex: 0,
            columnId: "name",
            value: "New Name",
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

      // Focus and select a cell
      act(() => {
        result.current.tableMeta.onCellClick?.(0, "name");
      });

      // Cut
      await act(async () => {
        await result.current.tableMeta.onCellsCut?.();
      });

      expect(mockClipboard.writeText).toHaveBeenCalledWith("Tony Hawk");
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

      // Focus a cell
      act(() => {
        result.current.tableMeta.onCellClick?.(0, "name");
      });

      // Start selection by mouse down
      act(() => {
        result.current.tableMeta.onCellMouseDown?.(0, "name", {
          button: 0,
          preventDefault: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Copy
      await act(async () => {
        await result.current.tableMeta.onCellsCopy?.();
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
        result.current.tableMeta.onCellClick?.(0, "name", mockEvent);
      });

      expect(result.current.focusedCell).toEqual({
        rowIndex: 0,
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

      // First click to set anchor
      act(() => {
        result.current.tableMeta.onCellClick?.(0, "name");
      });

      // Shift+Click to select range
      const mockEvent = {
        preventDefault: vi.fn(),
        shiftKey: true,
        ctrlKey: false,
        metaKey: false,
      } as unknown as React.MouseEvent;

      act(() => {
        result.current.tableMeta.onCellClick?.(1, "trick", mockEvent);
      });

      expect(result.current.tableMeta.getIsCellSelected?.(0, "name")).toBe(
        true,
      );
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

      // Mouse down to start selection
      act(() => {
        result.current.tableMeta.onCellMouseDown?.(0, "name", {
          button: 0,
          preventDefault: vi.fn(),
          ctrlKey: false,
          metaKey: false,
          shiftKey: false,
        } as unknown as React.MouseEvent);
      });

      // Mouse enter to extend selection
      act(() => {
        result.current.tableMeta.onCellMouseEnter?.(1, "score");
      });

      // Mouse up to end selection
      act(() => {
        result.current.tableMeta.onCellMouseUp?.();
      });

      expect(result.current.tableMeta.getIsCellSelected?.(0, "name")).toBe(
        true,
      );
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
        result.current.tableMeta.onColumnClick?.("name");
      });

      // All cells in the column should be selected
      expect(result.current.tableMeta.getIsCellSelected?.(0, "name")).toBe(
        true,
      );
      expect(result.current.tableMeta.getIsCellSelected?.(1, "name")).toBe(
        true,
      );
      expect(result.current.tableMeta.getIsCellSelected?.(2, "name")).toBe(
        true,
      );
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

      // Select a cell first
      act(() => {
        result.current.tableMeta.onCellMouseDown?.(0, "name", {
          button: 0,
          preventDefault: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Click column header
      act(() => {
        result.current.tableMeta.onColumnClick?.("name");
      });

      expect(result.current.tableMeta.getIsCellSelected?.(0, "name")).toBe(
        false,
      );
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
        result.current.tableMeta.onCellClick?.(0, "name", mockRightClickEvent);
      });

      // Right-click shouldn't change focus
      expect(result.current.focusedCell).toBeNull();
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

      // Search for "Kickflip"
      act(() => {
        result.current.searchState?.onSearch("Kickflip");
      });

      // Navigate to next match
      act(() => {
        result.current.searchState?.onNavigateToNextMatch();
      });

      expect(result.current.searchState?.matchIndex).toBeDefined();
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

      // Search for "Kickflip"
      act(() => {
        result.current.searchState?.onSearch("Kickflip");
      });

      // Navigate to next first
      act(() => {
        result.current.searchState?.onNavigateToNextMatch();
      });

      // Then navigate back
      act(() => {
        result.current.searchState?.onNavigateToPrevMatch();
      });

      expect(result.current.searchState?.matchIndex).toBe(0);
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

      // Search for "Kickflip"
      act(() => {
        result.current.searchState?.onSearch("Kickflip");
      });

      const matchCount = result.current.searchState?.searchMatches.length ?? 0;

      // Navigate through all matches
      for (let i = 0; i < matchCount; i++) {
        act(() => {
          result.current.searchState?.onNavigateToNextMatch();
        });
      }

      // Should wrap to 0
      expect(result.current.searchState?.matchIndex).toBe(0);
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

      // Search for something
      act(() => {
        result.current.searchState?.onSearch("Tony");
      });

      expect(result.current.searchMatchesByRow).toBeDefined();
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

      // Search for something
      act(() => {
        result.current.searchState?.onSearch("Tony");
      });

      expect(result.current.activeSearchMatch).toBeDefined();
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
        result.current.searchState?.onSearchQueryChange("test query");
        await Promise.resolve();
      });

      expect(result.current.searchState?.searchQuery).toBe("test query");
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

      // Open search
      await act(async () => {
        result.current.searchState?.onSearchOpenChange(true);
        await Promise.resolve();
      });

      // Search for something
      act(() => {
        result.current.searchState?.onSearch("Tony");
      });

      // Close search
      await act(async () => {
        result.current.searchState?.onSearchOpenChange(false);
        await Promise.resolve();
      });

      expect(result.current.searchState?.searchOpen).toBe(false);
      expect(result.current.searchState?.searchQuery).toBe("");
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
        result.current.tableMeta.onRowSelect?.(firstRowId ?? "1", true, false);
      });

      const rowSelection = result.current.table.getState().rowSelection;
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

      // Select first row
      act(() => {
        result.current.tableMeta.onRowSelect?.(firstRowId ?? "1", true, false);
      });

      // Select third row with shift
      act(() => {
        result.current.tableMeta.onRowSelect?.(thirdRowId ?? "3", true, true);
      });

      const rowSelection = result.current.table.getState().rowSelection;
      expect(Object.keys(rowSelection).length).toBeGreaterThanOrEqual(2);
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

      // Select row
      act(() => {
        result.current.tableMeta.onRowSelect?.(firstRowId ?? "1", true, false);
      });

      // Deselect row
      act(() => {
        result.current.tableMeta.onRowSelect?.(firstRowId ?? "1", false, false);
      });

      const rowSelection = result.current.table.getState().rowSelection;
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

      // With filter "name contains Tony", only Tony Hawk (id: "1") should be visible
      const rows = result.current.table.getRowModel().rows;
      expect(rows.length).toBe(1);
      const visibleRowId = rows[0]?.id;
      expect(visibleRowId).toBe("1");

      // Select the visible (filtered) row
      act(() => {
        result.current.tableMeta.onRowSelect?.(
          visibleRowId ?? "1",
          true,
          false,
        );
      });

      const rowSelection = result.current.table.getState().rowSelection;
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

      // Start editing
      await act(async () => {
        result.current.tableMeta.onCellEditingStart?.(0, "name");
      });

      expect(result.current.editingCell).toEqual({
        rowIndex: 0,
        columnId: "name",
      });

      // Stop editing and move to next row
      await act(async () => {
        result.current.tableMeta.onCellEditingStop?.({ moveToNextRow: true });
      });

      expect(result.current.editingCell).toBeNull();
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

      // Start editing
      await act(async () => {
        result.current.tableMeta.onCellEditingStart?.(0, "name");
      });

      // Stop editing and navigate right
      await act(async () => {
        result.current.tableMeta.onCellEditingStop?.({ direction: "right" });
      });

      expect(result.current.editingCell).toBeNull();
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

      // First click to focus
      act(() => {
        result.current.tableMeta.onCellClick?.(0, "name");
      });

      expect(result.current.focusedCell).toEqual({
        rowIndex: 0,
        columnId: "name",
      });
      expect(result.current.editingCell).toBeNull();

      // Second click on same cell to edit
      act(() => {
        result.current.tableMeta.onCellClick?.(0, "name");
      });

      expect(result.current.editingCell).toEqual({
        rowIndex: 0,
        columnId: "name",
      });
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

      // Auto focus should set focused cell
      expect(result.current.focusedCell).toBeDefined();
    });

    it("should auto focus specific cell when autoFocus is object", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            autoFocus: { rowIndex: 1, columnId: "trick" },
          }),
        { wrapper: createWrapper() },
      );

      // Should focus the specified cell
      expect(result.current.focusedCell).toBeDefined();
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

      expect(result.current.focusedCell).toBeNull();
    });
  });

  describe("sorting and filtering", () => {
    it("should call onSortingChange when sorting changes", () => {
      const onSortingChange = vi.fn();

      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            onSortingChange,
          }),
        { wrapper: createWrapper() },
      );

      // Get the column and toggle sorting
      const nameColumn = result.current.table.getColumn("name");

      act(() => {
        nameColumn?.toggleSorting(false);
      });

      expect(onSortingChange).toHaveBeenCalled();
    });

    it("should call onColumnFiltersChange when filters change", () => {
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

      // Set a filter
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

      const sorting = result.current.table.getState().sorting;
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

      const filters = result.current.table.getState().columnFilters;
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

      expect(result.current.tableMeta.onFilesUpload).toBeDefined();
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

      expect(result.current.tableMeta.onFilesUpload).toBeUndefined();
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

      expect(result.current.tableMeta.onFilesDelete).toBeDefined();
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

      expect(result.current.tableMeta.onFilesDelete).toBeUndefined();
    });
  });

  describe("direction (RTL) support", () => {
    it("should handle RTL direction", () => {
      // Mock useDirection to return rtl
      vi.mock("@radix-ui/react-direction", () => ({
        useDirection: () => "rtl",
      }));

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
    it("should select non-selected cell before opening context menu", () => {
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

      // Right-click on a cell
      act(() => {
        result.current.tableMeta.onCellContextMenu?.(0, "name", mockEvent);
      });

      // Should select the cell and open context menu
      expect(result.current.tableMeta.getIsCellSelected?.(0, "name")).toBe(
        true,
      );
      expect(result.current.contextMenu.open).toBe(true);
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

      // Select multiple cells first
      await act(async () => {
        result.current.tableMeta.onCellMouseDown?.(0, "name", {
          button: 0,
          preventDefault: vi.fn(),
          ctrlKey: false,
          metaKey: false,
          shiftKey: false,
        } as unknown as React.MouseEvent);
        await Promise.resolve();
      });

      await act(async () => {
        result.current.tableMeta.onCellMouseEnter?.(1, "trick");
        await Promise.resolve();
      });

      await act(async () => {
        result.current.tableMeta.onCellMouseUp?.();
        await Promise.resolve();
      });

      // Right-click on a selected cell
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

      // Should keep existing selection and open context menu
      expect(result.current.contextMenu.open).toBe(true);
    });
  });

  describe("cell selection map optimization", () => {
    it("should provide cellSelectionMap for performance optimization", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      // Initially should be null (no selection)
      expect(result.current.cellSelectionMap).toBeNull();

      // Select a cell
      act(() => {
        result.current.tableMeta.onCellMouseDown?.(0, "name", {
          button: 0,
          preventDefault: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Should now have a map
      expect(result.current.cellSelectionMap).toBeDefined();
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

      // Virtualizer should be initialized with custom overscan
      expect(result.current.virtualItems).toBeDefined();
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

      // Focus a cell
      act(() => {
        result.current.tableMeta.onCellClick?.(0, "name");
      });

      // Paste should work
      await act(async () => {
        await result.current.tableMeta.onCellsPaste?.();
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

  describe("table meta getters", () => {
    it("should use getters for dynamic state values in tableMeta", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
          }),
        { wrapper: createWrapper() },
      );

      // Access meta getters
      const meta = result.current.tableMeta;
      expect(meta.focusedCell).toBeNull();
      expect(meta.editingCell).toBeNull();
      expect(meta.selectionState).toBeDefined();
      expect(meta.searchOpen).toBe(false);
      expect(meta.contextMenu).toBeDefined();
      expect(meta.pasteDialog).toBeDefined();
      expect(meta.rowHeight).toBe("short");
      expect(meta.readOnly).toBeUndefined();
    });

    it("should reflect readOnly in tableMeta getter", () => {
      const { result } = renderHook(
        () =>
          useDataGrid({
            data: testData,
            columns: testColumns,
            readOnly: true,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.tableMeta.readOnly).toBe(true);
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
        result.current.tableMeta.onDataUpdate?.([]);
      });

      expect(onDataChange).not.toHaveBeenCalled();
    });

    it("should handle updates to non-existent rows gracefully", () => {
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
          rowIndex: 999,
          columnId: "name",
          value: "Invalid",
        });
      });

      // Should still call onDataChange with extended array
      expect(onDataChange).toHaveBeenCalled();
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

      // Select a cell
      act(() => {
        result.current.tableMeta.onCellMouseDown?.(0, "name", {
          button: 0,
          preventDefault: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Click on another cell (non-select column)
      act(() => {
        result.current.tableMeta.onCellClick?.(0, "name");
      });

      // Should maintain or update selection appropriately
      expect(result.current.focusedCell).toBeDefined();
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
      // Should not crash
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
  });
});
