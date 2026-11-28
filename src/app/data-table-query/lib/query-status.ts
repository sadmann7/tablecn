import type { UseQueryResult } from "@tanstack/react-query";

import type { DataStatus } from "@/lib/data-table-types";

type QueryState = Pick<
  UseQueryResult,
  "data" | "isError" | "isFetching" | "isPending"
>;

export function getQueryStatus(query: QueryState): DataStatus {
  if (query.isFetching) {
    return query.data === undefined ? "loading" : "refreshing";
  }
  if (query.isError) return "error";
  if (query.isPending) return "loading";
  return "idle";
}
