import { DndContext, type Modifier } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  flexRender,
  Row,
  type Table as TanstackTable,
} from "@tanstack/react-table";
import type * as React from "react";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDataTableRowDnd } from "@/hooks/use-data-table-row-dnd";
import { getColumnPinningStyle } from "@/lib/data-table";
import { cn } from "@/lib/utils";
import { SortableRow } from "./data-table-sortable-row";

interface DataTableProps<TData> extends React.ComponentProps<"div"> {
  table: TanstackTable<TData>;
  actionBar?: React.ReactNode;
  enableRowDragAndDrop?: boolean;
  onRowReorder?: (orderedRowIds: string[]) => void;
  dragModifiers?: Modifier[];
}

export function DataTable<TData>({
  table,
  actionBar,
  children,
  className,
  enableRowDragAndDrop = false,
  onRowReorder,
  dragModifiers,
  ...props
}: DataTableProps<TData>) {
  const rows = table.getRowModel().rows;

  const dnd = useDataTableRowDnd({
    rows,
    enabled: enableRowDragAndDrop,
    onRowReorder,
    modifiers: dragModifiers,
  });

  const tableMarkup = (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                colSpan={header.colSpan}
                style={{ ...getColumnPinningStyle({ column: header.column }) }}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {rows?.length ? (
          rows.map((row) =>
            dnd.active ? (
              <SortableRow key={row.id} row={row} />
            ) : (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    style={{
                      ...getColumnPinningStyle({ column: cell.column }),
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ),
          )
        ) : (
          <TableRow>
            <TableCell
              colSpan={table.getAllColumns().length}
              className="h-24 text-center"
            >
              No results.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div
      className={cn("flex w-full flex-col gap-2.5 overflow-auto", className)}
      {...props}
    >
      {children}
      <div className="overflow-hidden rounded-md border">
        {dnd.active ? (
          <DndContext
            sensors={dnd.sensors}
            collisionDetection={dnd.collisionDetection}
            modifiers={dnd.modifiers}
            onDragEnd={dnd.handleDragEnd}
          >
            <SortableContext
              items={dnd.rowIds}
              strategy={verticalListSortingStrategy}
            >
              {tableMarkup}
            </SortableContext>
          </DndContext>
        ) : (
          tableMarkup
        )}
      </div>
      <div className="flex flex-col gap-2.5">
        <DataTablePagination table={table} />
        {actionBar &&
          table.getFilteredSelectedRowModel().rows.length > 0 &&
          actionBar}
      </div>
    </div>
  );
}
