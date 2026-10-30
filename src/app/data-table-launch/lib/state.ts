import type {
  PaginationState,
  ReactTable,
  SortingState,
} from "@tanstack/react-table";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type { DataMode, FilterMode } from "@/lib/flag";

import { type DataTableLaunchTask, queryLaunchTasks } from "./data";

export type DataTableLaunchTable = ReactTable<
  DataTableFeatures,
  DataTableLaunchTask,
  unknown
>;

export const INITIAL_SORTING: SortingState = [{ id: "createdAt", desc: true }];
export const INITIAL_PAGINATION: PaginationState = {
  pageIndex: 0,
  pageSize: 10,
};
export const NETWORK_LOG_SIZE = 3;

export interface DataTableLaunchDemoState {
  columnCount: number;
  dataMode: DataMode;
  filterMode: FilterMode;
  keystroke: number;
}

export type DataTableLaunchDemoAction =
  | { type: "reset" }
  | { type: "columnCount"; columnCount: number }
  | { type: "dataMode"; dataMode: DataMode }
  | { type: "filterMode"; filterMode: FilterMode }
  | { type: "keystroke" };

export const INITIAL_DEMO: DataTableLaunchDemoState = {
  columnCount: 0,
  dataMode: "server",
  filterMode: "plain",
  keystroke: 0,
};

export function demoReducer(
  state: DataTableLaunchDemoState,
  action: DataTableLaunchDemoAction,
): DataTableLaunchDemoState {
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

export interface DataTableLaunchRequest {
  id: number;
  request: string;
  rowCount: number;
  latency: number;
}

export interface DataTableLaunchServerState {
  request: string | null;
  rows: DataTableLaunchTask[];
  pageCount: number;
  log: DataTableLaunchRequest[];
}

export type DataTableLaunchServerAction =
  | { type: "reset" }
  | {
      type: "resolve";
      request: string;
      latency: number;
      result: ReturnType<typeof queryLaunchTasks>;
    };

export function getInitialServer(): DataTableLaunchServerState {
  const { rows, pageCount } = queryLaunchTasks({
    filters: [],
    joinOperator: "and",
    sorting: INITIAL_SORTING,
    pagination: INITIAL_PAGINATION,
  });

  return { request: null, rows, pageCount, log: [] };
}

export function serverReducer(
  state: DataTableLaunchServerState,
  action: DataTableLaunchServerAction,
): DataTableLaunchServerState {
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
