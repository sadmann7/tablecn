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
  getResultCountText,
  getSkeletonRowCount,
  getStatusErrorMessage,
  getVisibleSelectedRows,
  stringifyFilterValue,
} from "@/lib/data-table-utils";
import { DataTablePagination } from "@/registry/bases/aria/components/data-table/data-table-pagination";
import { Button } from "@/registry/bases/aria/ui/button";
import { useDirection } from "@/registry/bases/aria/ui/direction";
import { Skeleton } from "@/registry/bases/aria/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/registry/bases/aria/ui/table";
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
            loadMore ? getLoadMoreRowCount(table, loadMore, 1) : undefined
          }
        >
          <DataTableHeader table={table} stickyHeader={stickyHeader} />
          <DataTableBody table={table} />
        </DataTableLayout>
      </div>
      <DataTableResultCount table={table} />
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
  "aria-busy": ariaBusy,
  "aria-rowcount": ariaRowCount,
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
              render={(tableProps) => (
                <table
                  {...(tableProps as React.ComponentProps<"table">)}
                  aria-busy={ariaBusy}
                  aria-rowcount={ariaRowCount}
                />
              )}
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
              escapeKeyBehavior="none"
              onSelectionChange={(selection) => {
                if (selection === "all") {
                  table.toggleAllPageRowsSelected(true);
                  return;
                }

                const selectedIds = new Set([...selection].map(String));
                // Toggles only the changed rows so TanStack's row selection options apply.
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
  stickyHeader: boolean;
}

function DataTableHeader<TData extends RowData>({
  table,
  stickyHeader,
}: DataTableHeaderProps<TData>) {
  return (
    <table.Subscribe selector={selectHeaderState}>
      {() => {
        // Rows render leaf cells only, so render only the bottom (leaf) header row.
        const headerGroups = table.getHeaderGroups();
        const headers = headerGroups[headerGroups.length - 1]?.headers ?? [];
        // The first data column names the row, display columns like select do not.
        const rowHeaderId = (
          headers.find((header) => header.column.accessorFn) ?? headers[0]
        )?.id;

        return (
          <TableHeader
            className={cn(
              "group/row transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50",
              stickyHeader &&
                "sticky top-0 z-30 bg-background hover:bg-[color-mix(in_srgb,var(--muted)_50%,var(--background))] has-aria-expanded:bg-[color-mix(in_srgb,var(--muted)_50%,var(--background))] [&_th]:shadow-[inset_0_-1px_0_var(--border)] [&_tr]:border-b-0",
            )}
          >
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
          // React Aria's Column drops aria-sort unless it owns sorting; it renders a th when not virtualized.
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
  const status = table.options.status ?? "idle";
  const rows = table.getRowModel().rows;

  if (status === "loading") return <DataTableSkeletonBody table={table} />;

  const loadMore = table.options.loadMore;
  if (loadMore && status !== "error" && rows.length > 0) {
    return (
      <DataTableCursorBody table={table} rows={rows} loadMore={loadMore} />
    );
  }

  return (
    <TableBody
      data-status={status === "refreshing" ? status : undefined}
      className="transition-colors data-[status=refreshing]:**:text-muted-foreground"
      renderEmptyState={() =>
        status === "error" ? (
          <div className="flex flex-col items-center justify-center gap-2 whitespace-normal">
            <span role="alert">
              {getStatusErrorMessage(table.options.error) ??
                "Failed to load results."}
            </span>
            {table.options.onRetry ? (
              <Button
                variant="outline"
                size="sm"
                onPress={table.options.onRetry}
              >
                Retry
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 whitespace-normal">
            <span>No results.</span>
            <table.Subscribe selector={selectIsFiltered}>
              {(isFiltered) =>
                isFiltered ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => {
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
          </div>
        )
      }
    >
      {status === "error"
        ? null
        : rows.map((row) => <DataTableRow key={row.id} row={row} />)}
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
          rowIndex={index + 2}
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
    <TableRow
      id="data-table-load-more"
      textValue="Load more"
      isDisabled
      data-slot="data-table-load-more"
      className="hover:bg-transparent"
    >
      <TableCell
        colSpan={table.getVisibleLeafColumns().length || 1}
        className="h-14 text-center"
      >
        <div
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 whitespace-normal"
          onFocus={stopPropagation}
          onKeyDown={stopPropagation}
          onKeyUp={stopPropagation}
          onPointerDown={stopPropagation}
          onPointerUp={stopPropagation}
          onMouseDown={stopPropagation}
          onClick={stopPropagation}
        >
          {loadMore.status === "error" ? (
            <span role="alert">
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
            onPress={onLoadMore}
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
            <TableRow
              key={index}
              id={`skeleton-${index}`}
              textValue="Loading"
              isDisabled
              className="hover:bg-transparent"
            >
              {table.getVisibleLeafColumns().map((column) => {
                const pinned = column.getIsPinned();
                return (
                  <TableCell
                    key={column.id}
                    className={getCellClassName(pinned)}
                    style={getColumnPinningStyle(column, pinned)}
                  >
                    <Skeleton className="h-6 w-full" />
                    <span className="sr-only">Loading</span>
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

interface DataTableResultCountProps<TData extends RowData> {
  table: ReactTable<DataTableFeatures, TData, unknown>;
}

function DataTableResultCount<TData extends RowData>({
  table,
}: DataTableResultCountProps<TData>) {
  return (
    <table.Subscribe selector={() => getResultCountText(table)}>
      {(resultCountText) => (
        <div role="status" className="sr-only">
          {resultCountText}
        </div>
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
  const [element, setElement] = React.useState<HTMLTableRowElement | null>(
    null,
  );

  React.useEffect(() => {
    if (!isFocusTarget || !element) return;
    const active = document.activeElement;
    if (active !== document.body && !element.parentElement?.contains(active)) {
      return;
    }
    element.focus();
  }, [isFocusTarget, element]);

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
          className={cn(
            "group/row",
            rowIndex !== undefined &&
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
          )}
          render={(rowProps) => {
            const props = rowProps as React.ComponentProps<"tr">;
            return (
              <tr
                {...props}
                ref={mergeRefs(props.ref, setElement)}
                aria-rowindex={rowIndex ?? props["aria-rowindex"]}
              />
            );
          }}
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

function mergeRefs<TElement>(
  ...refs: (React.Ref<TElement> | undefined)[]
): React.RefCallback<TElement> {
  return (node) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    }
  };
}

function stopPropagation(event: React.SyntheticEvent) {
  event.stopPropagation();
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

// React Aria's row typeahead needs text, and cells render through FlexRender.
function getRowTextValue<TData extends RowData>(
  row: Row<DataTableFeatures, TData>,
) {
  const cells = row.getVisibleCells();
  // Same cell the header marks as row header.
  const rowHeaderCell =
    cells.find((cell) => cell.column.accessorFn) ?? cells[0];
  return stringifyFilterValue(rowHeaderCell?.getValue());
}
