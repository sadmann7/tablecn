import type { Column, Table, TableOptions } from "@tanstack/react-table";
import type { motion } from "motion/react";
import type * as React from "react";
import type { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { EmptyProps } from "@/types";
import type { ExtendedColumnFilter, Option } from "@/types/data-table";

export interface UseDataTableProps<TData>
  extends Required<Pick<TableOptions<TData>, "pageCount">>,
    Pick<
      TableOptions<TData>,
      "data" | "columns" | "getRowId" | "defaultColumn" | "initialState"
    > {
  /**
   * Determines how query updates affect history.
   * `push` creates a new history entry; `replace` (default) updates the current entry.
   * @default "replace"
   */
  history?: "push" | "replace";

  /**
   * Debounce time (ms) for filter updates to enhance performance during rapid input.
   * @default 300
   */
  debounceMs?: number;

  /**
   * Maximum time (ms) to wait between URL query string updates.
   * Helps with browser rate-limiting. Minimum effective value is 50ms.
   * @default 50
   */
  throttleMs?: number;

  /**
   * Clear URL query key-value pair when state is set to default.
   * Keep URL meaning consistent when defaults change.
   * @default false
   */
  clearOnDefault?: boolean;

  /**
   * Enable notion like column filters.
   * Advanced filters and column filters cannot be used at the same time.
   * @default false
   * @type boolean
   */
  enableAdvancedFilter?: boolean;

  /**
   * Whether the page should scroll to the top when the URL changes.
   * @default false
   */
  scroll?: boolean;

  /**
   * Whether to keep query states client-side, avoiding server calls.
   * Setting to `false` triggers a network request with the updated querystring.
   * @default true
   */
  shallow?: boolean;

  /**
   * Observe Server Component loading states for non-shallow updates.
   * Pass `startTransition` from `React.useTransition()`.
   * Sets `shallow` to `false` automatically.
   * So shallow: true` and `startTransition` cannot be used at the same time.
   * @see https://react.dev/reference/react/useTransition
   */
  startTransition?: React.TransitionStartFunction;
}

export interface DataTableProps<TData> extends EmptyProps<"div"> {
  /** The table instance. */
  table: Table<TData>;

  /** The action bar to display above the table. */
  actionBar?: React.ReactNode;
}

export interface DataTableToolbarProps<TData> extends EmptyProps<"div"> {
  /** The table instance. */
  table: Table<TData>;
}

export interface DataTableAdvancedToolbarProps<TData>
  extends EmptyProps<"div"> {
  /** The table instance. */
  table: Table<TData>;
}

export interface DataTableActionBarProps<TData>
  extends EmptyProps<typeof motion.div> {
  /** The table instance. */
  table: Table<TData>;

  /** Whether the action bar is visible. */
  visible?: boolean;

  /**
   * The container to mount the portal into.
   * @default document.body
   */
  container?: Element | DocumentFragment | null;
}

export interface DataTableColumnHeaderProps<TData, TValue>
  extends EmptyProps<typeof DropdownMenuTrigger> {
  /** The column instance. */
  column: Column<TData, TValue>;

  /** The column title. */
  title: string;
}

export interface DataTableDateFilterProps<TData> {
  /** The column instance. */
  column: Column<TData, unknown>;

  /** The title of the date picker. */
  title?: string;

  /** Whether to enable range selection. */
  multiple?: boolean;
}

export interface DataTableFacetedFilterProps<TData, TValue> {
  /** The column instance. */
  column?: Column<TData, TValue>;

  /** The title of the filter. */
  title?: string;

  /** The options of the filter. */
  options: Option[];

  /** Whether to enable multiple selection. */
  multiple?: boolean;
}

export interface DataTableSliderFilterProps<TData> {
  /** The column instance. */
  column: Column<TData, unknown>;

  /** The title of the slider filter. */
  title?: string;
}

export interface DataTableRangeFilterProps<TData> extends EmptyProps<"div"> {
  /** The extended column filter. */
  filter: ExtendedColumnFilter<TData>;

  /** The column instance. */
  column: Column<TData>;

  /** The input id for screen readers. */
  inputId: string;

  /** The function to update the filter. */
  onFilterUpdate: (
    filterId: string,
    updates: Partial<Omit<ExtendedColumnFilter<TData>, "filterId">>,
  ) => void;
}

export interface DataTableFilterListProps<TData> {
  /** The table instance. */
  table: Table<TData>;

  /**
   * Debounce time (ms) for filter updates to enhance performance during rapid input.
   * @default 300
   */
  debounceMs?: number;

  /**
   * Maximum time (ms) to wait between URL query string updates.
   * Helps with browser rate-limiting. Minimum effective value is 50ms.
   * @default 50
   */
  throttleMs?: number;

  /**
   * Whether to keep query states client-side, avoiding server calls.
   * Setting to `false` triggers a network request with the updated querystring.
   * @default true
   */
  shallow?: boolean;
}

export interface DataTableFilterMenuProps<TData>
  extends DataTableFilterListProps<TData> {}

export interface DataTableSortListProps<TData>
  extends DataTableFilterListProps<TData> {}

export interface DataTablePaginationProps<TData> extends EmptyProps<"div"> {
  /** The table instance. */
  table: Table<TData>;

  /**
   * The options of the pagination.
   * @default [10, 20, 30, 40, 50]
   */
  pageSizeOptions?: number[];
}

export interface DataTableViewOptionsProps<TData> {
  /** The table instance. */
  table: Table<TData>;
}

export interface DataTableSkeletonProps extends EmptyProps<"div"> {
  /** The number of columns in the table. */
  columnCount: number;

  /**
   * The number of rows in the table.
   * @default 10
   */
  rowCount?: number;

  /**
   * The number of filters in the table.
   * @default 0
   */
  filterCount?: number;

  /**
   * Array of CSS width values for each table column.
   * The maximum length of the array must match columnCount, extra values will be ignored.
   * @default ["auto"]
   */
  cellWidths?: string[];

  /**
   * Whether to show the view options.
   * @default true
   */
  withViewOptions?: boolean;

  /**
   * Whether to show the pagination bar.
   * @default true
   */
  withPagination?: boolean;

  /**
   * Whether to prevent the table cells from shrinking.
   * @default false
   */
  shrinkZero?: boolean;
}
