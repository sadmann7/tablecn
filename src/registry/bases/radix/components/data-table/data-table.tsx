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
import type { DataLoadMore } from "@/lib/data-table-types";

import {
  getAriaSort,
  getColumnPinningStyle,
  getColumnSizingStyle,
  getLoadMoreRowCount,
  getSkeletonRowCount,
  getStatusErrorMessage,
  getVisibleSelectedRows,
} from "@/lib/data-table-utils";
import { DataTablePagination } from "@/registry/bases/radix/components/data-table/data-table-pagination";
import { Button } from "@/registry/bases/radix/ui/button";
import { useDirection } from "@/registry/bases/radix/ui/direction";
import { Skeleton } from "@/registry/bases/radix/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/registry/bases/radix/ui/table";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

interface DataTableProps<
  TData extends RowData,
> extends React.ComponentProps<"div"> {
  table: ReactTable<DataTableFeatures, TData, unknown>;
  actionBar?: React.ReactNode;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  stickyHeader?: boolean;
}

export function DataTable<TData extends RowData>({
  table,
  actionBar,
  onEscapeKeyDown,
  stickyHeader = false,
  children,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: DataTableProps<TData>) {
  const dir = useDirection();
  const status = table.options.status ?? "idle";
  const loadMore = table.options.loadMore;
  const headerRowCount = table.getHeaderGroups().length;

  function onTableKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const nativeEvent = event.nativeEvent;
    if (event.key !== "Escape" || nativeEvent.defaultPrevented) return;
    if (
      !(event.target instanceof Node) ||
      !event.currentTarget.contains(event.target)
    ) {
      return;
    }

    const selectedRowIds = getVisibleSelectedRows(table).map((row) => row.id);
    if (selectedRowIds.length === 0) return;

    onEscapeKeyDown?.(nativeEvent);
    if (nativeEvent.defaultPrevented) return;

    event.preventDefault();
    table.setRowSelection((prev) => {
      const next = { ...prev };
      for (const rowId of selectedRowIds) delete next[rowId];
      return next;
    });
  }

  return (
    <div
      data-slot="data-table"
      dir={dir}
      className={cn("flex w-full flex-col gap-2.5 overflow-auto", className)}
      {...props}
    >
      {children}
      <div
        className={cn(
          "relative isolate rounded-md border",
          stickyHeader
            ? "min-h-0 scroll-pt-10 overflow-auto [&:has(thead>tr:nth-child(2))]:scroll-pt-20 [&:has(thead>tr:nth-child(3))]:scroll-pt-30 [&>[data-slot=table-container]]:overflow-visible"
            : "overflow-hidden",
        )}
        onKeyDown={onTableKeyDown}
      >
        {status === "refreshing" ? <DataTableProgress /> : null}
        <DataTableLayout
          table={table}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-busy={
            status === "loading" || status === "refreshing" || undefined
          }
          aria-rowcount={
            loadMore
              ? getLoadMoreRowCount(table, loadMore, headerRowCount)
              : undefined
          }
        >
          <DataTableHeader
            table={table}
            stickyHeader={stickyHeader}
            hasRowIndex={loadMore !== undefined}
          />
          <DataTableBody table={table} />
        </DataTableLayout>
      </div>
      <div className="flex flex-col gap-2.5">
        {loadMore ? null : <DataTablePagination table={table} />}
        {actionBar ? (
          <DataTableActionBar table={table} actionBar={actionBar} />
        ) : null}
      </div>
    </div>
  );
}

interface DataTableLayoutProps<TData extends RowData> extends Pick<
  React.ComponentProps<"table">,
  "aria-label" | "aria-labelledby" | "aria-busy" | "aria-rowcount"
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
        <Table
          className="table-fixed"
          style={getColumnSizingStyle(table)}
          {...props}
        >
          {children}
        </Table>
      )}
    </table.Subscribe>
  );
}

interface DataTableHeaderProps<TData extends RowData> {
  table: ReactTable<DataTableFeatures, TData, unknown>;
  stickyHeader: boolean;
  hasRowIndex: boolean;
}

