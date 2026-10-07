import {
  type CellSelectionState,
  type ColumnDef,
  type ColumnVisibilityState,
  type RowData,
  type RowSelectionState,
  type Table,
  type TableOptions,
  type TableState,
  type Updater,
  functionalUpdate,
  makeStateUpdater,
  useTable,
} from "@tanstack/react-table";
import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";
import * as React from "react";
import { toast } from "sonner";

import type { CellPosition, NavigationDirection } from "@/lib/data-grid-types";

import { useAsRef } from "@/hooks/use-as-ref";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";
import {
  type DataGridFeatures,
  dataGridFeatures,
} from "@/lib/data-grid-features";
import {
  getCellElement,
  getCellFocusTarget,
  getCellKey,
  getIsInPopover,
  getRowIndexById,
  parseCellKey,
  scrollCellIntoView,
} from "@/lib/data-grid-utils";
import { useDirection } from "@/registry/bases/radix/ui/direction";

const OVERSCAN = 6;
const VIEWPORT_OFFSET = 1;
const MIN_COLUMN_SIZE = 60;
const MAX_COLUMN_SIZE = 800;
const SEARCH_SHORTCUT_KEY = "f";
const NON_NAVIGABLE_COLUMN_IDS = new Set(["select", "actions"]);
const AUTO_SCROLL_EDGE_ZONE = 50;
const AUTO_SCROLL_SPEED_RAMP_ZONE = AUTO_SCROLL_EDGE_ZONE * 3;
const AUTO_SCROLL_MIN_SPEED = 8;
const AUTO_SCROLL_MAX_SPEED = 40;
const AUTO_SCROLL_SELECTION_THROTTLE_MS = 32;

function showClipboardToast({
  variant,
  message,
}: {
  variant: "success" | "error";
  message: string;
}) {
  if (variant === "error") toast.error(message);
  else toast.success(message);
}

// Interaction state (selection, editing, search, menus) is subscribed to where it renders
function selectGridLayoutState(state: TableState<DataGridFeatures>) {
  return {
    rowHeight: state.rowHeight,
    rowSelection: state.rowSelection,
    sorting: state.sorting,
    columnFilters: state.columnFilters,
    columnVisibility: state.columnVisibility,
    columnPinning: state.columnPinning,
    columnOrder: state.columnOrder,
    columnSizing: state.columnSizing,
    columnResizing: state.columnResizing,
  };
}

function getIsDataColumn(columnId: string) {
  return !NON_NAVIGABLE_COLUMN_IDS.has(columnId);
}

function getActiveCellRange(ranges: CellSelectionState) {
  return ranges[ranges.length - 1] ?? null;
}

function getFocusedCellPosition(
  ranges: CellSelectionState,
): CellPosition | null {
  const range = getActiveCellRange(ranges);
  return range
    ? { rowId: range.anchorRowId, columnId: range.anchorColumnId }
    : null;
}

function getSelectionEdgePosition(
  ranges: CellSelectionState,
): CellPosition | null {
  const range = getActiveCellRange(ranges);
  return range
    ? { rowId: range.focusRowId, columnId: range.focusColumnId }
    : null;
}

/** Whether the selection covers more than the focused cell. */
function getHasCellRangeSelection(ranges: CellSelectionState) {
  const range = getActiveCellRange(ranges);
  if (!range) return false;
  return (
    ranges.length > 1 ||
    range.anchorRowId !== range.focusRowId ||
    range.anchorColumnId !== range.focusColumnId
  );
}

function getSelectedCellKeys<TData extends RowData>(
  table: Table<DataGridFeatures, TData>,
) {
  return table
    .getSelectedCells()
    .map(({ rowId, columnId }) => getCellKey(rowId, columnId));
}

interface RowAddResult {
  rowId: string;
  /** Column to focus in the new row, defaults to the first data column. */
  columnId?: string;
}

interface UseDataGridProps<TData extends RowData> extends Omit<
  TableOptions<DataGridFeatures, TData>,
  "features"
> {
  /** Adds a row and returns its id so the grid can focus it once it renders. */
  onRowAdd?: (
    event?: React.MouseEvent<HTMLDivElement>,
  ) => RowAddResult | Promise<RowAddResult | null> | null;
  overscan?: number;
  autoFocus?: boolean | Partial<CellPosition>;
}

