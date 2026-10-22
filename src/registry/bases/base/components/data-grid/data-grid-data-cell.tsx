"use client";

import { type Cell, flexRender, type RowData } from "@tanstack/react-table";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type { DataGridCellProps } from "@/lib/data-grid-types";

import { getHasCustomCell } from "@/lib/data-grid-utils";
import { DataGridCell } from "@/registry/bases/base/components/data-grid/data-grid-cell";
import { DataGridCellPreview } from "@/registry/bases/base/components/data-grid/data-grid-cell-preview";
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
} from "@/registry/bases/base/components/data-grid/data-grid-cell-variants";

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
    if (getHasCustomCell(next.cell.column)) {
      return prev.cell.row.original === next.cell.row.original;
    }
    return prev.cell.getValue() === next.cell.getValue();
  },
) as typeof DataGridDataCellImpl;

function DataGridDataCellImpl<TData extends RowData>({
  isScrolling,
  cell: propsCell,
  ...rest
}: DataGridDataCellProps<TData>) {
  // Custom cells update their content alone, so only variants rerender here
  const hasCustomCell = getHasCustomCell(propsCell.column);
  const cell = useUpdatedCell(propsCell, !hasCustomCell);
  const props = { ...rest, cell };

  // Cells mounted mid-scroll show a cheap preview until scrolling stops. The row
  // keys cells by cell ID, so a recycled row mounts fresh cells
  const [isPreview, setIsPreview] = React.useState(isScrolling);
  if (isPreview && !isScrolling) setIsPreview(false);

  if (isPreview && !props.isFocused && !props.isEditing && !hasCustomCell) {
    return (
      <DataGridCellPreview
        cell={props.cell}
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
      <DataGridCell {...props}>
        <DataGridCustomCellContent cell={props.cell} />
      </DataGridCell>
    );
  }

  const cellOpts = props.cell.column.columnDef.meta?.cell;
  const variant = cellOpts?.variant ?? "text";

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

  return <Comp {...props} />;
}

// Rerenders when `updateCells` changes the cell, then reads it from the current row
// model, since a memoized row can still hold an older one
function useUpdatedCell<TData extends RowData>(
  cell: Cell<DataGridFeatures, TData>,
  isEnabled = true,
) {
  const { table } = cell;
  const rowId = cell.row.id;
  const columnId = cell.column.id;
  const [updateCount, onCellUpdate] = React.useReducer(
    (count: number) => count + 1,
    0,
  );
  // What the cell last rendered, for the check after subscribing
  const renderedValueRef = React.useRef<unknown>(undefined);
  renderedValueRef.current = cell.getValue();
  React.useEffect(() => {
    if (!isEnabled) return;
    const unsubscribe = table.subscribeCell(rowId, columnId, onCellUpdate);
    // Subscribing can apply values the row waited for while out of view
    const value = table.getRowModel().rowsById[rowId]?.getValue(columnId);
    if (!Object.is(value, renderedValueRef.current)) onCellUpdate();
    return unsubscribe;
  }, [isEnabled, table, rowId, columnId]);

  if (updateCount === 0) return cell;
  return (
    table.getRowModel().rowsById[rowId]?.getAllCellsByColumnId()[columnId] ??
    cell
  );
}

const DataGridCustomCellContent = React.memo(
  DataGridCustomCellContentImpl,
) as typeof DataGridCustomCellContentImpl;

function DataGridCustomCellContentImpl<TData extends RowData>({
  cell: propsCell,
}: {
  cell: Cell<DataGridFeatures, TData>;
}) {
  const cell = useUpdatedCell(propsCell);
  return flexRender(cell.column.columnDef.cell, cell.getContext());
}