function DataTableHeader<TData extends RowData>({
  table,
  stickyHeader,
  hasRowIndex,
}: DataTableHeaderProps<TData>) {
  return (
    <table.Subscribe selector={selectHeaderState}>
      {() => (
        <TableHeader
          className={cn(
            stickyHeader &&
              "sticky top-0 z-30 bg-background [&_th]:shadow-[inset_0_-1px_0_var(--border)] [&_tr]:border-b-0",
          )}
        >
          {table.getHeaderGroups().map((headerGroup, index) => (
            <TableRow
              key={headerGroup.id}
              aria-rowindex={hasRowIndex ? index + 1 : undefined}
              className="group/row"
            >
              {headerGroup.headers.map((header) => (
                <DataTableHeadCell
                  key={header.id}
                  header={header}
                  pinned={header.column.getIsPinned()}
                />
              ))}
            </TableRow>
          ))}
        </TableHeader>
      )}
    </table.Subscribe>
  );
}

interface DataTableHeadCellProps<TData extends RowData> {
  header: Header<DataTableFeatures, TData>;
  pinned: ColumnPinningPosition;
}

function DataTableHeadCell<TData extends RowData>({
  header,
  pinned,
}: DataTableHeadCellProps<TData>) {
  return (
    <Subscribe
      source={header.column.table.atoms.sorting}
      selector={(sorting) => getAriaSort(sorting, header.column.id)}
    >
      {(ariaSort) => (
        <TableHead
          aria-sort={ariaSort}
          colSpan={header.colSpan}
          className={getCellClassName(pinned)}
          style={getColumnPinningStyle(header.column, pinned)}
        >
          {header.isPlaceholder ? null : <FlexRender header={header} />}
        </TableHead>
      )}
    </Subscribe>
  );
}

function getCellClassName(pinned: ColumnPinningPosition) {
  return pinned
    ? "overflow-hidden bg-background transition-colors group-hover/row:bg-[color-mix(in_srgb,var(--muted)_50%,var(--background))] group-has-aria-expanded/row:bg-[color-mix(in_srgb,var(--muted)_50%,var(--background))] group-data-[state=selected]/row:bg-muted"
    : "overflow-hidden";
}

interface DataTableBodyProps<TData extends RowData> {
  table: ReactTable<DataTableFeatures, TData, unknown>;
}

function DataTableBody<TData extends RowData>({
  table,
}: DataTableBodyProps<TData>) {
  const status = table.options.status ?? "idle";
  const rows = table.getRowModel().rows;

  if (status === "loading") return <DataTableSkeletonBody table={table} />;

  if (status === "error") {
    return (
      <DataTableMessageBody table={table}>
        <span>
          {getStatusErrorMessage(table.options.error) ??
            "Failed to load results."}
        </span>
        {table.options.onRetry ? (
          <Button variant="outline" size="sm" onClick={table.options.onRetry}>
            Retry
          </Button>
        ) : null}
      </DataTableMessageBody>
    );
  }

  if (!rows.length) {
    return (
      <DataTableMessageBody table={table}>
        <span>No results.</span>
        <table.Subscribe selector={selectIsFiltered}>
          {(isFiltered) =>
            isFiltered ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  table.resetColumnFilters(true);
                  table.resetJoinOperator();
                  table.resetGlobalFilter(true);
                }}
              >
                Clear filters
              </Button>
            ) : null
          }
        </table.Subscribe>
      </DataTableMessageBody>
    );
  }

  const loadMore = table.options.loadMore;
  if (loadMore) {
    return (
      <DataTableCursorBody table={table} rows={rows} loadMore={loadMore} />
    );
  }

  return (
    <TableBody
      data-status={status === "refreshing" ? status : undefined}
      className="transition-colors data-[status=refreshing]:**:text-muted-foreground"
    >
      {rows.map((row) => (
        <DataTableRow key={row.id} row={row} />
      ))}
    </TableBody>
  );
}

interface DataTableCursorBodyProps<TData extends RowData> {
  table: ReactTable<DataTableFeatures, TData, unknown>;
  rows: Row<DataTableFeatures, TData>[];
  loadMore: DataLoadMore;
}

