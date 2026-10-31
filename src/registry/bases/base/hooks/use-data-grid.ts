import type { Virtualizer, VirtualizerOptions } from "@tanstack/react-virtual";

import { useValueAsRef } from "@base-ui/utils/useValueAsRef";
import {
  type CellSelectionState,
  type ColumnDef,
  type ColumnVisibilityState,
  functionalUpdate,
  makeStateUpdater,
  type RowData,
  type RowSelectionState,
  type Table,
  type TableOptions,
  type TableState,
  type Updater,
  useTable,
} from "@tanstack/react-table";
import * as React from "react";
import { toast } from "sonner";

import type {
  CellPosition,
  ClipboardNotice,
  CreateRowDetails,
  DataChangeDetails,
  NavigationDirection,
} from "@/lib/data-grid-types";

import {
  type DataGridFeatures,
  dataGridFeatures,
} from "@/lib/data-grid-features";
import {
  getCellElement,
  getCellFocusTarget,
  getCellKey,
  getFocusedCellPosition,
  getHasCellRangeSelection,
  getIsDataColumn,
  getIsEditableTarget,
  getIsEventOnScrollbar,
  getIsInPopover,
  getRowDisplayIndex,
  getSelectionEdgePosition,
  renderDefaultCell,
  revokeFileObjectUrls,
  scrollCellIntoView,
} from "@/lib/data-grid-utils";
import { useDirection } from "@/registry/bases/base/ui/direction";

const OVERSCAN = 6;
const VIEWPORT_OFFSET = 1;
const MIN_COLUMN_SIZE = 60;
const MAX_COLUMN_SIZE = 800;
const COLUMN_RESIZE_STEP = 10;
const AUTO_SCROLL_EDGE_ZONE = 50;
const AUTO_SCROLL_SPEED_RAMP_ZONE = AUTO_SCROLL_EDGE_ZONE * 3;
const AUTO_SCROLL_MIN_SPEED = 8;
const AUTO_SCROLL_MAX_SPEED = 40;
const AUTO_SCROLL_SELECTION_THROTTLE_MS = 32;
const UTILITY_COLUMN_IDS = new Set(["select", "actions"]);
const SEARCH_SHORTCUT_KEY = "f";

interface UseDataGridProps<TData extends RowData> extends Omit<
  TableOptions<DataGridFeatures, TData>,
  "features"
> {
  overscan?: number;
  autoFocus?: boolean | Partial<CellPosition>;
}

