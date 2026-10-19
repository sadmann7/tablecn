"use client";

import type { RowData } from "@tanstack/react-table";

import * as React from "react";

import type { DataGridCellProps } from "@/lib/data-grid-types";

import { getHasCustomCell } from "@/lib/data-grid-utils";
import {
  CheckboxCell,
  CustomCell,
  DateCell,
  FileCell,
  LongTextCell,
  MultiSelectCell,
  NumberCell,
  SelectCell,
  ShortTextCell,
  UrlCell,
} from "@/registry/bases/base/components/data-grid/data-grid-cell-variants";

export const DataGridCell = React.memo(DataGridCellImpl, (prev, next) => {
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
  if (prev.cell.row.id !== next.cell.row.id) return false;
  if (prev.cell.column.id !== next.cell.column.id) return false;
  if (prev.cell.column.columnDef.cell !== next.cell.column.columnDef.cell) {
    return false;
  }
  if (getHasCustomCell(next.cell.column)) {
    return prev.cell.row.original === next.cell.row.original;
  }
  return prev.cell.getValue() === next.cell.getValue();
}) as typeof DataGridCellImpl;

function DataGridCellImpl<TData extends RowData>(
  props: DataGridCellProps<TData>,
) {
  if (getHasCustomCell(props.cell.column)) return <CustomCell {...props} />;

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
