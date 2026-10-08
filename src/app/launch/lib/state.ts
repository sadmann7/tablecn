import type {
  PaginationState,
  SortingState,
  Table,
} from "@tanstack/react-table";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type { DataMode, FilterMode } from "@/lib/flag";

import { type LaunchTask, queryLaunchTasks } from "./data";

export type LaunchTable = Table<DataTableFeatures, LaunchTask>;

export const INITIAL_SORTING: SortingState = [{ id: "createdAt", desc: true }];
export const INITIAL_PAGINATION: PaginationState = {
  pageIndex: 0,
  pageSize: 10,
};
export const NETWORK_LOG_SIZE = 3;

export interface LaunchDemoState {
  columnCount: number;
  dataMode: DataMode;
  filterMode: FilterMode;
  keystroke: number;
}

export type LaunchDemoAction =
  | { type: "reset" }
  | { type: "columnCount"; columnCount: number }
  | { type: "dataMode"; dataMode: DataMode }
  | { type: "filterMode"; filterMode: FilterMode }
  | { type: "keystroke" };

export const INITIAL_DEMO: LaunchDemoState = {
  columnCount: 0,
  dataMode: "server",
  filterMode: "plain",
  keystroke: 0,
};

export function demoReducer(
  state: LaunchDemoState,
  action: LaunchDemoAction,
): LaunchDemoState {
  switch (action.type) {
    case "reset":
      return INITIAL_DEMO;
    case "columnCount":
      return { ...state, columnCount: action.columnCount };
    case "dataMode":
      return { ...state, dataMode: action.dataMode };
    case "filterMode":
      return { ...state, filterMode: action.filterMode };
    case "keystroke":
      return { ...state, keystroke: state.keystroke + 1 };
  }
}

export interface LaunchRequest {
  id: number;
  request: string;
  rowCount: number;
  latency: number;
}

export interface LaunchServerState {
  request: string | null;
  rows: LaunchTask[];
  pageCount: number;
  log: LaunchRequest[];
}

export type LaunchServerAction =
  | { type: "reset" }
  | {
      type: "resolve";
      request: string;
      latency: number;
      result: ReturnType<typeof queryLaunchTasks>;
    };

export function getInitialServer(): LaunchServerState {
  const { rows, pageCount } = queryLaunchTasks({
    filters: [],
    joinOperator: "and",
    sorting: INITIAL_SORTING,
    pagination: INITIAL_PAGINATION,
  });

  return { request: null, rows, pageCount, log: [] };
}

export function serverReducer(
  state: LaunchServerState,
  action: LaunchServerAction,
): LaunchServerState {
  switch (action.type) {
    case "reset":
      return { ...state, log: [] };
    case "resolve":
      return {
        request: action.request,
        rows: action.result.rows,
        pageCount: action.result.pageCount,
        log: [
          {
            id: (state.log[0]?.id ?? 0) + 1,
            request: action.request,
            rowCount: action.result.rowCount,
            latency: action.latency,
          },
          ...state.log,
        ].slice(0, NETWORK_LOG_SIZE),
      };
  }
}

export function resetTable(table: LaunchTable) {
  table.resetColumnFilters(true);
  table.resetJoinOperator(true);
  table.setSorting(INITIAL_SORTING);
  table.setPageIndex(0);
}