function useDataGrid<TData extends RowData>({
  data: dataProp,
  columns,
  overscan = OVERSCAN,
  dir: dirProp,
  ...props
}: UseDataGridProps<TData>) {
  const [pendingEdit, setPendingEdit] = React.useState({
    from: dataProp,
    to: dataProp,
  });
  const dataPropRef = useValueAsRef(dataProp);
  const data = pendingEdit.from === dataProp ? pendingEdit.to : dataProp;

  const contextDir = useDirection();
  const dir = dirProp ?? contextDir;

  const dataGridRef = React.useRef<HTMLDivElement>(null);
  const tableRef = React.useRef<Table<DataGridFeatures, TData>>(null);
  const rowVirtualizerRef =
    React.useRef<Virtualizer<HTMLDivElement, Element>>(null);
  const columnVirtualizerRef =
    React.useRef<Virtualizer<HTMLDivElement, Element>>(null);
  const headerRef = React.useRef<HTMLDivElement>(null);
  const rowMapRef = React.useRef<Map<number, HTMLDivElement>>(new Map());
  const footerRef = React.useRef<HTMLDivElement>(null);
  const pendingFocusRef = React.useRef<{
    cell: CellPosition;
    shouldScroll: boolean;
  } | null>(null);

  const propsRef = useValueAsRef(props);
  const stableProps = useStableProps(props, propsRef);

  const onDataChange = React.useCallback(
    (nextData: TData[], details: DataChangeDetails<TData>) => {
      setPendingEdit({ from: dataPropRef.current, to: nextData });
      propsRef.current.onDataChange?.(nextData, details);
    },
    [dataPropRef, propsRef],
  );

  const getRowIdAtDisplayIndex = React.useCallback(
    (displayIndex: number) =>
      tableRef.current?.getRowModel().rows[displayIndex]?.id,
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

      const rowIndex = getRowDisplayIndex(currentTable, cell.rowId);
      if (rowIndex === -1) return false;

      if (shouldScroll) {
        rowVirtualizerRef.current?.scrollToIndex(rowIndex, { align: "auto" });
      }

      const cellElement = getCellElement(container, cell.rowId, cell.columnId);
      if (!cellElement) {
        const centerIndex = currentTable
          .getCenterVisibleLeafColumns()
          .findIndex((column) => column.id === cell.columnId);
        if (shouldScroll && centerIndex !== -1) {
          columnVirtualizerRef.current?.scrollToIndex(centerIndex, {
            align: "auto",
          });
        }
        return false;
      }

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

      pendingFocusRef.current = { cell, shouldScroll };
      const container = dataGridRef.current;
      if (container && document.activeElement !== container) {
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

  const getIsDataColumnId = React.useCallback(
    (columnId: string) =>
      getIsDataColumn(tableRef.current?.getAllFlatColumnsById()[columnId]),
    [],
  );

  const getNavigableColumnIds = React.useCallback(
    () => getColumnIds().filter(getIsDataColumnId),
    [getColumnIds, getIsDataColumnId],
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

  const onRowsDelete = React.useCallback((rowIds: string[]) => {
    tableRef.current?.deleteRows(rowIds);
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
        focusedCell !== null && !getIsDataColumnId(focusedCell.columnId);
      // The focused cell stays the active range so selecting rows elsewhere doesn't move focus and scroll to them
      if (focusedCell) {
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
    [getNavigableColumnIds, getIsDataColumnId, propsRef, getFocusedCell],
  );

  const defaultColumn: Partial<ColumnDef<DataGridFeatures, TData>> =
    React.useMemo(
      () => ({
        minSize: MIN_COLUMN_SIZE,
        maxSize: MAX_COLUMN_SIZE,
        cell: renderDefaultCell,
      }),
      [],
    );

  const dataGridBodyEventHandlers = React.useMemo<
    React.ComponentProps<"div">
  >(() => {
    let hoveredCellKey: string | null = null;

    function getEventCell(event: React.SyntheticEvent) {
      const container = dataGridRef.current;
      const target = event.target;
      if (!container || !(target instanceof Element)) return null;
      if (!container.contains(target)) return null;

      // Utility cells manage their own pointer and focus events
      const cellElement = target.closest<HTMLElement>(
        '[data-slot="data-grid-cell"]:not([data-utility])',
      );
      if (!cellElement) return null;

      const { rowId, columnId } = cellElement.dataset;
      if (!rowId || !columnId) return null;

      const editingCell = tableRef.current?.getEditingCell();
      if (editingCell?.rowId === rowId && editingCell.columnId === columnId) {
        return null;
      }
      return { rowId, columnId };
    }

    function getPressedCell(event: React.MouseEvent<HTMLElement>) {
      if (getIsEventOnScrollbar(event)) return null;
      return getEventCell(event);
    }

    return {
      onClick: (event) => {
        const cell = getPressedCell(event);
        if (!cell) return;
        event.preventDefault();
        onCellClick(cell.rowId, cell.columnId, event);
      },
      onDoubleClick: (event) => {
        const cell = getPressedCell(event);
        if (!cell) return;
        event.preventDefault();
        onCellDoubleClick(cell.rowId, cell.columnId);
      },
      onMouseDown: (event) => {
        const cell = getPressedCell(event);
        if (cell) onCellMouseDown(cell.rowId, cell.columnId, event);
      },
      onMouseOver: (event) => {
        const cell = getEventCell(event);
        const cellKey = cell ? getCellKey(cell.rowId, cell.columnId) : null;
        if (cellKey === hoveredCellKey) return;
        hoveredCellKey = cellKey;
        if (cell) onCellMouseEnter(cell.rowId, cell.columnId);
      },
      onMouseLeave: () => {
        hoveredCellKey = null;
      },
      onMouseUp: (event) => {
        if (getEventCell(event)) onCellMouseUp();
      },
      onContextMenu: (event) => {
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
        column.id && UTILITY_COLUMN_IDS.has(column.id)
          ? {
              ...column,
              enableCellSelection: column.enableCellSelection ?? false,
              enableOrdering: column.enableOrdering ?? false,
            }
          : column,
      ),
    [columns],
  );

  const enableCellEditing =
    !props.readOnly && props.enableCellEditing !== false;
  const hasRowAdd = !!props.createRow;

  const tableOptions = React.useMemo<
    TableOptions<DataGridFeatures, TData>
  >(() => {
    return {
      ...stableProps,
      onCellScroll: (cell) =>
        revealCell(cell, { shouldFocus: false, shouldScroll: true }),
      onCellFocus: (cell) => focusCellElement(cell),
      onClipboardNotice: (notice) =>
        (propsRef.current.onClipboardNotice ?? toastClipboardNotice)(notice),
      features: dataGridFeatures,
      data,
      onDataChange,
      columns: tableColumns,
      defaultColumn,
      autoResetCellSelection: false,
      enableCellEditing,
      onRowSelectionChange,
      onColumnVisibilityChange,
      columnResizeMode: "onChange",
      columnResizeDirection: dir,
      dir,
    };
  }, [
    stableProps,
    propsRef,
    revealCell,
    focusCellElement,
    data,
    onDataChange,
    tableColumns,
    defaultColumn,
    enableCellEditing,
    onRowSelectionChange,
    onColumnVisibilityChange,
    dir,
  ]);

  const table = useTable(tableOptions, selectTableState);

  const { store } = table;
  React.useEffect(() => () => revokeFileObjectUrls(store), [store]);

  if (tableRef.current === null) {
    tableRef.current = table;
  }

  const rowSize = table.getRowSize();

  const dragDepsRef = useValueAsRef({
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
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- the table is stable, so its columns and sizing state invalidate the sizes
  }, [tableColumns, table.state.columnResizing, table.state.columnSizing]);

  const isFirefox = React.useSyncExternalStore(
    React.useCallback(() => () => {}, []),
    React.useCallback(() => navigator.userAgent.includes("Firefox"), []),
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

  const rowVirtualizerOptions = React.useMemo<
    Pick<VirtualizerOptions<HTMLDivElement, Element>, "overscan">
  >(() => ({ overscan }), [overscan]);

  const skipDataGridTabStop = React.useCallback(() => {
    const container = dataGridRef.current;
    if (!container) return;

    container.tabIndex = -1;
    requestAnimationFrame(() => {
      container.tabIndex = 0;
    });
  }, []);

  const addRow = React.useCallback(
    async (trigger: CreateRowDetails, columnId: string | undefined) => {
      const { readOnly, createRow } = propsRef.current;
      if (readOnly || !createRow) return;

      let row: TData | null;
      try {
        row = await createRow(trigger);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to add row",
        );
        return;
      }
      const currentTable = tableRef.current;
      if (!row || !currentTable) return;

      const [rowId] = currentTable.addRows(
        [row],
        trigger.reason === "insert-below"
          ? { afterRowId: trigger.afterRowId }
          : undefined,
      );
      if (!rowId || !columnId) return;

      currentTable.clearSelection();
      focusCell(rowId, columnId);
    },
    [propsRef, focusCell],
  );

  const onRowAdd = React.useCallback(
    (
      event?:
        | React.MouseEvent<HTMLDivElement>
        | React.KeyboardEvent<HTMLDivElement>,
    ) =>
      addRow(
        { reason: "add-row-press", event },
        getNavigableColumnIds().find(getIsDataColumnId),
      ),
    [addRow, getNavigableColumnIds, getIsDataColumnId],
  );

  const getColumnHeaderTrigger = React.useCallback((columnId: string) => {
    return (
      headerRef.current?.querySelector<HTMLElement>(
        `[data-slot="data-grid-header-cell"][data-column-id="${CSS.escape(columnId)}"] :is(button, [role="checkbox"])`,
      ) ?? null
    );
  }, []);

  const focusColumnHeader = React.useCallback(
    (columnId: string) => {
      const trigger = getColumnHeaderTrigger(columnId);
      if (!trigger) return false;

      tableRef.current?.resetCellSelection(true);
      tableRef.current?.clearRowSelection();
      tableRef.current?.setEditingCell(null);
      trigger.focus();
      return true;
    },
    [getColumnHeaderTrigger],
  );

  const onColumnHeaderKeyDown = React.useCallback(
    (event: KeyboardEvent, columnId: string) => {
      const { key, shiftKey, ctrlKey, metaKey, altKey } = event;
      const isHorizontalArrow = key === "ArrowLeft" || key === "ArrowRight";
      if (ctrlKey || metaKey || (altKey && (shiftKey || !isHorizontalArrow))) {
        return false;
      }

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

      function resizeColumnBy(delta: number) {
        const currentTable = tableRef.current;
        const column = currentTable?.getColumn(columnId);
        if (!currentTable || !column?.getCanResize()) return;

        const defaultColumnDef = currentTable.getDefaultColumnDef();
        const minSize =
          column.columnDef.minSize ?? defaultColumnDef.minSize ?? 0;
        const maxSize =
          column.columnDef.maxSize ??
          defaultColumnDef.maxSize ??
          Number.POSITIVE_INFINITY;
        const size = Math.min(
          Math.max(column.getSize() + delta, minSize),
          maxSize,
        );
        currentTable.setColumnSizing((prev) => ({ ...prev, [columnId]: size }));
      }

      switch (key) {
        case "ArrowLeft":
        case "ArrowRight": {
          const isNext = (key === "ArrowRight") !== isRtl;
          if (altKey) {
            resizeColumnBy(isNext ? COLUMN_RESIZE_STEP : -COLUMN_RESIZE_STEP);
          } else if (shiftKey) {
            tableRef.current?.getColumn(columnId)?.move(isNext ? 1 : -1);
          } else {
            focusHeaderAt(headerIndex + (isNext ? 1 : -1));
          }
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
          // Stops the menu trigger from opening its menu
          event.stopPropagation();
          const firstRowId = getRowIdAtDisplayIndex(0);
          if (!firstRowId) break;
          tableRef.current?.clearRowSelection();
          focusCell(firstRowId, columnId);
          break;
        }
        case "Escape":
          dataGridRef.current?.focus();
          break;
        case "Tab":
          if (shiftKey) {
            if (headerIndex === 0) {
              skipDataGridTabStop();
              return true;
            }
            focusHeaderAt(headerIndex - 1);
          } else if (headerIndex < headerColumnIds.length - 1) {
            focusHeaderAt(headerIndex + 1);
          } else {
            const firstRowId = getRowIdAtDisplayIndex(0);
            const firstColumnId = getNavigableColumnIds()[0];
            if (!firstRowId || !firstColumnId) return true;
            tableRef.current?.clearRowSelection();
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
      skipDataGridTabStop,
      focusCell,
      getRowIdAtDisplayIndex,
    ],
  );

  const onDataGridKeyDown = React.useCallback(
    (event: KeyboardEvent) => {
      const currentTable = tableRef.current;
      if (!currentTable) return;

      const cellSelection = currentTable.atoms.cellSelection.get();
      const focusedCell = getFocusedCellPosition(cellSelection);
      const hasCellRangeSelection = getHasCellRangeSelection(cellSelection);
      const { key, ctrlKey, metaKey, shiftKey, altKey } = event;
      const isCtrlPressed = ctrlKey || metaKey;

      if (
        currentTable.options.enableSearch &&
        isCtrlPressed &&
        !shiftKey &&
        key === SEARCH_SHORTCUT_KEY
      ) {
        event.preventDefault();
        currentTable.openSearch();
        return;
      }

      if (currentTable.getSearchOpen() && !currentTable.getEditingCell()) {
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

      if (currentTable.getEditingCell()) return;

      const headerCell =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(
              '[data-slot="data-grid-header-cell"]',
            )
          : null;
      const headerColumnId = headerCell?.dataset.columnId;
      if (headerColumnId && onColumnHeaderKeyDown(event, headerColumnId)) {
        return;
      }

      if (
        isCtrlPressed &&
        (key === "Backspace" || key === "Delete") &&
        !propsRef.current.readOnly &&
        propsRef.current.enableRowDeletion
      ) {
        const rowIds = new Set<string>();

        if (currentTable.getHasRowSelection()) {
          const rowSelection = currentTable.atoms.rowSelection.get();
          for (const row of currentTable.getRowModel().rows) {
            if (rowSelection[row.id]) rowIds.add(row.id);
          }
        } else if (hasCellRangeSelection) {
          for (const { rowId } of currentTable.getSelectedCells()) {
            rowIds.add(rowId);
          }
        } else if (focusedCell) {
          rowIds.add(focusedCell.rowId);
        }

        if (rowIds.size > 0) {
          event.preventDefault();
          onRowsDelete(Array.from(rowIds));
        }
        return;
      }

      if (!focusedCell) return;

      if (
        !headerColumnId &&
        (key === "ContextMenu" || (shiftKey && key === "F10"))
      ) {
        event.preventDefault();
        const container = dataGridRef.current;
        const cellElement =
          container &&
          getCellElement(container, focusedCell.rowId, focusedCell.columnId);
        if (!cellElement) return;
        const rect = cellElement.getBoundingClientRect();
        currentTable.openContextMenu({
          x: dir === "rtl" ? rect.right : rect.left,
          y: rect.bottom,
        });
        return;
      }

      let direction: NavigationDirection | null = null;

      const isUtilityCellFocused = !getIsDataColumnId(focusedCell.columnId);

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

      const canCopyCells =
        !isUtilityCellFocused || currentTable.getHasRowSelection();

      if (isCtrlPressed && !shiftKey && key === "a") {
        event.preventDefault();
        currentTable.selectAllDataCells();
        return;
      }

      if (isCtrlPressed && !shiftKey && key === "c" && canCopyCells) {
        event.preventDefault();
        void currentTable.copySelectedCells();
        return;
      }

      if (
        isCtrlPressed &&
        !shiftKey &&
        key === "x" &&
        canCopyCells &&
        !propsRef.current.readOnly
      ) {
        event.preventDefault();
        void currentTable.cutSelectedCells();
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
        void currentTable.pasteCells();
        return;
      }

      if (
        (key === "Delete" || key === "Backspace") &&
        !isCtrlPressed &&
        !isUtilityCellFocused &&
        !propsRef.current.readOnly
      ) {
        const cellsToClear = currentTable.getSelectedCells();

        if (cellsToClear.length > 0) {
          event.preventDefault();

          currentTable.clearCells(cellsToClear);

          if (hasCellRangeSelection) {
            currentTable.clearSelection();
          }

          if (currentTable.getCutCellGrid().length) {
            currentTable.resetCutCellGrid(true);
          }
        }
        return;
      }

      if (
        key === "Enter" &&
        shiftKey &&
        !propsRef.current.readOnly &&
        propsRef.current.createRow
      ) {
        event.preventDefault();
        const currentColumnId = isUtilityCellFocused
          ? getNavigableColumnIds()[0]
          : focusedCell.columnId;

        void addRow(
          { reason: "insert-below", event, afterRowId: focusedCell.rowId },
          currentColumnId,
        );
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
            getRowDisplayIndex(currentTable, focusedCell.rowId) === 0 &&
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
          if (hasCellRangeSelection || currentTable.getHasRowSelection()) {
            currentTable.clearSelection();
          } else {
            blurCell();
            dataGridRef.current?.focus();
          }
          return;
        case "Tab": {
          if (isCtrlPressed || altKey) return;

          direction = shiftKey ? "shift+tab" : "tab";
          if (!currentTable.getNavigationTarget(focusedCell, direction)) {
            if (shiftKey) skipDataGridTabStop();
            return;
          }
          break;
        }
      }

      if (!direction) return;
      event.preventDefault();

      const extend = shiftKey && key !== "Tab";
      const pageSize = rowVirtualizerRef.current?.getVirtualItems().length;

      if (!extend && hasCellRangeSelection) currentTable.clearSelection();
      currentTable.navigate(direction, { extend, pageSize });
    },
    [
      dir,
      propsRef,
      blurCell,
      getNavigableColumnIds,
      getIsDataColumnId,
      onRowsDelete,
      addRow,
      focusColumnHeader,
      onColumnHeaderKeyDown,
      skipDataGridTabStop,
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

      // Works from anywhere but text fields, editors and another grid, like an app's undo
      const undoRedoKey = key.toLowerCase();
      if (
        currentTable &&
        isCommandPressed &&
        (undoRedoKey === "z" || undoRedoKey === "y") &&
        (currentTable.options.enableUndoRedo ??
          !currentTable.options.readOnly) &&
        !getIsEditableTarget(target) &&
        !(getIsInPopover(target) && !target.closest('[role="toolbar"]')) &&
        (isInDataGrid || !target.closest('[role="grid"]'))
      ) {
        event.preventDefault();
        const isRedo = undoRedoKey === "y" || shiftKey;
        const count = isRedo ? currentTable.redo() : currentTable.undo();
        if (count === 0) {
          toast.info(isRedo ? "No actions to redo" : "No actions to undo");
        } else {
          toast.success(
            `${count} action${count === 1 ? "" : "s"} ${isRedo ? "redone" : "undone"}`,
          );
        }
        return;
      }

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
  }, [
    propsRef,
    data,
    columns,
    getFocusedCell,
    getNavigableColumnIds,
    focusCell,
  ]);

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

  React.useEffect(() => {
    function onFocusIn(event: FocusEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!dataGridRef.current?.contains(target)) return;

      const columnId =
        target.closest<HTMLElement>('[data-slot="data-grid-header-cell"]')
          ?.dataset.columnId ?? null;
      if (tableRef.current?.getFocusedHeaderColumnId() === columnId) return;
      tableRef.current?.setFocusedHeaderColumnId(columnId);
    }

    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
    };
  }, []);

  React.useEffect(() => {
    const container = dataGridRef.current;
    if (!container) return;

    let rafId = 0;

    function onFocusOut(event: FocusEvent) {
      if (event.relatedTarget || tableRef.current?.getEditingCell()) return;

      cancelAnimationFrame(rafId);
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
        } else if (
          table.getFocusedHeaderColumnId() === null &&
          dataGridRef.current?.contains(document.activeElement)
        ) {
          focusCellElement(focusedCell);
        }
        return;
      }

      if (
        isEdgeChanged &&
        edgeCell &&
        !table.atoms.cellDragAnchor.get() &&
        !table.getHasRowSelection()
      ) {
        revealCell(edgeCell, { shouldFocus: false, shouldScroll: true });
      }
    });

    let prevEditingCell = table.atoms.editingCell.get();
    const editingSubscription = table.atoms.editingCell.subscribe(() => {
      const editingCell = table.atoms.editingCell.get();
      const wasEditing = !!prevEditingCell;
      prevEditingCell = editingCell;
      if (!wasEditing || editingCell) return;

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

  const { pasteDialog: pasteDialogAtom, cellSelection: cellSelectionAtom } =
    table.atoms;

  React.useEffect(() => {
    let prevPasteDialogOpen = pasteDialogAtom.get().open;
    let rafId = 0;

    const subscription = pasteDialogAtom.subscribe(() => {
      const isPasteDialogOpen = pasteDialogAtom.get().open;
      const wasPasteDialogOpen = prevPasteDialogOpen;
      prevPasteDialogOpen = isPasteDialogOpen;
      if (!wasPasteDialogOpen || isPasteDialogOpen) return;

      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const focusedCell = getFocusedCellPosition(cellSelectionAtom.get());
        if (focusedCell) focusCellElement(focusedCell);
      });
    });

    return () => {
      cancelAnimationFrame(rafId);
      subscription.unsubscribe();
    };
  }, [pasteDialogAtom, cellSelectionAtom, focusCellElement]);

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

  const dataGridBodyProps = React.useMemo(
    () => ({
      ...dataGridBodyEventHandlers,
      style: {
        contain: adjustLayout ? "layout paint" : "strict",
      } satisfies React.CSSProperties,
    }),
    [dataGridBodyEventHandlers, adjustLayout],
  );

  return React.useMemo(
    () => ({
      table,
      dataGridRef,
      headerRef,
      footerRef,
      rowMapRef,
      rowVirtualizerRef,
      columnVirtualizerRef,
      rowVirtualizerOptions,
      dataGridBodyProps,
      columnSizeVars,
      dir,
      adjustLayout,
      onRowAdd: hasRowAdd ? onRowAdd : undefined,
    }),
    [
      table,
      rowVirtualizerOptions,
      dataGridBodyProps,
      columnSizeVars,
      dir,
      adjustLayout,
      hasRowAdd,
      onRowAdd,
    ],
  );
}

let nextObjectId = 0;
const objectIds = new WeakMap<object, number>();

function useStableProps<TProps extends object>(
  props: TProps,
  propsRef: React.RefObject<TProps>,
): TProps {
  let propsKey = "";
  for (const [name, value] of Object.entries(props)) {
    let valueKey = `${typeof value}${String(value)}`;
    if (typeof value === "function") {
      valueKey = "fn";
    } else if (typeof value === "object" && value !== null) {
      let id = objectIds.get(value);
      if (id === undefined) {
        id = nextObjectId++;
        objectIds.set(value, id);
      }
      valueKey = `obj${id}`;
    }
    propsKey += `${name}:${valueKey}\u0000`;
  }

  return React.useMemo(() => {
    const stableProps = { ...props };
    for (const [key, value] of Object.entries(props)) {
      if (typeof value !== "function") continue;
      Reflect.set(stableProps, key, (...args: unknown[]) => {
        const callback: unknown = Reflect.get(propsRef.current, key);
        if (typeof callback === "function") return callback(...args);
      });
    }
    return stableProps;
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- callbacks read `propsRef`, so only non-function prop changes rebuild
  }, [propsKey]);
}

function selectTableState(state: TableState<DataGridFeatures>) {
  return {
    rowHeight: state.rowHeight,
    sorting: state.sorting,
    columnFilters: state.columnFilters,
    columnVisibility: state.columnVisibility,
    columnPinning: state.columnPinning,
    columnOrder: state.columnOrder,
    columnSizing: state.columnSizing,
    columnResizing: state.columnResizing,
    undoRedo: state.undoRedo,
  };
}

function toastClipboardNotice({ variant, message }: ClipboardNotice) {
  if (variant === "error") toast.error(message);
  else toast.success(message);
}

export { useDataGrid, type UseDataGridProps };
