"use client";

import { flexRender, type Row } from "@tanstack/react-table";
import type { Virtualizer } from "@tanstack/react-virtual";
import * as React from "react";

interface DataGridRowProps<TData> {
  row: Row<TData>;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  virtualRowIndex: number;
  rowMapRef: React.RefObject<Map<number, HTMLDivElement>>;
}

function DataGridRowImpl<TData>({
  row,
  virtualRowIndex,
  rowVirtualizer,
  rowMapRef,
}: DataGridRowProps<TData>) {
  return (
    <div
      data-index={virtualRowIndex}
      ref={(node) => {
        if (node && typeof virtualRowIndex !== "undefined") {
          rowVirtualizer.measureElement(node);
          rowMapRef.current.set(virtualRowIndex, node);
        }
      }}
      key={row.id}
      role="row"
      aria-rowindex={virtualRowIndex + 2}
      data-slot="row"
      tabIndex={-1}
      className="absolute flex w-full border-b"
    >
      {row.getVisibleCells().map((cell, colIndex) => (
        <div
          key={cell.id}
          role="gridcell"
          aria-colindex={colIndex + 1}
          data-slot="cell"
          tabIndex={-1}
          className="flex h-9 grow items-center border-r"
          style={{
            width: cell.column.getSize(),
            minWidth: cell.column.getSize(),
          }}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </div>
      ))}
    </div>
  );
}

export const DataGridRow = React.memo(
  DataGridRowImpl,
  (_prev, next) => next.rowVirtualizer.isScrolling,
) as typeof DataGridRowImpl;