interface PendingFocus {
  index: number;
  firstRowId: string | undefined;
}

function DataTableCursorBody<TData extends RowData>({
  table,
  rows,
  loadMore,
}: DataTableCursorBodyProps<TData>) {
  const status = table.options.status ?? "idle";
  const headerRowCount = table.getHeaderGroups().length;
  const [pendingFocus, setPendingFocus] = React.useState<PendingFocus | null>(
    null,
  );
  const focusRowId =
    pendingFocus &&
    rows[0]?.id === pendingFocus.firstRowId &&
    rows.length > pendingFocus.index
      ? rows[pendingFocus.index]?.id
      : undefined;

  function onLoadMore() {
    if (loadMore.status === "loading") return;
    setPendingFocus({ index: rows.length, firstRowId: rows[0]?.id });
    loadMore.onLoadMore();
  }

  return (
    <TableBody
      data-status={status === "refreshing" ? status : undefined}
      className="transition-colors data-[status=refreshing]:**:text-muted-foreground"
    >
      {rows.map((row, index) => (
        <DataTableRow
          key={row.id}
          row={row}
          rowIndex={headerRowCount + index + 1}
          isFocusTarget={row.id === focusRowId}
        />
      ))}
      {loadMore.hasMore ? (
        <DataTableLoadMoreRow
          table={table}
          loadMore={loadMore}
          loadedCount={rows.length}
          onLoadMore={onLoadMore}
        />
      ) : null}
    </TableBody>
  );
}

interface DataTableLoadMoreRowProps<TData extends RowData> {
  table: ReactTable<DataTableFeatures, TData, unknown>;
  loadMore: DataLoadMore;
  loadedCount: number;
  onLoadMore: () => void;
}