function useDataGrid<TData extends RowData>({
  data,
  columns,
  overscan = OVERSCAN,
  dir: dirProp,
  ...props
}: UseDataGridProps<TData>) {
  const contextDir = useDirection();
  const dir = dirProp ?? contextDir;
  const dataGridRef = React.useRef<HTMLDivElement>(null);
  const tableRef = React.useRef<Table<DataGridFeatures, TData>>(null);
  const rowVirtualizerRef =
    React.useRef<Virtualizer<HTMLDivElement, Element>>(null);
  const headerRef = React.useRef<HTMLDivElement>(null);
  const rowMapRef = React.useRef<Map<number, HTMLDivElement>>(new Map());
  const footerRef = React.useRef<HTMLDivElement>(null);
  const pendingFocusRef = React.useRef<{
    cell: CellPosition;
    shouldScroll: boolean;
  } | null>(null);

  const propsRef = useAsRef(props);

  const getRowIndex = React.useCallback((rowId: string) => {
    const currentTable = tableRef.current;
    return currentTable ? getRowIndexById(currentTable, rowId) : -1;
  }, []);

  const getRowIdAt = React.useCallback(
    (rowIndex: number) => tableRef.current?.getRowModel().rows[rowIndex]?.id,
    [],
  );

  const getCellSelection = React.useCallback(
    (): CellSelectionState => tableRef.current?.atoms.cellSelection.get() ?? [],
    [],
  );

  const getFocusedCell = React.useCallback(
    () => getFocusedCellPosition(getCellSelection()),
    [getCellSelection],
  );

  const revealCell = React.useCallback(
    (
      cell: CellPosition,
      {
        shouldFocus,
        shouldScroll,
      }: { shouldFocus: boolean; shouldScroll: boolean },
    ) => {
      const currentTable = tableRef.current;
      const container = dataGridRef.current;
      if (!currentTable || !container) return false;

      const rowIndex = getRowIndexById(currentTable, cell.rowId);
      if (rowIndex === -1) return false;

      if (shouldScroll) {
        rowVirtualizerRef.current?.scrollToIndex(rowIndex, { align: "auto" });
      }

      const cellElement = getCellElement(container, cell.rowId, cell.columnId);
      if (!cellElement) return false;

      if (shouldScroll) {
        scrollCellIntoView({
          container,
          targetCell: cellElement,
          tableRef,
          viewportOffset: VIEWPORT_OFFSET,
          isRtl: dir === "rtl",
        });
      }
      if (shouldFocus) {
        getCellFocusTarget(cellElement).focus({ preventScroll: true });
      }
      return true;
    },
    [dir],
  );

  const focusCellElement = React.useCallback(
    (cell: CellPosition, shouldScroll = true) => {
      if (tableRef.current?.getSearchOpen()) return;

      if (revealCell(cell, { shouldFocus: true, shouldScroll })) {
        pendingFocusRef.current = null;
        return;
      }

      // Keeps keyboard handling on the grid until the cell mounts
      pendingFocusRef.current = { cell, shouldScroll };
      const container = dataGridRef.current;
      if (container && !container.contains(document.activeElement)) {
        container.focus({ preventScroll: true });
      }
    },
    [revealCell],
  );

  const focusCell = React.useCallback(
    (rowId: string, columnId: string) => {
      tableRef.current?.setFocusedCell(rowId, columnId);
      tableRef.current?.setEditingCell(null);
      focusCellElement({ rowId, columnId });
    },
    [focusCellElement],
  );

  const getColumnIds = React.useCallback(
    () =>
      tableRef.current?.getVisibleLeafColumns().map((column) => column.id) ??
      [],
    [],
  );

  const getNavigableColumnIds = React.useCallback(
    () => getColumnIds().filter(getIsDataColumn),
    [getColumnIds],
  );

  const selectRange = React.useCallback(
    (start: CellPosition, end: CellPosition) => {
      tableRef.current?.selectCellRange({
        anchorRowId: start.rowId,
        anchorColumnId: start.columnId,
        focusRowId: end.rowId,
        focusColumnId: end.columnId,
      });
    },
    [],
  );

  const onRowsDelete = React.useCallback(async (rowIds: string[]) => {
    await tableRef.current?.deleteRows(rowIds);
    tableRef.current?.endCellDrag();
  }, []);

  const startEditing = React.useCallback((rowId: string, columnId: string) => {
    const cellsByColumnId = tableRef.current
      ?.getCoreRowModel()
      .rowsById[rowId]?.getAllCellsByColumnId();
    cellsByColumnId?.[columnId]?.startEditing();
  }, []);

  const blurCell = React.useCallback(() => {
    if (
      tableRef.current?.getEditingCell() &&
      document.activeElement instanceof HTMLElement
    ) {
      document.activeElement.blur();
    }

    tableRef.current?.resetCellSelection(true);
    tableRef.current?.setEditingCell(null);
  }, []);

  const onCellClick = React.useCallback(
    (rowId: string, columnId: string, event?: React.MouseEvent) => {
      if (event?.button === 2) return;

      const currentTable = tableRef.current;
      if (!currentTable) return;

      const ranges = currentTable.atoms.cellSelection.get();
      const currentFocused = getFocusedCellPosition(ranges);

      if (event) {
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          currentTable.selectCellRange(
            {
              anchorRowId: rowId,
              anchorColumnId: columnId,
              focusRowId: rowId,
              focusColumnId: columnId,
            },
            {
              mode: currentTable.getIsCellSelected(rowId, columnId)
                ? "exclude"
                : "include",
            },
          );
          currentTable.setEditingCell(null);
          focusCellElement({ rowId, columnId });
          return;
        }

        if (event.shiftKey && currentFocused) {
          event.preventDefault();
          currentTable.extendCellSelectionTo({ rowId, columnId });
          focusCellElement(currentFocused, false);
          return;
        }
      }

      if (columnId !== "select") currentTable.clearRowSelection();

      if (
        !getHasCellRangeSelection(ranges) &&
        currentFocused?.rowId === rowId &&
        currentFocused?.columnId === columnId
      ) {
        startEditing(rowId, columnId);
      } else {
        focusCell(rowId, columnId);
      }
    },
    [focusCell, focusCellElement, startEditing],
  );

  const onCellDoubleClick = React.useCallback(
    (rowId: string, columnId: string, event?: React.MouseEvent) => {
      if (event?.defaultPrevented) return;

      startEditing(rowId, columnId);
    },
    [startEditing],
  );

  const onCellMouseDown = React.useCallback(
    (rowId: string, columnId: string, event: React.MouseEvent) => {
      if (event.button === 2) {
        return;
      }

      event.preventDefault();

      if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
        tableRef.current?.startCellDrag({ rowId, columnId });
      }
    },
    [],
  );

  const onCellMouseEnter = React.useCallback(
    (rowId: string, columnId: string) => {
      const dragStartCell = tableRef.current?.getCellDragAnchor();
      if (!dragStartCell) return;

      const currentFocused = getFocusedCell();
      if (
        currentFocused?.rowId !== dragStartCell.rowId ||
        currentFocused?.columnId !== dragStartCell.columnId
      ) {
        tableRef.current?.setEditingCell(null);
        focusCellElement(dragStartCell, false);
      }

      selectRange(dragStartCell, { rowId, columnId });
    },
    [selectRange, getFocusedCell, focusCellElement],
  );

  const onCellMouseUp = React.useCallback(() => {
    tableRef.current?.endCellDrag();
  }, []);

  const onCellContextMenu = React.useCallback(
    (rowId: string, columnId: string, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const currentTable = tableRef.current;
      if (!currentTable) return;
      if (!currentTable.getIsCellSelected(rowId, columnId)) {
        currentTable.setFocusedCell(rowId, columnId);
      }
      currentTable.openContextMenu({ x: event.clientX, y: event.clientY });
    },
    [],
  );

  const onColumnVisibilityChange = React.useCallback(
    (updater: Updater<ColumnVisibilityState>) => {
      const currentTable = tableRef.current;
      if (!currentTable) return;
      makeStateUpdater("columnVisibility", currentTable)(updater);

      const focusedColumnId = getFocusedCell()?.columnId;
      if (
        focusedColumnId &&
        currentTable.atoms.columnVisibility.get()[focusedColumnId] === false
      ) {
        currentTable.resetCellSelection(true);
        currentTable.setEditingCell(null);
      }

      propsRef.current.onColumnVisibilityChange?.(updater);
    },
    [propsRef, getFocusedCell],
  );

  const onRowSelectionChange = React.useCallback(
    (updater: Updater<RowSelectionState>) => {
      const currentTable = tableRef.current;
      if (!currentTable) return;
      const newRowSelection = functionalUpdate(
        updater,
        currentTable.atoms.rowSelection.get(),
      );

      const firstColumnId = getNavigableColumnIds()[0];
      const lastColumnId = getNavigableColumnIds().at(-1);
      const rows = currentTable.getRowModel().rows;
      const ranges: CellSelectionState = [];

      if (firstColumnId && lastColumnId) {
        let runStartRowId: string | null = null;
        for (let rowIndex = 0; rowIndex <= rows.length; rowIndex++) {
          const row = rows[rowIndex];
          const isSelected = row ? !!newRowSelection[row.id] : false;

          if (isSelected && row && runStartRowId === null) {
            runStartRowId = row.id;
          } else if (!isSelected && runStartRowId !== null) {
            const runEndRowId = rows[rowIndex - 1]?.id ?? runStartRowId;
            ranges.push({
              anchorRowId: runStartRowId,
              anchorColumnId: firstColumnId,
              focusRowId: runEndRowId,
              focusColumnId: lastColumnId,
            });
            runStartRowId = null;
          }
        }
      }

      const focusedCell = getFocusedCell();
      const isUtilityCellFocused =
        focusedCell !== null && !getIsDataColumn(focusedCell.columnId);
      if (focusedCell && isUtilityCellFocused) {
        ranges.push({
          anchorRowId: focusedCell.rowId,
          anchorColumnId: focusedCell.columnId,
          focusRowId: focusedCell.rowId,
          focusColumnId: focusedCell.columnId,
        });
      }

      makeStateUpdater("rowSelection", currentTable)(newRowSelection);
      currentTable.setCellSelection(ranges);
      if (!isUtilityCellFocused) {
        currentTable.setEditingCell(null);
      }

      propsRef.current.onRowSelectionChange?.(updater);
    },
    [getNavigableColumnIds, propsRef, getFocusedCell],
  );

  const defaultColumn: Partial<ColumnDef<DataGridFeatures, TData>> =
    React.useMemo(
      () => ({
        // Cell is rendered directly in DataGridRow to bypass flexRender's
        // unstable cell.getContext() (https://github.com/TanStack/table/issues/4794)
        minSize: MIN_COLUMN_SIZE,
        maxSize: MAX_COLUMN_SIZE,
      }),
      [],
    );

  const dataGridBodyProps = React.useMemo(() => {
    let hoveredCellKey: string | null = null;

    // React bubbles events out of portalled editors too, so only cells mounted in the grid count
    function getEventCell(event: React.SyntheticEvent) {
      const container = dataGridRef.current;
      const target = event.target;
      if (!container || !(target instanceof Element)) return null;
      if (!container.contains(target)) return null;

      const cellElement = target.closest<HTMLElement>(
        '[data-slot="grid-cell-wrapper"]',
      );
      const rowId = cellElement?.dataset.rowId;
      const columnId = cellElement?.dataset.columnId;
      if (!rowId || !columnId) return null;

      const editingCell = tableRef.current?.getEditingCell();
      if (editingCell?.rowId === rowId && editingCell.columnId === columnId) {
        return null;
      }
      return { rowId, columnId };
    }

    return {
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        const cell = getEventCell(event);
        if (!cell) return;
        event.preventDefault();
        onCellClick(cell.rowId, cell.columnId, event);
      },
      onDoubleClick: (event: React.MouseEvent<HTMLElement>) => {
        const cell = getEventCell(event);
        if (!cell) return;
        event.preventDefault();
        onCellDoubleClick(cell.rowId, cell.columnId);
      },
      onMouseDown: (event: React.MouseEvent<HTMLElement>) => {
        const cell = getEventCell(event);
        if (cell) onCellMouseDown(cell.rowId, cell.columnId, event);
      },
      onMouseOver: (event: React.MouseEvent<HTMLElement>) => {
        const cell = getEventCell(event);
        const cellKey = cell ? getCellKey(cell.rowId, cell.columnId) : null;
        if (cellKey === hoveredCellKey) return;
        hoveredCellKey = cellKey;
        if (cell) onCellMouseEnter(cell.rowId, cell.columnId);
      },
      onMouseLeave: () => {
        hoveredCellKey = null;
      },
      onMouseUp: (event: React.MouseEvent<HTMLElement>) => {
        if (getEventCell(event)) onCellMouseUp();
      },
      onContextMenu: (event: React.MouseEvent<HTMLElement>) => {
        const cell = getEventCell(event);
        if (cell) onCellContextMenu(cell.rowId, cell.columnId, event);
      },
    };
  }, [
    onCellClick,
    onCellDoubleClick,
    onCellMouseDown,
    onCellMouseEnter,
    onCellMouseUp,
    onCellContextMenu,
  ]);

  const tableColumns = React.useMemo(
    () =>
      columns.map((column) =>
        column.id &&
        NON_NAVIGABLE_COLUMN_IDS.has(column.id) &&
        column.enableCellSelection === undefined
          ? { ...column, enableCellSelection: false }
          : column,
      ),
    [columns],
  );

  const controlledState = props.state;
  const enableCellEditing =
    !props.readOnly && props.enableCellEditing !== false;
  const hasEditingCellChange = !!props.onEditingCellChange;
  const hasRowHeightChange = !!props.onRowHeightChange;
  const canAddRows = !!props.onRowsAdd || !!props.onRowAdd;

  const tableOptions = React.useMemo<
    TableOptions<DataGridFeatures, TData>
  >(() => {
    return {
      ...propsRef.current,
      ...(hasEditingCellChange && {
        onEditingCellChange: (updater) =>
          propsRef.current.onEditingCellChange?.(updater),
      }),
      ...(hasRowHeightChange && {
        onRowHeightChange: (updater) =>
          propsRef.current.onRowHeightChange?.(updater),
      }),
      onRowsAdd: canAddRows
        ? async (count) => {
            const { onRowsAdd, onRowAdd } = propsRef.current;
            if (onRowsAdd) return onRowsAdd(count);
            for (let i = 0; i < count; i++) await onRowAdd?.();
          }
        : undefined,
      onClipboardNotice: (notice) =>
        (propsRef.current.onClipboardNotice ?? showClipboardToast)(notice),
      features: dataGridFeatures,
      data,
      columns: tableColumns,
      defaultColumn,
      state: controlledState,
      autoResetCellSelection: false,
      enableCellEditing,
      onRowSelectionChange,
      onColumnVisibilityChange,
      columnResizeMode: "onChange",
      columnResizeDirection: dir,
      dir,
    };
  }, [
    propsRef,
    data,
    tableColumns,
    defaultColumn,
    controlledState,
    enableCellEditing,
    hasEditingCellChange,
    hasRowHeightChange,
    canAddRows,
    dir,
    onRowSelectionChange,
    onColumnVisibilityChange,
  ]);

  const table = useTable(tableOptions, selectGridLayoutState);

  if (!tableRef.current) {
    tableRef.current = table;
  }

  const rowHeight = table.state.rowHeight;
  const readOnlyColumnIds = React.useMemo(
    () =>
      new Set(
        table
          .getAllLeafColumns()
          .filter((column) => !column.getCanEdit())
          .map((column) => column.id),
      ),
    [table, columns, enableCellEditing],
  );
  const rowSize = table.getRowSize();

  const dragDepsRef = useAsRef({
    selectRange,
    dir,
    rowSize,
  });

  const columnSizeVars = React.useMemo(() => {
    const headers = table.getFlatHeaders();
    const colSizes: { [key: string]: number } = {};
    for (const header of headers) {
      colSizes[`--header-${header.id}-size`] = header.getSize();
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
    }
    return colSizes;
  }, [table.state.columnResizing, table.state.columnSizing]);

  const isFirefox = React.useSyncExternalStore(
    React.useCallback(() => () => {}, []),
    React.useCallback(() => {
      if (typeof window === "undefined" || typeof navigator === "undefined") {
        return false;
      }
      return navigator.userAgent.indexOf("Firefox") !== -1;
    }, []),
    React.useCallback(() => false, []),
  );

  const adjustLayout = React.useMemo(() => {
    const columnPinning = table.state.columnPinning;
    return (
      isFirefox &&
      ((columnPinning.start?.length ?? 0) > 0 ||
        (columnPinning.end?.length ?? 0) > 0)
    );
  }, [isFirefox, table.state.columnPinning]);

  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => dataGridRef.current,
    estimateSize: () => rowSize,
    overscan,
    measureElement: !isFirefox
      ? (element) => element?.getBoundingClientRect().height
      : undefined,
    scrollPaddingStart:
      (headerRef.current?.getBoundingClientRect().bottom ?? 0) -
      (dataGridRef.current?.getBoundingClientRect().top ?? 0) +
      VIEWPORT_OFFSET,
    // Add extra row buffer to absorb virtual position drift after render measurements
    scrollPaddingEnd:
      (dataGridRef.current?.getBoundingClientRect().bottom ?? 0) -
      (footerRef.current?.getBoundingClientRect().top ??
        dataGridRef.current?.getBoundingClientRect().bottom ??
        0) +
      rowSize +
      VIEWPORT_OFFSET,
  });

  if (!rowVirtualizerRef.current) {
    rowVirtualizerRef.current = rowVirtualizer;
  }

  const onRowAdd = React.useCallback(
    async (event?: React.MouseEvent<HTMLDivElement>) => {
      if (propsRef.current.readOnly || !propsRef.current.onRowAdd) return;

      let result: RowAddResult | null;
      try {
        result = await propsRef.current.onRowAdd(event);
      } catch {
        // Callback threw an error, don't proceed with scroll/focus
        return;
      }

      if (result === null || event?.defaultPrevented) return;

      const columnId = result.columnId ?? getNavigableColumnIds()[0];
      if (!columnId) return;

      tableRef.current?.clearSelection();
      focusCell(result.rowId, columnId);
    },
    [propsRef, getNavigableColumnIds, focusCell],
  );

  const getColumnHeaderTrigger = React.useCallback((columnId: string) => {
    return (
      headerRef.current?.querySelector<HTMLElement>(
        `[data-slot="grid-header-cell"][data-column-id="${CSS.escape(columnId)}"] :is(button, [role="checkbox"])`,
      ) ?? null
    );
  }, []);

  const focusColumnHeader = React.useCallback(
    (columnId: string) => {
      const trigger = getColumnHeaderTrigger(columnId);
      if (!trigger) return false;

      if (!tableRef.current?.getHasRowSelection()) {
        tableRef.current?.resetCellSelection(true);
      }
      tableRef.current?.setEditingCell(null);
      trigger.focus();
      return true;
    },
    [getColumnHeaderTrigger],
  );

  const onGridTabBackOut = React.useCallback(() => {
    const container = dataGridRef.current;
    if (!container) return;

    // The container precedes every cell in the tab order, so it has to drop out
    // until the browser finishes moving focus or Shift+Tab would land on it.
    container.tabIndex = -1;
    requestAnimationFrame(() => {
      container.tabIndex = 0;
    });
  }, []);

  const onColumnHeaderKeyDown = React.useCallback(
    (event: KeyboardEvent, columnId: string) => {
      const { key, shiftKey, ctrlKey, metaKey, altKey } = event;
      if (ctrlKey || metaKey || altKey) return false;

      const headerColumnIds = getColumnIds().filter((id) =>
        getColumnHeaderTrigger(id),
      );
      const headerIndex = headerColumnIds.indexOf(columnId);
      if (headerIndex === -1) return false;

      const isRtl = dir === "rtl";

      function focusHeaderAt(index: number) {
        const targetColumnId = headerColumnIds[index];
        if (targetColumnId) focusColumnHeader(targetColumnId);
      }

      switch (key) {
        case "ArrowLeft":
        case "ArrowRight": {
          const isNext = (key === "ArrowRight") !== isRtl;
          focusHeaderAt(headerIndex + (isNext ? 1 : -1));
          break;
        }
        case "Home":
          focusHeaderAt(0);
          break;
        case "End":
          focusHeaderAt(headerColumnIds.length - 1);
          break;
        case "ArrowUp":
          break;
        case "ArrowDown": {
          // Stops the menu trigger from opening its menu on ArrowDown
          event.stopPropagation();
          const firstRowId = getRowIdAt(0);
          if (firstRowId) focusCell(firstRowId, columnId);
          break;
        }
        case "Escape":
          dataGridRef.current?.focus();
          break;
        case "Tab":
          if (shiftKey) {
            if (headerIndex === 0) {
              onGridTabBackOut();
              return true;
            }
            focusHeaderAt(headerIndex - 1);
          } else if (headerIndex < headerColumnIds.length - 1) {
            focusHeaderAt(headerIndex + 1);
          } else {
            const firstRowId = getRowIdAt(0);
            const firstColumnId = getNavigableColumnIds()[0];
            if (!firstRowId || !firstColumnId) return true;
            focusCell(firstRowId, firstColumnId);
          }
          break;
        default:
          return false;
      }

      event.preventDefault();
      return true;
    },
    [
      dir,
      getColumnIds,
      getNavigableColumnIds,
      getColumnHeaderTrigger,
      focusColumnHeader,
      onGridTabBackOut,
      focusCell,
      getRowIdAt,
    ],
  );

  const onDataGridKeyDown = React.useCallback(
    (event: KeyboardEvent) => {
      const currentTable = tableRef.current;
      const cellSelection = currentTable?.atoms.cellSelection.get() ?? [];
      const focusedCell = getFocusedCellPosition(cellSelection);
      const hasCellRangeSelection = getHasCellRangeSelection(cellSelection);
      const { key, ctrlKey, metaKey, shiftKey, altKey } = event;
      const isCtrlPressed = ctrlKey || metaKey;

      if (
        currentTable?.options.enableSearch &&
        isCtrlPressed &&
        !shiftKey &&
        key === SEARCH_SHORTCUT_KEY
      ) {
        event.preventDefault();
        currentTable.openSearch();
        return;
      }

      if (currentTable?.getSearchOpen() && !currentTable.getEditingCell()) {
        if (key === "Enter") {
          event.preventDefault();
          if (shiftKey) {
            currentTable.goToPrevSearchMatch();
          } else {
            currentTable.goToNextSearchMatch();
          }
          return;
        }
        if (key === "Escape") {
          event.preventDefault();
          currentTable.closeSearch();
          return;
        }
        return;
      }

      // Cell editing keyboard events (Enter, Tab, Escape) are handled by the cell variants
      // to ensure proper value commitment before navigation
      if (tableRef.current?.getEditingCell()) return;

      const headerCell =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-slot="grid-header-cell"]')
          : null;
      const headerColumnId = headerCell?.dataset.columnId;
      if (headerColumnId && onColumnHeaderKeyDown(event, headerColumnId)) {
        return;
      }

      if (
        isCtrlPressed &&
        (key === "Backspace" || key === "Delete") &&
        !propsRef.current.readOnly &&
        propsRef.current.onRowsDelete
      ) {
        const rowIds = new Set<string>();

        if (tableRef.current?.getHasRowSelection()) {
          const rows = tableRef.current?.getRowModel().rows ?? [];
          for (const row of rows) {
            if (currentTable?.atoms.rowSelection.get()[row.id]) {
              rowIds.add(row.id);
            }
          }
        } else if (hasCellRangeSelection && currentTable) {
          for (const cellKey of getSelectedCellKeys(currentTable)) {
            rowIds.add(parseCellKey(cellKey).rowId);
          }
        } else if (focusedCell) {
          rowIds.add(focusedCell.rowId);
        }

        if (rowIds.size > 0) {
          event.preventDefault();
          void onRowsDelete(Array.from(rowIds));
        }
        return;
      }

      if (!focusedCell) return;

      let direction: NavigationDirection | null = null;

      const isUtilityCellFocused = !getIsDataColumn(focusedCell.columnId);

      if (
        isUtilityCellFocused &&
        shiftKey &&
        (key.startsWith("Arrow") ||
          key === "Home" ||
          key === "End" ||
          key === "PageUp" ||
          key === "PageDown")
      ) {
        event.preventDefault();
        return;
      }

      if (isCtrlPressed && !shiftKey && key === "a") {
        event.preventDefault();
        tableRef.current?.selectAllDataCells();
        return;
      }

      if (isCtrlPressed && !shiftKey && key === "c" && !isUtilityCellFocused) {
        event.preventDefault();
        void currentTable?.copySelectedCells();
        return;
      }

      if (
        isCtrlPressed &&
        !shiftKey &&
        key === "x" &&
        !isUtilityCellFocused &&
        !propsRef.current.readOnly
      ) {
        event.preventDefault();
        void currentTable?.cutSelectedCells();
        return;
      }

      if (
        propsRef.current.enablePaste &&
        isCtrlPressed &&
        !shiftKey &&
        key === "v" &&
        !isUtilityCellFocused &&
        !propsRef.current.readOnly
      ) {
        event.preventDefault();
        void currentTable?.pasteCells();
        return;
      }

      if (
        (key === "Delete" || key === "Backspace") &&
        !isCtrlPressed &&
        !isUtilityCellFocused &&
        !propsRef.current.readOnly
      ) {
        const cellsToClear = currentTable
          ? getSelectedCellKeys(currentTable)
          : [];

        if (cellsToClear.length > 0) {
          event.preventDefault();

          currentTable?.clearCells(cellsToClear.map(parseCellKey));

          if (hasCellRangeSelection) {
            tableRef.current?.clearSelection();
          }

          if (currentTable?.getCutCells().length) {
            currentTable.resetCutCells(true);
          }
        }
        return;
      }

      if (
        key === "Enter" &&
        shiftKey &&
        !propsRef.current.readOnly &&
        propsRef.current.onRowAdd
      ) {
        event.preventDefault();
        const currentColumnId = isUtilityCellFocused
          ? getNavigableColumnIds()[0]
          : focusedCell.columnId;

        Promise.resolve(propsRef.current.onRowAdd())
          .then((result) => {
            const columnId = result?.columnId ?? currentColumnId;
            if (!result || !columnId) return;

            tableRef.current?.clearSelection();
            focusCell(result.rowId, columnId);
          })
          .catch(() => {
            // Callback threw an error, don't proceed with focus
          });
        return;
      }

      const isRtl = dir === "rtl";

      switch (key) {
        case "ArrowUp":
          if (altKey && !isCtrlPressed && !shiftKey) {
            direction = "pageup";
          } else if (isCtrlPressed) {
            direction = "ctrl+up";
          } else if (
            !shiftKey &&
            getRowIndex(focusedCell.rowId) === 0 &&
            focusColumnHeader(focusedCell.columnId)
          ) {
            event.preventDefault();
            return;
          } else {
            direction = "up";
          }
          break;
        case "ArrowDown":
          if (altKey && !isCtrlPressed && !shiftKey) {
            direction = "pagedown";
          } else {
            direction = isCtrlPressed ? "ctrl+down" : "down";
          }
          break;
        case "ArrowLeft":
          if (isCtrlPressed) {
            direction = isRtl ? "end" : "home";
          } else {
            direction = "left";
          }
          break;
        case "ArrowRight":
          if (isCtrlPressed) {
            direction = isRtl ? "home" : "end";
          } else {
            direction = "right";
          }
          break;
        case "Home":
          direction = isCtrlPressed ? "ctrl+home" : "home";
          break;
        case "End":
          direction = isCtrlPressed ? "ctrl+end" : "end";
          break;
        case "PageUp":
          direction = altKey ? "pageleft" : "pageup";
          break;
        case "PageDown":
          direction = altKey ? "pageright" : "pagedown";
          break;
        case "Escape":
          event.preventDefault();
          if (hasCellRangeSelection || tableRef.current?.getHasRowSelection()) {
            tableRef.current?.clearSelection();
          } else {
            blurCell();
            dataGridRef.current?.focus();
          }
          return;
        case "Tab": {
          if (isCtrlPressed || altKey) return;

          direction = shiftKey ? "shift+tab" : "tab";
          if (!currentTable?.getNavigationTarget(focusedCell, direction)) {
            if (shiftKey) onGridTabBackOut();
            return;
          }
          break;
        }
      }

      if (!direction || !currentTable) return;
      event.preventDefault();

      const extend = shiftKey && key !== "Tab";
      const pageSize = rowVirtualizerRef.current?.getVirtualItems().length;

      if (!extend && hasCellRangeSelection) tableRef.current?.clearSelection();
      currentTable.navigate(direction, { extend, pageSize });
    },
    [
      dir,
      propsRef,
      blurCell,
      getNavigableColumnIds,
      onRowsDelete,
      focusCell,
      focusColumnHeader,
      onColumnHeaderKeyDown,
      onGridTabBackOut,
      getRowIndex,
    ],
  );

  React.useEffect(() => {
    const dataGridElement = dataGridRef.current;
    if (!dataGridElement) return;

    dataGridElement.addEventListener("keydown", onDataGridKeyDown);
    return () => {
      dataGridElement.removeEventListener("keydown", onDataGridKeyDown);
    };
  }, [onDataGridKeyDown]);

  React.useEffect(() => {
    function onGlobalKeyDown(event: KeyboardEvent) {
      const dataGridElement = dataGridRef.current;
      if (!dataGridElement) return;

      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const { key, ctrlKey, metaKey, shiftKey } = event;
      const isCommandPressed = ctrlKey || metaKey;

      const currentTable = tableRef.current;
      if (
        currentTable?.options.enableSearch &&
        isCommandPressed &&
        !shiftKey &&
        key === SEARCH_SHORTCUT_KEY
      ) {
        const isInInput =
          target.tagName === "INPUT" || target.tagName === "TEXTAREA";
        const isInDataGrid = dataGridElement.contains(target);
        const isInSearchInput = target.closest('[role="search"]') !== null;

        if (isInDataGrid || isInSearchInput || !isInInput) {
          event.preventDefault();
          event.stopPropagation();

          const nextSearchOpen = !currentTable.getSearchOpen();
          if (nextSearchOpen) currentTable.openSearch();
          else currentTable.closeSearch();

          if (nextSearchOpen && !isInDataGrid && !isInSearchInput) {
            requestAnimationFrame(() => {
              dataGridElement.focus();
            });
          }
          return;
        }
      }

      const isInDataGrid = dataGridElement.contains(target);
      if (!isInDataGrid) return;

      if (key === "Escape") {
        const hasSelections =
          tableRef.current?.getHasCellRangeSelection() ||
          tableRef.current?.getHasRowSelection();

        if (hasSelections) {
          event.preventDefault();
          event.stopPropagation();
          tableRef.current?.clearSelection();
        }
      }
    }

    window.addEventListener("keydown", onGlobalKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onGlobalKeyDown, true);
    };
  }, []);

  React.useEffect(() => {
    const autoFocus = propsRef.current.autoFocus;

    if (
      autoFocus &&
      data.length > 0 &&
      columns.length > 0 &&
      !getFocusedCell()
    ) {
      if (getNavigableColumnIds().length > 0) {
        const rafId = requestAnimationFrame(() => {
          const firstRowId = tableRef.current?.getRowModel().rows[0]?.id;

          if (typeof autoFocus === "object") {
            const rowId = autoFocus.rowId ?? firstRowId;
            if (rowId && autoFocus.columnId) {
              focusCell(rowId, autoFocus.columnId);
            }
            return;
          }

          const firstColumnId = getNavigableColumnIds()[0];
          if (firstRowId && firstColumnId) {
            focusCell(firstRowId, firstColumnId);
          }
        });
        return () => cancelAnimationFrame(rafId);
      }
    }
  }, [propsRef, data, columns, getNavigableColumnIds, focusCell]);

  // Forward keyboard focus entering the grid to the active cell, so the grid acts as a single tab stop
  React.useEffect(() => {
    const container = dataGridRef.current;
    if (!container) return;

    let isPointerFocus = false;

    function onPointerDown() {
      isPointerFocus = true;
    }

    function onPointerUp() {
      isPointerFocus = false;
    }

    function getFirstVisibleRowIndex() {
      const currentContainer = dataGridRef.current;
      if (!currentContainer) return 0;

      const viewportTop =
        currentContainer.getBoundingClientRect().top +
        (headerRef.current?.getBoundingClientRect().height ?? 0);

      let firstRowIndex: number | null = null;
      for (const [rowIndex, rowElement] of rowMapRef.current) {
        if (
          rowElement.getBoundingClientRect().top >= viewportTop - 1 &&
          (firstRowIndex === null || rowIndex < firstRowIndex)
        ) {
          firstRowIndex = rowIndex;
        }
      }
      return firstRowIndex ?? 0;
    }

    function onFocus(event: FocusEvent) {
      const wasPointerFocus = isPointerFocus;
      isPointerFocus = false;
      if (wasPointerFocus) return;

      const currentContainer = dataGridRef.current;
      const relatedTarget = event.relatedTarget;
      if (
        !currentContainer ||
        !(relatedTarget instanceof Node) ||
        currentContainer.contains(relatedTarget)
      ) {
        return;
      }

      if (
        tableRef.current?.getEditingCell() ||
        tableRef.current?.getSearchOpen()
      )
        return;

      const focusedCell = getFocusedCell();
      if (focusedCell) {
        focusCellElement(focusedCell);
        return;
      }

      const firstColumnId = getNavigableColumnIds()[0];
      const firstVisibleRowId =
        tableRef.current?.getRowModel().rows[getFirstVisibleRowIndex()]?.id;
      if (!firstColumnId || !firstVisibleRowId) return;

      focusCell(firstVisibleRowId, firstColumnId);
    }

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("focus", onFocus);

    return () => {
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("focus", onFocus);
    };
  }, [getNavigableColumnIds, focusCell, focusCellElement, getFocusedCell]);

  // Keeps focus on the grid when the focused cell unmounts during virtualization
  React.useEffect(() => {
    const container = dataGridRef.current;
    if (!container) return;

    let rafId = 0;

    function onFocusOut(event: FocusEvent) {
      // A real relatedTarget means the user moved focus elsewhere on purpose
      if (event.relatedTarget || tableRef.current?.getEditingCell()) return;

      cancelAnimationFrame(rafId);
      // Focus lands on the body only after the unmounted cell is removed from the DOM
      rafId = requestAnimationFrame(() => {
        const focusedCell = getFocusedCell();
        if (!focusedCell || !document.hasFocus()) return;
        if (document.activeElement && document.activeElement !== document.body)
          return;

        focusCellElement(focusedCell, false);
      });
    }

    container.addEventListener("focusout", onFocusOut);

    return () => {
      cancelAnimationFrame(rafId);
      container.removeEventListener("focusout", onFocusOut);
    };
  }, [getFocusedCell, focusCellElement]);

  // Moves DOM focus and scroll position to follow the table's selection and editing state
  React.useEffect(() => {
    let prevFocusKey: string | null = null;
    let prevEdgeKey: string | null = null;

    const subscription = table.atoms.cellSelection.subscribe(() => {
      const ranges = table.atoms.cellSelection.get();
      const focusedCell = getFocusedCellPosition(ranges);
      const edgeCell = getSelectionEdgePosition(ranges);
      const focusKey = focusedCell
        ? getCellKey(focusedCell.rowId, focusedCell.columnId)
        : null;
      const edgeKey = edgeCell
        ? getCellKey(edgeCell.rowId, edgeCell.columnId)
        : null;
      const isFocusChanged = focusKey !== prevFocusKey;
      const isEdgeChanged = edgeKey !== prevEdgeKey;
      prevFocusKey = focusKey;
      prevEdgeKey = edgeKey;

      if (isFocusChanged && focusedCell) {
        if (table.getSearchOpen()) {
          revealCell(focusedCell, { shouldFocus: false, shouldScroll: true });
        } else if (dataGridRef.current?.contains(document.activeElement)) {
          focusCellElement(focusedCell);
        }
        return;
      }

      if (isEdgeChanged && edgeCell && !table.atoms.cellDragAnchor.get()) {
        revealCell(edgeCell, { shouldFocus: false, shouldScroll: true });
      }
    });

    let prevEditingCell = table.atoms.editingCell.get();
    const editingSubscription = table.atoms.editingCell.subscribe(() => {
      const editingCell = table.atoms.editingCell.get();
      const wasEditing = !!prevEditingCell;
      prevEditingCell = editingCell;
      if (!wasEditing || editingCell) return;

      // Editors may live in portals outside the grid, so focus returns to the cell unconditionally
      const focusedCell = getFocusedCellPosition(
        table.atoms.cellSelection.get(),
      );
      if (focusedCell) focusCellElement(focusedCell, false);
    });

    let prevSearchOpen = table.atoms.searchOpen.get();
    const searchOpenSubscription = table.atoms.searchOpen.subscribe(() => {
      const searchOpen = table.atoms.searchOpen.get();
      const wasSearchOpen = prevSearchOpen;
      prevSearchOpen = searchOpen;
      if (!wasSearchOpen || searchOpen) return;

      const focusedCell = getFocusedCellPosition(
        table.atoms.cellSelection.get(),
      );
      if (focusedCell) focusCellElement(focusedCell);
      else dataGridRef.current?.focus();
    });

    return () => {
      subscription.unsubscribe();
      editingSubscription.unsubscribe();
      searchOpenSubscription.unsubscribe();
    };
  }, [table, revealCell, focusCellElement]);

  // Focuses a cell requested before its row was rendered, once it mounts
  React.useLayoutEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;

    const focusedCell = getFocusedCell();
    const isStale =
      !focusedCell ||
      focusedCell.rowId !== pending.cell.rowId ||
      focusedCell.columnId !== pending.cell.columnId ||
      !!tableRef.current?.getEditingCell() ||
      !dataGridRef.current?.contains(document.activeElement);

    if (
      isStale ||
      revealCell(pending.cell, {
        shouldFocus: true,
        shouldScroll: pending.shouldScroll,
      })
    ) {
      pendingFocusRef.current = null;
    }
  });

  React.useEffect(() => {
    function onOutsideClick(event: MouseEvent) {
      if (event.button === 2) {
        return;
      }

      if (
        dataGridRef.current &&
        !dataGridRef.current.contains(event.target as Node)
      ) {
        const elements = document.elementsFromPoint(
          event.clientX,
          event.clientY,
        );

        // Compensate for event.target bubbling up
        const isInsidePopover = elements.some((element) =>
          getIsInPopover(element),
        );

        if (!isInsidePopover) {
          const hasSelections =
            tableRef.current?.getHasCellRangeSelection() ||
            tableRef.current?.getHasRowSelection();
          blurCell();
          if (hasSelections) tableRef.current?.clearSelection();
        }
      }
    }

    document.addEventListener("mousedown", onOutsideClick);
    return () => {
      document.removeEventListener("mousedown", onOutsideClick);
    };
  }, [blurCell]);

  React.useEffect(() => {
    function onSelectStart(event: Event) {
      event.preventDefault();
    }

    function onContextMenu(event: Event) {
      event.preventDefault();
    }

    function onCleanup() {
      document.removeEventListener("selectstart", onSelectStart);
      document.removeEventListener("contextmenu", onContextMenu);
      document.body.style.userSelect = "";
    }

    const subscription = table.atoms.cellDragAnchor.subscribe(() => {
      if (table.atoms.cellDragAnchor.get()) {
        document.addEventListener("selectstart", onSelectStart);
        document.addEventListener("contextmenu", onContextMenu);
        document.body.style.userSelect = "none";
      } else {
        onCleanup();
      }
    });

    return () => {
      onCleanup();
      subscription.unsubscribe();
    };
  }, [table]);

  React.useEffect(() => {
    let rafId: number | null = null;
    let mouseX = 0;
    let mouseY = 0;
    let mouseReady = false;
    let active = false;
    let lastSelectionTime = 0;
    let resizeObserver: ResizeObserver | null = null;

    let cachedRect: DOMRect | null = null;
    let cachedHdrH = 0;
    let cachedFtrH = 0;
    let cachedLpw = 0;
    let cachedRpw = 0;

    function getAutoScrollSpeed(dist: number): number {
      const t = Math.min(dist / AUTO_SCROLL_SPEED_RAMP_ZONE, 1);
      return Math.round(
        AUTO_SCROLL_MIN_SPEED +
          (AUTO_SCROLL_MAX_SPEED - AUTO_SCROLL_MIN_SPEED) * t,
      );
    }

    function cacheLayout(container: HTMLDivElement) {
      cachedRect = container.getBoundingClientRect();
      cachedHdrH = headerRef.current?.getBoundingClientRect().height ?? 0;
      cachedFtrH = footerRef.current?.getBoundingClientRect().height ?? 0;
      const tbl = tableRef.current;
      if (tbl) {
        cachedLpw = tbl
          .getStartVisibleLeafColumns()
          .reduce((s, c) => s + c.getSize(), 0);
        cachedRpw = tbl
          .getEndVisibleLeafColumns()
          .reduce((s, c) => s + c.getSize(), 0);
      }
    }

    function tick() {
      if (!active) return;
      const container = dataGridRef.current;
      const tbl = tableRef.current;

      if (!container || !tbl) {
        onAutoScrollStop();
        return;
      }

      if (!mouseReady || !cachedRect) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const rect = cachedRect;
      const { dir } = dragDepsRef.current;
      const hasNegativeScroll = container.scrollLeft < 0;
      const isActuallyRtl = dir === "rtl" || hasNegativeScroll;

      const dataTop = rect.top + cachedHdrH;
      const dataBottom = rect.bottom - cachedFtrH;

      const scrollAreaLeft = isActuallyRtl
        ? rect.left + cachedRpw
        : rect.left + cachedLpw;
      const scrollAreaRight = isActuallyRtl
        ? rect.right - cachedLpw
        : rect.right - cachedRpw;

      let dy = 0;
      let dx = 0;

      if (mouseY < dataTop) dy = -getAutoScrollSpeed(dataTop - mouseY);
      else if (mouseY > dataBottom)
        dy = getAutoScrollSpeed(mouseY - dataBottom);

      if (mouseX < scrollAreaLeft)
        dx = -getAutoScrollSpeed(scrollAreaLeft - mouseX);
      else if (mouseX > scrollAreaRight)
        dx = getAutoScrollSpeed(mouseX - scrollAreaRight);

      if (dx === 0 && dy === 0) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      container.scrollTop += dy;
      container.scrollLeft += dx;

      const now = performance.now();
      if (now - lastSelectionTime < AUTO_SCROLL_SELECTION_THROTTLE_MS) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const { rowSize: rh } = dragDepsRef.current;
      const columnIds = getColumnIds();
      if (columnIds.length === 0) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const rows = tbl.getRowModel().rows;
      const clampedY = Math.max(dataTop, Math.min(mouseY, dataBottom));
      const absY = container.scrollTop + (clampedY - dataTop);
      const rowId =
        rows[Math.max(0, Math.min(Math.floor(absY / rh), rows.length - 1))]?.id;

      if (!rowId) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const dragStartCell = tbl.atoms.cellDragAnchor.get();
      const selectionEdge = getSelectionEdgePosition(
        tbl.atoms.cellSelection.get(),
      );

      let columnId: string | undefined;

      if (dx !== 0) {
        const clampedX = Math.max(rect.left, Math.min(mouseX, rect.right));
        const relX = clampedX - rect.left;

        const leftZoneWidth = isActuallyRtl ? cachedRpw : cachedLpw;
        const rightZoneWidth = isActuallyRtl ? cachedLpw : cachedRpw;

        if (relX < leftZoneWidth) {
          const columns = isActuallyRtl
            ? tbl.getEndVisibleLeafColumns()
            : tbl.getStartVisibleLeafColumns();
          columnId = columns[0]?.id ?? columnIds[0] ?? "";
          let cx = 0;
          for (const col of columns) {
            if (relX < cx + col.getSize()) {
              columnId = col.id;
              break;
            }
            cx += col.getSize();
          }
        } else if (relX > rect.width - rightZoneWidth) {
          const columns = isActuallyRtl
            ? tbl.getStartVisibleLeafColumns()
            : tbl.getEndVisibleLeafColumns();
          columnId = columns[0]?.id ?? columnIds[columnIds.length - 1] ?? "";
          let cx = rect.width - rightZoneWidth;
          for (const col of columns) {
            if (relX < cx + col.getSize()) {
              columnId = col.id;
              break;
            }
            cx += col.getSize();
          }
        } else {
          const center = tbl.getCenterVisibleLeafColumns();
          const centerZoneWidth = rect.width - leftZoneWidth - rightZoneWidth;
          const distFromVisualLeft = relX - leftZoneWidth;

          let absX: number;
          if (isActuallyRtl) {
            const scrollFromRight = hasNegativeScroll
              ? -container.scrollLeft
              : container.scrollWidth -
                container.clientWidth -
                container.scrollLeft;
            absX = scrollFromRight + (centerZoneWidth - distFromVisualLeft);
          } else {
            absX = container.scrollLeft + distFromVisualLeft;
          }

          columnId =
            center[center.length - 1]?.id ??
            columnIds[columnIds.length - 1] ??
            "";
          let cw = 0;
          for (const col of center) {
            cw += col.getSize();
            if (absX < cw) {
              columnId = col.id;
              break;
            }
          }
        }
      }

      if (!columnId) {
        columnId = selectionEdge?.columnId ?? columnIds[0] ?? "";
      }

      if (
        dragStartCell &&
        (rowId !== selectionEdge?.rowId || columnId !== selectionEdge?.columnId)
      ) {
        dragDepsRef.current.selectRange(dragStartCell, { rowId, columnId });
        lastSelectionTime = now;
      }

      rafId = requestAnimationFrame(tick);
    }

    function onMove(event: MouseEvent) {
      mouseX = event.clientX;
      mouseY = event.clientY;
      mouseReady = true;
    }

    function onUp() {
      onAutoScrollStop();
      tableRef.current?.endCellDrag();
    }

    function onAutoScrollStart() {
      if (active) return;

      const container = dataGridRef.current;
      if (!container) return;

      active = true;
      mouseReady = false;
      cachedRect = null;
      lastSelectionTime = 0;
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      resizeObserver = new ResizeObserver(() => {
        const currentContainer = dataGridRef.current;
        if (currentContainer) cacheLayout(currentContainer);
      });
      resizeObserver.observe(container);
      rafId = requestAnimationFrame(() => {
        const currentContainer = dataGridRef.current;
        if (currentContainer) cacheLayout(currentContainer);
        rafId = requestAnimationFrame(tick);
      });
    }

    function onAutoScrollStop() {
      if (!active) return;
      active = false;
      cachedRect = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      resizeObserver?.disconnect();
      resizeObserver = null;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    if (table.atoms.cellDragAnchor.get()) onAutoScrollStart();

    const subscription = table.atoms.cellDragAnchor.subscribe(() => {
      const isDragging = table.atoms.cellDragAnchor.get() !== null;
      if (isDragging && !active) onAutoScrollStart();
      else if (!isDragging && active) onAutoScrollStop();
    });

    return () => {
      onAutoScrollStop();
      subscription.unsubscribe();
    };
  }, [table, dragDepsRef, getColumnIds]);

  useIsomorphicLayoutEffect(() => {
    const rafId = requestAnimationFrame(() => {
      rowVirtualizer.measure();
    });
    return () => cancelAnimationFrame(rafId);
  }, [
    rowHeight,
    table.state.columnFilters,
    table.state.columnPinning,
    table.state.columnSizing,
    table.state.columnVisibility,
    table.state.rowSelection,
    table.state.sorting,
  ]);

  const virtualTotalSize = rowVirtualizer.getTotalSize();
  const virtualItems = rowVirtualizer.getVirtualItems();
  const measureElement = rowVirtualizer.measureElement;

  return React.useMemo(
    () => ({
      dataGridRef,
      headerRef,
      rowMapRef,
      footerRef,
      dir,
      table,
      dataGridBodyProps,
      virtualTotalSize,
      virtualItems,
      measureElement,
      columns,
      columnSizeVars,
      readOnlyColumnIds,
      rowHeight,
      onRowAdd: propsRef.current.onRowAdd ? onRowAdd : undefined,
      adjustLayout,
    }),
    [
      propsRef,
      dir,
      table,
      dataGridBodyProps,
      virtualTotalSize,
      virtualItems,
      measureElement,
      columns,
      columnSizeVars,
      readOnlyColumnIds,
      rowHeight,
      onRowAdd,
      adjustLayout,
    ],
  );
}

export { useDataGrid, type UseDataGridProps };
