"use client";

import { type Cell, flexRender, type RowData } from "@tanstack/react-table";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type { DataGridCellProps } from "@/lib/data-grid-types";

import { getHasCustomCell } from "@/lib/data-grid-utils";
import { DataGridCell } from "@/registry/bases/radix/components/data-grid/data-grid-cell";
import { DataGridCellPreview } from "@/registry/bases/radix/components/data-grid/data-grid-cell-preview";
import {
  CheckboxCell,
  DateCell,
  FileCell,
  LongTextCell,
  MultiSelectCell,
  NumberCell,
  SelectCell,
  ShortTextCell,
  UrlCell,
} from "@/registry/bases/radix/components/data-grid/data-grid-cell-variants";

interface DataGridDataCellProps<
  TData extends RowData,
> extends DataGridCellProps<TData> {
  isScrolling: boolean;
}

export const DataGridDataCell = React.memo(
  DataGridDataCellImpl,
  (prev, next) => {
    // Only the end of a scroll matters, when previews switch to full cells
    if (prev.isScrolling && !next.isScrolling) return false;
    if (prev.columnIndex !== next.columnIndex) return false;
    if (prev.isFocused !== next.isFocused) return false;
    if (prev.isEditing !== next.isEditing) return false;
    if (prev.isSelected !== next.isSelected) return false;
    if (prev.isSearchMatch !== next.isSearchMatch) return false;
    if (prev.isActiveSearchMatch !== next.isActiveSearchMatch) return false;
    if (prev.presence?.color !== next.presence?.color) return false;
    if (prev.presence?.name !== next.presence?.name) return false;
    if (prev.readOnly !== next.readOnly) return false;
    if (prev.rowHeight !== next.rowHeight) return false;
    if (prev.width !== next.width) return false;
    if (prev.pinned !== next.pinned) return false;
    if (prev.pinnedOffset !== next.pinnedOffset) return false;
    if (prev.grow !== next.grow) return false;
    if (prev.showStartBorder !== next.showStartBorder) return false;
    if (prev.showEndBorder !== next.showEndBorder) return false;
    if (prev.cell.row.id !== next.cell.row.id) return false;
    if (prev.cell.column.id !== next.cell.column.id) return false;
    if (prev.cell.column.columnDef.cell !== next.cell.column.columnDef.cell) {
      return false;
    }
    // Written cells take their values straight from `updateCells`
    if (next.cell.column.columnDef.meta?.writeCell) return true;
    if (getHasCustomCell(next.cell.column)) {
      return prev.cell.row.original === next.cell.row.original;
    }
    return prev.cell.getValue() === next.cell.getValue();
  },
) as typeof DataGridDataCellImpl;

function DataGridDataCellImpl<TData extends RowData>({
  isScrolling,
  ...props
}: DataGridDataCellProps<TData>) {
  const { cell } = props;
  const writeCell = cell.column.columnDef.meta?.writeCell;
  const hasCustomCell = getHasCustomCell(cell.column);

  const rowId = cell.row.id;
  const [isPreview, setIsPreview] = React.useState(isScrolling);
  const [prevRowId, setPrevRowId] = React.useState(rowId);
  if (rowId !== prevRowId) {
    setPrevRowId(rowId);
    if (isScrolling && !isPreview) setIsPreview(true);
  }
  if (isPreview && !isScrolling) setIsPreview(false);

  if (writeCell) {
    return <DataGridWrittenCell key={rowId} {...props} writeCell={writeCell} />;
  }

  if (isPreview && !props.isFocused && !props.isEditing && !hasCustomCell) {
    return (
      <DataGridCellPreview
        cell={cell}
        columnIndex={props.columnIndex}
        width={props.width}
        rowHeight={props.rowHeight}
        isSelected={props.isSelected}
        isSearchMatch={props.isSearchMatch}
        isActiveSearchMatch={props.isActiveSearchMatch}
        readOnly={props.readOnly}
        pinned={props.pinned}
        pinnedOffset={props.pinnedOffset}
        grow={props.grow}
        showStartBorder={props.showStartBorder}
        showEndBorder={props.showEndBorder}
      />
    );
  }

  if (hasCustomCell) {
    return (
      <DataGridCell key={rowId} {...props}>
        <DataGridCustomCellContent cell={cell} />
      </DataGridCell>
    );
  }

  const variant = cell.column.columnDef.meta?.variant ?? "text";

  let Comp: React.ComponentType<DataGridCellProps<TData>>;

  switch (variant) {
    case "short-text":
      Comp = ShortTextCell;
      break;
    case "long-text":
      Comp = LongTextCell;
      break;
    case "number":
      Comp = NumberCell;
      break;
    case "url":
      Comp = UrlCell;
      break;
    case "checkbox":
      Comp = CheckboxCell;
      break;
    case "select":
      Comp = SelectCell;
      break;
    case "multi-select":
      Comp = MultiSelectCell;
      break;
    case "date":
      Comp = DateCell;
      break;
    case "file":
      Comp = FileCell;
      break;

    default:
      Comp = ShortTextCell;
      break;
  }

  return <Comp key={rowId} {...props} />;
}

interface DataGridWrittenCellProps<
  TData extends RowData,
> extends DataGridCellProps<TData> {
  writeCell: (element: HTMLElement, value: unknown) => void;
}

function DataGridWrittenCell<TData extends RowData>({
  writeCell,
  ...props
}: DataGridWrittenCellProps<TData>) {
  const { table } = props.cell;
  const rowId = props.cell.row.id;
  const columnId = props.cell.column.id;
  const ref = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const write = () => {
      const row = table.getRowModel().rowsById[rowId];
      writeCell(element, row?.getValue(columnId));
    };
    write();
    return table.subscribeCell(rowId, columnId, write);
  }, [table, rowId, columnId, writeCell]);

  return <DataGridCell {...props} ref={ref} />;
}

interface DataGridCustomCellContentProps<TData extends RowData> {
  cell: Cell<DataGridFeatures, TData>;
}

const DataGridCustomCellContent = React.memo(
  DataGridCustomCellContentImpl,
) as typeof DataGridCustomCellContentImpl;

function DataGridCustomCellContentImpl<TData extends RowData>({
  cell: cellProp,
}: DataGridCustomCellContentProps<TData>) {
  "use no memo";
  const cell = useUpdatedCell(cellProp);

  return flexRender(cell.column.columnDef.cell, cell.getContext());
}

// Custom renderers read the stable `cell` through methods the compiler can't
// track, so this re-renders them on each live update instead
function useUpdatedCell<TData extends RowData>(
  cell: Cell<DataGridFeatures, TData>,
) {
  "use no memo";
  const { table } = cell;
  const rowId = cell.row.id;
  const columnId = cell.column.id;
  const [updateCount, onCellUpdate] = React.useReducer(
    (count: number) => count + 1,
    0,
  );

  React.useEffect(
    () => table.subscribeCell(rowId, columnId, onCellUpdate),
    [table, rowId, columnId],
  );

  if (updateCount === 0) return cell;

  return (
    table.getRowModel().rowsById[rowId]?.getAllCellsByColumnId()[columnId] ??
    cell
  );
}