function DataTableLoadMoreRow<TData extends RowData>({
  table,
  loadMore,
  loadedCount,
  onLoadMore,
}: DataTableLoadMoreRowProps<TData>) {
  const rowCount = table.options.rowCount;
  const isLoading = loadMore.status === "loading";

  return (
    <Subscribe source={table.atoms.columnVisibility}>
      {() => (
        <TableRow
          data-slot="data-table-load-more"
          className="hover:bg-transparent"
        >
          <TableCell
            colSpan={table.getVisibleLeafColumns().length || 1}
            className="h-14 text-center"
          >
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 whitespace-normal">
              {loadMore.status === "error" ? (
                <span>
                  {getStatusErrorMessage(loadMore.error) ??
                    "Failed to load more rows."}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {rowCount === undefined
                    ? `${loadedCount.toLocaleString()} loaded`
                    : `${loadedCount.toLocaleString()} of ${rowCount.toLocaleString()}`}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                aria-disabled={isLoading || undefined}
                className="aria-disabled:cursor-progress"
                onClick={onLoadMore}
              >
                {isLoading ? (
                  <IconPlaceholder
                    lucide="Loader2Icon"
                    tabler="IconLoader"
                    hugeicons="Loading03Icon"
                    phosphor="SpinnerIcon"
                    remixicon="RiLoaderLine"
                    className="motion-safe:animate-spin"
                  />
                ) : null}
                {isLoading
                  ? "Loading more..."
                  : loadMore.status === "error"
                    ? "Retry"
                    : "Load more"}
              </Button>
            </div>
          </TableCell>
        </TableRow>
      )}
    </Subscribe>
  );
}

interface DataTableMessageBodyProps<TData extends RowData> {
  table: ReactTable<DataTableFeatures, TData, unknown>;
  children: React.ReactNode;
}

function DataTableMessageBody<TData extends RowData>({
  table,
  children,
}: DataTableMessageBodyProps<TData>) {
  return (
    <Subscribe source={table.atoms.columnVisibility}>
      {() => (
        <TableBody>
          <TableRow>
            <TableCell
              colSpan={table.getVisibleLeafColumns().length || 1}
              className="h-24 text-center"
            >
              <div className="flex flex-col items-center justify-center gap-2 whitespace-normal">
                {children}
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      )}
    </Subscribe>
  );
}

function DataTableSkeletonBody<TData extends RowData>({
  table,
}: DataTableBodyProps<TData>) {
  return (
    <table.Subscribe selector={selectSkeletonState}>
      {({ pageSize }) => (
        <TableBody>
          {Array.from({ length: getSkeletonRowCount(pageSize) }, (_, index) => (
            <TableRow key={index} className="hover:bg-transparent">
              {table.getVisibleLeafColumns().map((column) => {
                const pinned = column.getIsPinned();
                return (
                  <TableCell
                    key={column.id}
                    className={getCellClassName(pinned)}
                    style={getColumnPinningStyle(column, pinned)}
                  >
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      )}
    </table.Subscribe>
  );
}

function DataTableProgress() {
  return (
    <div
      aria-hidden="true"
      data-slot="data-table-progress"
      className="pointer-events-none sticky top-0 z-40 h-0"
    >
      <div className="relative h-0.5 overflow-hidden bg-primary/20">
        <div className="absolute inset-y-0 -start-1/3 w-1/3 animate-out bg-primary duration-1000 ease-in-out repeat-infinite slide-out-to-end-[400%] motion-reduce:start-0 motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-60" />
      </div>
    </div>
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
  rowIndex?: number;
  isFocusTarget?: boolean;
}

const DataTableRow = React.memo(DataTableRowImpl) as typeof DataTableRowImpl;

function DataTableRowImpl<TData extends RowData>({
  row,
  rowIndex,
  isFocusTarget = false,
}: DataTableRowProps<TData>) {
  const rowRef = React.useRef<HTMLTableRowElement>(null);

  React.useEffect(() => {
    const element = rowRef.current;
    if (!isFocusTarget || !element) return;
    const active = document.activeElement;
    if (active !== document.body && !element.parentElement?.contains(active)) {
      return;
    }
    element.focus();
  }, [isFocusTarget]);

  return (
    <Subscribe
      source={row.table.store}
      selector={(state) => ({
        columnOrder: state.columnOrder,
        columnPinning: state.columnPinning,
        columnVisibility: state.columnVisibility,
        isSelected: state.rowSelection[row.id] === true,
      })}
    >
      {({ isSelected }) => {
        const cells = row.getVisibleCells();
        const rowHeaderId = (
          cells.find((cell) => cell.column.accessorFn) ?? cells[0]
        )?.id;

        return (
          <TableRow
            ref={rowRef}
            data-state={isSelected ? "selected" : undefined}
            aria-rowindex={rowIndex}
            tabIndex={rowIndex === undefined ? undefined : -1}
            className={cn(
              "group/row",
              rowIndex !== undefined &&
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
            )}
          >
            {cells.map((cell) => (
              <DataTableCell
                key={cell.id}
                cell={cell}
                pinned={cell.column.getIsPinned()}
                isRowHeader={cell.id === rowHeaderId}
              />
            ))}
          </TableRow>
        );
      }}
    </Subscribe>
  );
}

interface DataTableCellProps<TData extends RowData> {
  cell: Cell<DataTableFeatures, TData>;
  pinned: ColumnPinningPosition;
  isRowHeader: boolean;
}

const DataTableCell = React.memo(DataTableCellImpl) as typeof DataTableCellImpl;

function DataTableCellImpl<TData extends RowData>({
  cell,
  pinned,
  isRowHeader,
}: DataTableCellProps<TData>) {
  if (isRowHeader) {
    return (
      <th
        data-slot="table-cell"
        scope="row"
        className={cn(
          "p-2 text-start align-middle font-normal whitespace-nowrap [&:has([role=checkbox])]:pe-0",
          getCellClassName(pinned),
        )}
        style={getColumnPinningStyle(cell.column, pinned)}
      >
        <FlexRender cell={cell} />
      </th>
    );
  }

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

function selectIsFiltered(state: TableState<DataTableFeatures>) {
  return state.columnFilters.length > 0 || Boolean(state.globalFilter);
}

function selectSkeletonState(state: TableState<DataTableFeatures>) {
  return {
    pageSize: state.pagination.pageSize,
    columnOrder: state.columnOrder,
    columnPinning: state.columnPinning,
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
