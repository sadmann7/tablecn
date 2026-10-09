"use client";

import type * as React from "react";

import { Loader2 } from "lucide-react";

import {
  DATA_MODES,
  type DataMode,
  FILTER_MODES,
  type Flag,
  type FilterMode,
} from "@/lib/flag";
import { DataTableAdvancedToolbar } from "@/registry/bases/radix/components/data-table/data-table-advanced-toolbar";
import { DataTableCommandFilterMenu } from "@/registry/bases/radix/components/data-table/data-table-command-filter-menu";
import { DataTableFilterMenu } from "@/registry/bases/radix/components/data-table/data-table-filter-menu";
import { DataTableSortMenu } from "@/registry/bases/radix/components/data-table/data-table-sort-menu";
import { DataTableToolbar } from "@/registry/bases/radix/components/data-table/data-table-toolbar";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/registry/bases/radix/ui/toggle-group";

import { launchTasks } from "../lib/data";
import {
  type LaunchRequest,
  type LaunchTable,
  NETWORK_LOG_SIZE,
} from "../lib/state";

interface LaunchWindowProps {
  search: string;
  controls: React.ReactNode;
  network: React.ReactNode;
  children: React.ReactNode;
}

export function LaunchWindow({
  search,
  controls,
  network,
  children,
}: LaunchWindowProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-background shadow-[0_40px_120px_-20px_rgb(0_0_0/0.8)]">
      <div className="flex items-center gap-4 border-b border-white/10 bg-white/3 px-5 py-3">
        <div className="flex gap-2">
          <div className="size-3 rounded-full bg-white/15" />
          <div className="size-3 rounded-full bg-white/15" />
          <div className="size-3 rounded-full bg-white/15" />
        </div>
        <LaunchUrl search={search} />
      </div>
      <div className="flex flex-col gap-4 p-5">
        {controls}
        {children}
      </div>
      {network}
    </div>
  );
}

interface LaunchUrlProps {
  search: string;
}

function LaunchUrl({ search }: LaunchUrlProps) {
  return (
    <div
      data-launch="url"
      className="flex h-10 min-w-0 flex-1 items-center gap-3 rounded-lg bg-white/5 px-4 font-mono text-base"
    >
      <span className="truncate text-white/50">
        tablecn.com/tasks
        {search && <span className="text-emerald-300">?{search}</span>}
      </span>
    </div>
  );
}

interface LaunchControlBarProps {
  dataMode: DataMode;
  filterMode: FilterMode;
  onDataModeChange: (dataMode: DataMode) => void;
  onFilterModeChange: (filterMode: FilterMode) => void;
}

export function LaunchControlBar({
  dataMode,
  filterMode,
  onDataModeChange,
  onFilterModeChange,
}: LaunchControlBarProps) {
  return (
    <div className="flex items-center gap-6">
      <LaunchFlagGroup
        label="Mode"
        flags={DATA_MODES}
        value={dataMode}
        onValueChange={onDataModeChange}
      />
      <LaunchFlagGroup
        label="Filter"
        flags={FILTER_MODES}
        value={filterMode}
        onValueChange={onFilterModeChange}
      />
    </div>
  );
}

interface LaunchFlagGroupProps<TValue extends string> {
  label: string;
  flags: readonly Flag<TValue>[];
  value: TValue;
  onValueChange: (value: TValue) => void;
}

function LaunchFlagGroup<TValue extends string>({
  label,
  flags,
  value,
  onValueChange,
}: LaunchFlagGroupProps<TValue>) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={0}
        aria-label={label}
        value={value}
        onValueChange={(next) => {
          const flag = flags.find((item) => item.value === next);
          if (flag) onValueChange(flag.value);
        }}
      >
        {flags.map((flag) => (
          <ToggleGroupItem
            key={flag.value}
            data-launch={`${label.toLowerCase()}-${flag.value}`}
            value={flag.value}
            className="px-2.5 text-xs"
          >
            <flag.icon className="size-3.5" />
            {flag.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

interface LaunchToolbarProps {
  table: LaunchTable;
  filterMode: FilterMode;
}

export function LaunchToolbar({ table, filterMode }: LaunchToolbarProps) {
  if (filterMode === "plain") {
    return (
      <DataTableToolbar data-launch="toolbar" table={table}>
        <DataTableSortMenu table={table} align="end" />
      </DataTableToolbar>
    );
  }

  return (
    <DataTableAdvancedToolbar data-launch="toolbar" table={table}>
      <DataTableSortMenu table={table} align="start" />
      {filterMode === "advanced" ? (
        <DataTableFilterMenu
          table={table}
          align="start"
          updatePositionStrategy="always"
        />
      ) : (
        <DataTableCommandFilterMenu
          table={table}
          align="start"
          updatePositionStrategy="always"
        />
      )}
    </DataTableAdvancedToolbar>
  );
}

interface LaunchNetworkProps {
  dataMode: DataMode;
  request: string;
  isPending: boolean;
  log: LaunchRequest[];
}

export function LaunchNetwork({
  dataMode,
  request,
  isPending,
  log,
}: LaunchNetworkProps) {
  const isServerMode = dataMode === "server";

  return (
    <div className="flex h-40 flex-col gap-2 border-t border-white/10 bg-white/2 px-5 py-4 font-mono text-[0.9375rem]">
      <div className="flex items-center justify-between font-sans text-sm text-white/40">
        <span>Network</span>
        <span>{isServerMode ? "Server mode" : "Client mode"}</span>
      </div>
      {isServerMode ? (
        <ServerNetworkLog request={request} isPending={isPending} log={log} />
      ) : (
        <ClientNetworkSummary />
      )}
    </div>
  );
}

interface ServerNetworkLogProps {
  request: string;
  isPending: boolean;
  log: LaunchRequest[];
}

function ServerNetworkLog({ request, isPending, log }: ServerNetworkLogProps) {
  const visibleLog = log.slice(
    0,
    isPending ? NETWORK_LOG_SIZE - 1 : NETWORK_LOG_SIZE,
  );

  return (
    <>
      {isPending && (
        <NetworkRow
          status={<Loader2 className="size-4 animate-spin" />}
          path={getRequestPath(request)}
          detail="pending"
        />
      )}
      {visibleLog.map((entry) => (
        <NetworkRow
          key={entry.id}
          status="200"
          path={getRequestPath(entry.request)}
          detail={`${entry.rowCount} rows · ${entry.latency}ms`}
        />
      ))}
    </>
  );
}

function ClientNetworkSummary() {
  return (
    <div className="launch-rise flex items-center gap-4 text-white/70">
      <span className="w-12 text-emerald-300">0</span>
      <span>requests</span>
      <span className="font-sans text-white/40">
        {launchTasks.length} rows sorted, filtered, and paginated in the browser
      </span>
    </div>
  );
}

interface NetworkRowProps {
  status: React.ReactNode;
  path: string;
  detail: string;
}

function NetworkRow({ status, path, detail }: NetworkRowProps) {
  return (
    <div className="flex items-center gap-4 text-white/70">
      <span className="flex w-12 text-emerald-300">{status}</span>
      <span className="text-white/40">GET</span>
      <span className="min-w-0 flex-1 truncate">{path}</span>
      <span className="shrink-0 text-white/40">{detail}</span>
    </div>
  );
}

function getRequestPath(request: string) {
  return request ? `/api/tasks?${request}` : "/api/tasks";
}
