import * as React from "react";

import type { LaunchServerAction, LaunchTable } from "../lib/state";

import { queryLaunchTasks } from "../lib/data";

interface UseLaunchServerProps {
  table: LaunchTable;
  request: string;
  isEnabled: boolean;
  dispatchServer: React.Dispatch<LaunchServerAction>;
}

/** Answers each server-mode URL the way a route handler would. */
export function useLaunchServer({
  table,
  request,
  isEnabled,
  dispatchServer,
}: UseLaunchServerProps) {
  const onResolve = React.useEffectEvent((latency: number) => {
    dispatchServer({
      type: "resolve",
      request,
      latency,
      result: queryLaunchTasks({
        filters: table.getColumnFilterItems(),
        joinOperator: table.atoms.joinOperator.get(),
        sorting: table.atoms.sorting.get(),
        pagination: table.atoms.pagination.get(),
      }),
    });
  });

  React.useEffect(() => {
    if (!isEnabled) return;

    const latency = getLatency(request);
    // Stands in for the network round trip, so the request shows as pending.
    const timeout = window.setTimeout(() => onResolve(latency), latency);

    return () => window.clearTimeout(timeout);
  }, [request, isEnabled]);
}

/** Deterministic per request, so every recorded loop looks the same. */
function getLatency(request: string) {
  let hash = 0;
  for (const char of request) hash = (hash + char.charCodeAt(0)) % 997;
  return 180 + (hash % 160);
}
