"use client";

import {
  type Cell,
  type ColumnPinningPosition,
  FlexRender,
  type Header,
  type ReactTable,
  type Row,
  type RowData,
  Subscribe,
  type TableState,
} from "@tanstack/react-table";
import { cn } from "cn";
import * as React from "react";

import type { DataTableFeatures } from "@/lib/data-table-features";

import {
  getAriaSort,
  getColumnPinningStyle,
  getColumnSizingStyle,
  getVisibleSelectedRows,
  stringifyFilterValue,
} from "@/lib/data-table-utils";
import { DataTablePagination } from "@/registry/bases/aria/components/data-table/data-table-pagination";
import { useDirection } from "@/registry/bases/aria/ui/direction";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/registry/bases/aria/ui/table";

interface DataTableProps<
  TData extends RowData,
> extends React.ComponentProps<"div"> {
  table: ReactTable<DataTableFeatures, TData, unknown>;
  actionBar?: React.ReactNode;
}

export function DataTable<TData extends RowData>({
  table,
  actionBar,
  children,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: DataTableProps<TData>) {
  const dir = useDirection();

  return (
    <div
      data-slot="data-table"
      dir={dir}
      className={cn("flex w-full flex-col gap-2.5 overflow-auto", className)}
      {...props}
    >
      {children}
      <div className="isolate overflow-hidden rounded-md border">
        <DataTableLayout
          table={table}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
        >
          <DataTableHeader table={table} />
          <DataTableBody table={table} />
        </DataTableLayout>
      </div>
      <div className="flex flex-col gap-2.5">
        <DataTablePagination table={table} />
        {actionBar ? (
          <DataTableActionBar table={table} actionBar={actionBar} />
        ) : null}
      </div>
    </div>
  );
}

interface DataTableLayoutProps<TData extends RowData> extends Pick<
  React.ComponentProps<"table">,
  "aria-label" | "aria-labelledby"
> {
  table: ReactTable<DataTableFeatures, TData, unknown>;
  children: React.ReactNode;
}

function DataTableLayout<TData extends RowData>({
  table,
  children,
  ...props
}: DataTableLayoutProps<TData>) {
  return (
    <table.Subscribe selector={selectLayoutState}>
      {() => (
        <Subscribe source={table.atoms.rowSelection}>
          {() => (
            <Table
              className="table-fixed"
              style={getColumnSizingStyle(table)}
              {...props}
              // Rows select on press only when the table offers selection through its select column
              selectionMode={
                "select" in table.getAllLeafColumnsById() ? "multiple" : "none"
              }
              selectedKeys={table
                .getRowModel()
                .rows.filter((row) => row.getIsSelected())
                .map((row) => row.id)}
              disabledKeys={table
                .getRowModel()
                .rows.filter((row) => !row.getCanSelect())
                .map((row) => row.id)}
              disabledBehavior="selection"
              // Escape closes popovers and menus; it should not also wipe the row selection
              escapeKeyBehavior="none"
              onSelectionChange={(selection) => {
                if (selection === "all") {
                  table.toggleAllPageRowsSelected(true);
                  return;
                }

                const selectedIds = new Set([...selection].map(String));
                // Toggles only the changed rows so TanStack's row selection options apply
                const changedRows = table
                  .getRowModel()
                  .rows.filter(
                    (row) => selectedIds.has(row.id) !== row.getIsSelected(),
                  );
                for (const row of changedRows) {
                  row.toggleSelected(selectedIds.has(row.id));
                }
              }}
            >
              {children}
            </Table>
          )}
        </Subscribe>
      )}
    </table.Subscribe>
  );
}

interface DataTableHeaderProps<TData extends RowData> {
  table: ReactTable<DataTableFeatures, TData, unknown>;
}

function DataTableHeader<TData extends RowData>({
  table,
}: DataTableHeaderProps<TData>) {
  return (
    <table.Subscribe selector={selectHeaderState}>
      {() => {
        // Rows render leaf cells only, so render only the bottom (leaf) header row
        const headerGroups = table.getHeaderGroups();
        const headers = headerGroups[headerGroups.length - 1]?.headers ?? [];
        // The first data column names the row, display columns like select do not
        const rowHeaderId = (
          headers.find((header) => header.column.accessorFn) ?? headers[0]
        )?.id;

        return (
          <TableHeader className="group/row transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50">
            {headers.map((header) => (
              <DataTableHeadCell
                key={header.id}
                header={header}
                pinned={header.column.getIsPinned()}
                isRowHeader={header.id === rowHeaderId}
              />
            ))}
          </TableHeader>
        );
      }}
    </table.Subscribe>
  );
}

interface DataTableHeadCellProps<TData extends RowData> {
  header: Header<DataTableFeatures, TData>;
  pinned: ColumnPinningPosition;
  isRowHeader: boolean;
}

function DataTableHeadCell<TData extends RowData>({
  header,
  pinned,
  isRowHeader,
}: DataTableHeadCellProps<TData>) {
  return (
    <Subscribe
      source={header.column.table.atoms.sorting}
      selector={(sorting) => getAriaSort(sorting, header.column.id)}
    >
      {(ariaSort) => (
        <TableHead
          id={header.id}
          isRowHeader={isRowHeader}
          className={getCellClassName(pinned)}
          style={getColumnPinningStyle(header.column, pinned)}
          // React Aria's Column drops aria-sort unless it owns sorting; it renders a th when not virtualized
          render={(props) => (
            <th
              {...(props as React.ComponentProps<"th">)}
              aria-sort={ariaSort}
            />
          )}
        >
          {header.isPlaceholder ? null : <FlexRender header={header} />}
        </TableHead>
      )}
    </Subscribe>
  );
}

function getCellClassName(pinned: ColumnPinningPosition) {
  return pinned
    ? "overflow-hidden bg-background transition-colors group-hover/row:bg-[color-mix(in_srgb,var(--muted)_50%,var(--background))] group-has-aria-expanded/row:bg-[color-mix(in_srgb,var(--muted)_50%,var(--background))] group-data-selected/row:bg-muted"
    : "overflow-hidden";
}

interface DataTableBodyProps<TData extends RowData> {
  table: ReactTable<DataTableFeatures, TData, unknown>;
}

function DataTableBody<TData extends RowData>({
  table,
}: DataTableBodyProps<TData>) {
  const rows = table.getRowModel().rows;

  return (
    <TableBody renderEmptyState={() => "No results."}>
      {rows.map((row) => (
        <DataTableRow key={row.id} row={row} />
      ))}
    </TableBody>
  );
}

interface DataTableActionBarProps<TData extends RowData> {
  table: ReactTable<DataTableFeatures, TData, unknown>;
  actionBar: React.ReactNode;
}

function DataTableActionBar<TData extends RowData>({
  table,
  actionBar,
}: DataTableActionBarProps<TData>) {
  return (
    <table.Subscribe selector={() => getVisibleSelectedRows(table).length > 0}>
      {(hasVisibleSelectedRows) => (hasVisibleSelectedRows ? actionBar : null)}
    </table.Subscribe>
  );
}

interface DataTableRowProps<TData extends RowData> {
  row: Row<DataTableFeatures, TData>;
}

const DataTableRow = React.memo(DataTableRowImpl) as typeof DataTableRowImpl;

function DataTableRowImpl<TData extends RowData>({
  row,
}: DataTableRowProps<TData>) {
  return (
    <Subscribe
      source={row.table.store}
      selector={(state) => ({
        columnOrder: state.columnOrder,
        columnPinning: state.columnPinning,
        columnVisibility: state.columnVisibility,
      })}
    >
      {() => (
        <TableRow
          id={row.id}
          textValue={getRowTextValue(row)}
          className="group/row"
        >
          {row.getVisibleCells().map((cell) => (
            <DataTableCell
              key={cell.id}
              cell={cell}
              pinned={cell.column.getIsPinned()}
            />
          ))}
        </TableRow>
      )}
    </Subscribe>
  );
}

interface DataTableCellProps<TData extends RowData> {
  cell: Cell<DataTableFeatures, TData>;
  pinned: ColumnPinningPosition;
}

const DataTableCell = React.memo(DataTableCellImpl) as typeof DataTableCellImpl;

function DataTableCellImpl<TData extends RowData>({
  cell,
  pinned,
}: DataTableCellProps<TData>) {
  return (
    <TableCell
      className={getCellClassName(pinned)}
      style={getColumnPinningStyle(cell.column, pinned)}
    >
      <FlexRender cell={cell} />
    </TableCell>
  );
}

function selectLayoutState(state: TableState<DataTableFeatures>) {
  return {
    columnOrder: state.columnOrder,
    columnPinning: state.columnPinning,
    columnSizing: state.columnSizing,
    columnVisibility: state.columnVisibility,
  };
}

function selectHeaderState(state: TableState<DataTableFeatures>) {
  return {
    columnOrder: state.columnOrder,
    columnPinning: state.columnPinning,
    columnVisibility: state.columnVisibility,
  };
}

// React Aria's row typeahead needs text, and cells render through FlexRender
function getRowTextValue<TData extends RowData>(
  row: Row<DataTableFeatures, TData>,
) {
  const cells = row.getVisibleCells();
  // Same cell the header marks as row header
  const rowHeaderCell =
    cells.find((cell) => cell.column.accessorFn) ?? cells[0];
  return stringifyFilterValue(rowHeaderCell?.getValue());
}
