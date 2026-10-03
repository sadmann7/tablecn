"use client";

import type {
  ColumnDef,
  PaginationState,
  SortingState,
  Table,
} from "@tanstack/react-table";

import { cn } from "cn";
import { Loader2, Pause, Play, RotateCcw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import * as React from "react";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type { FilterOperator } from "@/lib/data-table-types";

import { coerceFilterValue, getIsEditableTarget } from "@/lib/data-table-utils";
import {
  DATA_MODES,
  type DataMode,
  FILTER_MODES,
  type Flag,
  type FilterMode,
} from "@/lib/flag";
import { DataTable } from "@/registry/bases/radix/components/data-table/data-table";
import { DataTableAdvancedToolbar } from "@/registry/bases/radix/components/data-table/data-table-advanced-toolbar";
import { DataTableCommandFilterMenu } from "@/registry/bases/radix/components/data-table/data-table-command-filter-menu";
import { DataTableFilterMenu } from "@/registry/bases/radix/components/data-table/data-table-filter-menu";
import { DataTableSortMenu } from "@/registry/bases/radix/components/data-table/data-table-sort-menu";
import { DataTableToolbar } from "@/registry/bases/radix/components/data-table/data-table-toolbar";
import { useDataTable } from "@/registry/bases/radix/hooks/use-data-table";
import { Button } from "@/registry/bases/radix/ui/button";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/registry/bases/radix/ui/toggle-group";

import { type LaunchTask, launchTasks, queryLaunchTasks } from "../lib/data";
import { launchColumns } from "./launch-columns";
import {
  LaunchCamera,
  type LaunchDirector,
  useLaunchDirector,
} from "./launch-director";
import {
  LaunchBackdrop,
  LaunchIntroScene,
  LaunchKeystroke,
  LaunchOutroScene,
  LaunchStory,
  LaunchVariants,
} from "./launch-scenes";

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;
const BASE_FONT_SIZE = 16;
const LAUNCH_DURATION = 28200;
const MAX_FRAME_MS = 1000;
const INITIAL_SORTING: SortingState = [{ id: "createdAt", desc: true }];
const INITIAL_PAGINATION: PaginationState = { pageIndex: 0, pageSize: 10 };
const FILTER_SHORTCUT_KEYS = ["⌘", "⇧", "F"];
const NETWORK_LOG_SIZE = 3;

const SCENES = [
  { id: "intro", start: 0 },
  { id: "columns", start: 2600 },
  { id: "server", start: 7000 },
  { id: "client", start: 11400 },
  { id: "plain", start: 15600 },
  { id: "advanced", start: 17400 },
  { id: "command", start: 21600 },
  { id: "outro", start: 24600 },
] as const;

type LaunchSceneId = (typeof SCENES)[number]["id"];

const COLUMN_SNIPPETS = [
  {
    columnIds: ["title"],
    accessorKey: "title",
    label: "Title",
    variant: "text",
    extra: 'placeholder: "Search titles...",',
  },
  {
    columnIds: ["status", "priority"],
    accessorKey: "status",
    label: "Status",
    variant: "multiSelect",
    extra: "options: statuses,",
  },
  {
    columnIds: ["estimatedHours"],
    accessorKey: "estimatedHours",
    label: "Est. Hours",
    variant: "range",
    extra: "range: [1, 24],",
  },
  {
    columnIds: ["createdAt"],
    accessorKey: "createdAt",
    label: "Created At",
    variant: "dateRange",
    extra: "icon: CalendarIcon,",
  },
];

const FILTER_PARAM_KEYS = COLUMN_SNIPPETS.flatMap(
  (snippet) => snippet.columnIds,
);

const SERVER_CODE = [
  "const { table } = useDataTable({",
  "  data,",
  "  columns,",
  '  mode: "server",',
  "  pageCount,",
  "});",
];

const CLIENT_CODE = [
  "const { table } = useDataTable({",
  "  data,",
  "  columns,",
  '  mode: "client",',
  "});",
];

const FILTER_CODE = [
  "<DataTableToolbar />           // plain",
  "<DataTableFilterMenu />        // advanced",
  "<DataTableCommandFilterMenu /> // command",
];

const HIDDEN_WINDOW: React.CSSProperties = {
  opacity: 0,
  filter: "blur(12px)",
  transform: "translateX(10rem) scale(0.96)",
};

const VISIBLE_WINDOW: React.CSSProperties = {
  opacity: 1,
  filter: "blur(0px)",
  transform: "none",
};

const WINDOW_SHOTS: Record<LaunchSceneId, React.CSSProperties> = {
  intro: HIDDEN_WINDOW,
  columns: VISIBLE_WINDOW,
  server: VISIBLE_WINDOW,
  client: VISIBLE_WINDOW,
  plain: VISIBLE_WINDOW,
  advanced: VISIBLE_WINDOW,
  command: VISIBLE_WINDOW,
  outro: {
    opacity: 0,
    filter: "blur(12px)",
    transform: "translateY(-5rem) scale(0.96)",
  },
};

export function LaunchDemo() {
  const [demo, dispatchDemo] = React.useReducer(demoReducer, INITIAL_DEMO);
  const [server, dispatchServer] = React.useReducer(
    serverReducer,
    undefined,
    getInitialServer,
  );
  const isServerMode = demo.dataMode === "server";

  const columns = React.useMemo(
    () => getFilterableColumns(demo.columnCount),
    [demo.columnCount],
  );
  const tableProps = {
    columns,
    initialState: {
      sorting: INITIAL_SORTING,
      pagination: INITIAL_PAGINATION,
    },
    getRowId: (row: LaunchTask) => row.id,
    clearOnDefault: true,
  };
  const { table } = useDataTable(
    isServerMode
      ? { ...tableProps, data: server.rows, pageCount: server.pageCount }
      : { ...tableProps, data: launchTasks, mode: "client" },
  );

  const searchParams = useSearchParams();
  const request = decodeURIComponent(searchParams.toString());
  const isPending = isServerMode && server.request !== request;
  useLaunchServer({ table, request, isEnabled: isServerMode, dispatchServer });

  const { director, refs } = useLaunchDirector();
  const {
    playback,
    progressRef,
    onPauseToggle,
    onRestart,
    onSeek,
    onChromeToggle,
  } = useLaunchTimeline((step) =>
    step.run({ table, director, dispatchDemo, dispatchServer }),
  );
  const scale = useStageScale();

  const scene = SCENES[playback.sceneIndex] ?? SCENES[0];
  const sceneKey = `${playback.cycle}-${scene.id}`;

  return (
    <div
      className={cn(
        "dark fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black text-foreground",
        playback.isChromeHidden && "cursor-none",
      )}
    >
      <div
        ref={refs.stage}
        data-paused={playback.isPaused}
        className="launch-stage relative h-270 w-480 shrink-0 overflow-hidden bg-[#09090b] font-sans"
      >
        <LaunchCamera refs={refs}>
          <LaunchBackdrop />
          <LaunchScene
            key={`${sceneKey}-scene`}
            sceneId={scene.id}
            columnCount={demo.columnCount}
          />
          <div
            className="absolute top-27 left-180 w-282 transition-[transform,opacity,filter] duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={WINDOW_SHOTS[scene.id]}
          >
            <LaunchWindow
              search={request}
              controls={
                <LaunchControlBar
                  dataMode={demo.dataMode}
                  filterMode={demo.filterMode}
                  onDataModeChange={(dataMode) =>
                    dispatchDemo({ type: "dataMode", dataMode })
                  }
                  onFilterModeChange={(filterMode) =>
                    dispatchDemo({ type: "filterMode", filterMode })
                  }
                />
              }
              network={
                <LaunchNetwork
                  dataMode={demo.dataMode}
                  request={request}
                  isPending={isPending}
                  log={server.log}
                />
              }
            >
              <div
                data-pending={isPending}
                className="transition-opacity duration-300 data-[pending=true]:opacity-50"
              >
                <DataTable table={table}>
                  <LaunchToolbar table={table} filterMode={demo.filterMode} />
                </DataTable>
              </div>
            </LaunchWindow>
          </div>
        </LaunchCamera>
        {demo.keystroke > 0 && (
          <LaunchKeystroke
            key={`${playback.cycle}-${demo.keystroke}`}
            keys={FILTER_SHORTCUT_KEYS}
          />
        )}
      </div>
      {!playback.isChromeHidden && (
        <LaunchControls
          scale={scale}
          sceneIndex={playback.sceneIndex}
          isPaused={playback.isPaused}
          progressRef={progressRef}
          onPauseToggle={onPauseToggle}
          onRestart={onRestart}
          onSeek={onSeek}
          onChromeToggle={onChromeToggle}
        />
      )}
    </div>
  );
}

interface LaunchSceneProps {
  sceneId: LaunchSceneId;
  columnCount: number;
}

function LaunchScene({ sceneId, columnCount }: LaunchSceneProps) {
  switch (sceneId) {
    case "intro":
      return <LaunchIntroScene />;
    case "columns":
      return <LaunchColumnsStory columnCount={columnCount} />;
    case "server":
      return (
        <LaunchStory
          eyebrow='mode: "server"'
          title="Query on the server."
          description="Paging, sorting, and filters go through the URL to your database."
          code={SERVER_CODE}
          highlightedLines={[3, 4]}
        />
      );
    case "client":
      return (
        <LaunchStory
          eyebrow='mode: "client"'
          title="Or keep it in the browser."
          description="Pass every row once. Sorting, filtering, and paging run locally."
          code={CLIENT_CODE}
          highlightedLines={[3]}
        />
      );
    case "plain":
      return (
        <LaunchStory
          eyebrow="Plain filters"
          title="Filter in the toolbar."
          description="One control per column, with readable URL params."
          code={FILTER_CODE}
          highlightedLines={[0]}
        />
      );
    case "advanced":
      return (
        <LaunchStory
          eyebrow="Advanced filters"
          title="Build any query."
          description="Operators, and/or logic, and reordering. A compact filter list in the URL when plain params can't hold it."
          code={FILTER_CODE}
          highlightedLines={[1]}
        />
      );
    case "command":
      return (
        <LaunchStory
          eyebrow="Command filters"
          title="Filter from the keyboard."
          description="Pick a field, type a value. Open it with ⌘⇧F."
          code={FILTER_CODE}
          highlightedLines={[2]}
        />
      );
    case "outro":
      return <LaunchOutroScene />;
  }
}

interface LaunchColumnsStoryProps {
  columnCount: number;
}

function LaunchColumnsStory({ columnCount }: LaunchColumnsStoryProps) {
  const snippet = COLUMN_SNIPPETS[Math.max(columnCount - 1, 0)];

  return (
    <LaunchStory
      eyebrow="Columns"
      title="Define columns. Get filters."
      description="Set a variant in the column meta and the toolbar renders the matching filter."
      code={[
        "{",
        `  accessorKey: "${snippet?.accessorKey}",`,
        "  meta: {",
        `    label: "${snippet?.label}",`,
        `    variant: "${snippet?.variant}",`,
        `    ${snippet?.extra}`,
        "  },",
        "  enableColumnFilter: true,",
        "},",
      ]}
      highlightedLines={columnCount > 0 ? [4, 5] : []}
    >
      <LaunchVariants
        variants={COLUMN_SNIPPETS.map((item) => item.variant)}
        activeCount={columnCount}
      />
    </LaunchStory>
  );
}

interface LaunchToolbarProps {
  table: Table<DataTableFeatures, LaunchTask>;
  filterMode: FilterMode;
}

function LaunchToolbar({ table, filterMode }: LaunchToolbarProps) {
  if (filterMode === "plain") {
    return (
      <DataTableToolbar table={table}>
        <DataTableSortMenu table={table} align="end" />
      </DataTableToolbar>
    );
  }

  return (
    <DataTableAdvancedToolbar table={table}>
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

interface LaunchWindowProps {
  search: string;
  controls: React.ReactNode;
  network: React.ReactNode;
  children: React.ReactNode;
}

function LaunchWindow({
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
  const urlFormat = getUrlFormat(search);

  return (
    <div
      data-launch="url"
      className="flex h-10 min-w-0 flex-1 items-center gap-3 rounded-lg bg-white/5 px-4 font-mono text-base"
    >
      <span className="truncate text-white/50">
        tablecn.com/tasks
        {search && <span className="text-emerald-300">?{search}</span>}
      </span>
      {urlFormat && (
        <span
          key={urlFormat}
          className="launch-flash ml-auto shrink-0 rounded-md border border-emerald-400/30 px-2 py-0.5 font-sans text-sm text-emerald-300"
        >
          {urlFormat}
        </span>
      )}
    </div>
  );
}

interface LaunchControlBarProps {
  dataMode: DataMode;
  filterMode: FilterMode;
  onDataModeChange: (dataMode: DataMode) => void;
  onFilterModeChange: (filterMode: FilterMode) => void;
}

function LaunchControlBar({
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

interface LaunchNetworkProps {
  dataMode: DataMode;
  request: string;
  isPending: boolean;
  log: LaunchRequest[];
}

function LaunchNetwork({
  dataMode,
  request,
  isPending,
  log,
}: LaunchNetworkProps) {
  return (
    <div className="flex h-40 flex-col gap-2 border-t border-white/10 bg-white/2 px-5 py-4 font-mono text-[0.9375rem]">
      <div className="flex items-center justify-between font-sans text-sm text-white/40">
        <span>Network</span>
        <span>{dataMode === "server" ? "Server mode" : "Client mode"}</span>
      </div>
      {dataMode === "server" ? (
        <>
          {isPending && (
            <NetworkRow
              status={<Loader2 className="size-4 animate-spin" />}
              path={getRequestPath(request)}
              detail="pending"
            />
          )}
          {log
            .slice(0, isPending ? NETWORK_LOG_SIZE - 1 : NETWORK_LOG_SIZE)
            .map((entry) => (
              <NetworkRow
                key={entry.id}
                status="200"
                path={getRequestPath(entry.request)}
                detail={`${entry.rowCount} rows · ${entry.latency}ms`}
              />
            ))}
        </>
      ) : (
        <div className="launch-rise flex items-center gap-4 text-white/70">
          <span className="w-12 text-emerald-300">0</span>
          <span>requests</span>
          <span className="font-sans text-white/40">
            {launchTasks.length} rows sorted, filtered, and paginated in the
            browser
          </span>
        </div>
      )}
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

interface LaunchControlsProps {
  scale: number;
  sceneIndex: number;
  isPaused: boolean;
  progressRef: React.RefObject<HTMLDivElement | null>;
  onPauseToggle: () => void;
  onRestart: () => void;
  onSeek: (sceneIndex: number) => void;
  onChromeToggle: () => void;
}

function LaunchControls({
  scale,
  sceneIndex,
  isPaused,
  progressRef,
  onPauseToggle,
  onRestart,
  onSeek,
  onChromeToggle,
}: LaunchControlsProps) {
  return (
    <div
      className="absolute inset-x-0 bottom-4 flex justify-center"
      style={{ zoom: String(1 / scale) }}
    >
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-2 py-1.5 text-white/70 backdrop-blur-md">
        <Button
          aria-label={isPaused ? "Play" : "Pause"}
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          onClick={onPauseToggle}
        >
          {isPaused ? <Play /> : <Pause />}
        </Button>
        <Button
          aria-label="Restart"
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          onClick={onRestart}
        >
          <RotateCcw />
        </Button>
        <div className="flex items-center gap-1">
          {SCENES.map((scene, index) => (
            <button
              key={scene.id}
              type="button"
              aria-label={`Go to ${scene.id}`}
              data-state={index === sceneIndex ? "active" : undefined}
              className="rounded-full px-2 py-1 font-mono text-xs text-white/45 capitalize hover:text-white/80 data-[state=active]:bg-white/10 data-[state=active]:text-white"
              onClick={() => onSeek(index)}
            >
              {scene.id}
            </button>
          ))}
        </div>
        <div className="h-1 w-48 overflow-hidden rounded-full bg-white/15">
          <div
            ref={progressRef}
            className="h-full w-full origin-left bg-white/80"
            style={{ scale: "var(--launch-progress, 0) 1" }}
          />
        </div>
        <button
          type="button"
          className="px-3 font-mono text-xs text-white/45 hover:text-white/80"
          onClick={onChromeToggle}
        >
          Space · R · H to hide
        </button>
      </div>
    </div>
  );
}

interface LaunchDemoState {
  columnCount: number;
  dataMode: DataMode;
  filterMode: FilterMode;
  keystroke: number;
}

type LaunchDemoAction =
  | { type: "reset" }
  | { type: "column" }
  | { type: "dataMode"; dataMode: DataMode }
  | { type: "filterMode"; filterMode: FilterMode }
  | { type: "keystroke" };

const INITIAL_DEMO: LaunchDemoState = {
  columnCount: 0,
  dataMode: "server",
  filterMode: "plain",
  keystroke: 0,
};

function demoReducer(
  state: LaunchDemoState,
  action: LaunchDemoAction,
): LaunchDemoState {
  switch (action.type) {
    case "reset":
      return INITIAL_DEMO;
    case "column":
      return {
        ...state,
        columnCount: Math.min(state.columnCount + 1, COLUMN_SNIPPETS.length),
      };
    case "dataMode":
      return { ...state, dataMode: action.dataMode };
    case "filterMode":
      return { ...state, filterMode: action.filterMode };
    case "keystroke":
      return { ...state, keystroke: state.keystroke + 1 };
  }
}

function getFilterableColumns(
  columnCount: number,
): ColumnDef<DataTableFeatures, LaunchTask>[] {
  const filterableIds = new Set(
    COLUMN_SNIPPETS.slice(0, columnCount).flatMap(
      (snippet) => snippet.columnIds,
    ),
  );

  return launchColumns.map((column) => ({
    ...column,
    enableColumnFilter: column.id ? filterableIds.has(column.id) : false,
  }));
}

interface LaunchRequest {
  id: number;
  request: string;
  rowCount: number;
  latency: number;
}

interface LaunchServerState {
  request: string | null;
  rows: LaunchTask[];
  pageCount: number;
  log: LaunchRequest[];
}

type LaunchServerAction =
  | { type: "reset" }
  | {
      type: "resolve";
      request: string;
      latency: number;
      result: ReturnType<typeof queryLaunchTasks>;
    };

function getInitialServer(): LaunchServerState {
  const { rows, pageCount } = queryLaunchTasks({
    filters: [],
    joinOperator: "and",
    sorting: INITIAL_SORTING,
    pagination: INITIAL_PAGINATION,
  });

  return { request: null, rows, pageCount, log: [] };
}

function serverReducer(
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

interface UseLaunchServerProps {
  table: Table<DataTableFeatures, LaunchTask>;
  request: string;
  isEnabled: boolean;
  dispatchServer: React.Dispatch<LaunchServerAction>;
}

/** Answers each server-mode URL the way a route handler would. */
function useLaunchServer({
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

interface LaunchStepContext {
  table: Table<DataTableFeatures, LaunchTask>;
  director: LaunchDirector;
  dispatchDemo: React.Dispatch<LaunchDemoAction>;
  dispatchServer: React.Dispatch<LaunchServerAction>;
}

interface LaunchStep {
  at: number;
  run: (context: LaunchStepContext) => void;
}

/**
 * The scripted table actions, in milliseconds from the start of a loop. The
 * filter menus are driven through their real keyboard shortcut and inputs.
 */
const LAUNCH_STEPS: LaunchStep[] = [
  {
    at: 0,
    run: ({ table, director, dispatchDemo, dispatchServer }) => {
      closeFilterMenu();
      director.reset();
      resetTable(table);
      dispatchDemo({ type: "reset" });
      dispatchServer({ type: "reset" });
    },
  },
  { at: 3200, run: ({ dispatchDemo }) => dispatchDemo({ type: "column" }) },
  { at: 4200, run: ({ dispatchDemo }) => dispatchDemo({ type: "column" }) },
  { at: 5200, run: ({ dispatchDemo }) => dispatchDemo({ type: "column" }) },
  { at: 6200, run: ({ dispatchDemo }) => dispatchDemo({ type: "column" }) },
  {
    at: 8000,
    run: ({ table }) =>
      table.setSorting([{ id: "estimatedHours", desc: true }]),
  },
  { at: 9100, run: ({ table }) => table.nextPage() },
  {
    at: 10200,
    run: ({ table }) => setFilter(table, "status", ["todo", "in-progress"]),
  },
  {
    at: 11400,
    run: ({ table, dispatchDemo }) => {
      resetTable(table);
      dispatchDemo({ type: "dataMode", dataMode: "client" });
    },
  },
  { at: 12000, run: ({ table }) => setFilter(table, "title", "f") },
  { at: 12150, run: ({ table }) => setFilter(table, "title", "fi") },
  { at: 12300, run: ({ table }) => setFilter(table, "title", "fix") },
  {
    at: 13300,
    run: ({ table }) => table.setSorting([{ id: "title", desc: false }]),
  },
  { at: 14200, run: ({ table }) => table.nextPage() },
  { at: 15600, run: ({ table }) => resetTable(table) },
  {
    at: 16000,
    run: ({ table }) => setFilter(table, "status", ["todo", "in-progress"]),
  },
  { at: 16600, run: ({ table }) => setFilter(table, "priority", ["high"]) },
  {
    at: 16800,
    run: ({ director }) =>
      director.moveCursor(getLaunchTarget("filter-advanced")),
  },
  {
    at: 17300,
    run: ({ director }) => director.click(getLaunchTarget("filter-advanced")),
  },
  {
    at: 17400,
    run: ({ dispatchDemo }) =>
      dispatchDemo({ type: "filterMode", filterMode: "advanced" }),
  },
  {
    at: 17700,
    run: ({ director }) => {
      const trigger = getFilterTrigger();
      director.moveCursor(trigger);
      director.focus(trigger, { offsetX: 16, offsetY: 6 });
    },
  },
  {
    at: 18300,
    run: ({ director }) => {
      const trigger = getFilterTrigger();
      director.click(trigger);
      trigger?.click();
    },
  },
  {
    at: 18800,
    run: ({ director }) =>
      director.moveCursor(getFilterOperatorTrigger("has any of")),
  },
  {
    at: 19300,
    run: ({ director }) => {
      const trigger = getFilterOperatorTrigger("has any of");
      director.click(trigger);
      pressKey(trigger, "Enter");
    },
  },
  {
    at: 19750,
    run: ({ director }) => director.moveCursor(getSelectOption("has none of")),
  },
  {
    at: 20150,
    run: ({ table, director }) => {
      const option = getSelectOption("has none of");
      if (!option) {
        setFilterOperator(table, "status", "notInArray");
        return;
      }
      director.click(option);
      pressKey(option, "Enter");
    },
  },
  {
    at: 20500,
    run: ({ director }) =>
      director.focus(getLaunchTarget("url"), { scale: 1.5, offsetX: 12 }),
  },
  {
    at: 21500,
    run: ({ director }) => {
      closeFilterMenu();
      director.reset();
    },
  },
  {
    at: 21600,
    run: ({ dispatchDemo }) =>
      dispatchDemo({ type: "filterMode", filterMode: "command" }),
  },
  { at: 22200, run: openFilterMenu },
  { at: 22600, run: () => typeCommand("ti") },
  { at: 22750, run: () => typeCommand("title") },
  { at: 23100, run: pressCommandEnter },
  { at: 23500, run: () => typeCommand("f") },
  { at: 23650, run: () => typeCommand("fi") },
  { at: 23800, run: () => typeCommand("fix") },
  { at: 24100, run: pressCommandEnter },
  { at: 24600, run: closeFilterMenu },
];

function resetTable(table: Table<DataTableFeatures, LaunchTask>) {
  table.resetColumnFilters(true);
  table.resetJoinOperator(true);
  table.setSorting(INITIAL_SORTING);
  table.setPageIndex(0);
}

function setFilter(
  table: Table<DataTableFeatures, LaunchTask>,
  columnId: string,
  value: unknown,
) {
  table.getColumn(columnId)?.setFilterValue(value);
}

function setFilterOperator(
  table: Table<DataTableFeatures, LaunchTask>,
  columnId: string,
  operator: FilterOperator,
) {
  const filter = table
    .getColumnFilterItems()
    .find((item) => item.id === columnId);
  if (!filter) return;

  table.updateColumnFilter(filter.filterId, {
    operator,
    value: coerceFilterValue(operator, filter.value),
  });
}

function openFilterMenu({ dispatchDemo }: LaunchStepContext) {
  if (document.querySelector("[data-radix-popper-content-wrapper]")) return;

  dispatchDemo({ type: "keystroke" });
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key: "f", metaKey: true, shiftKey: true }),
  );
}

function closeFilterMenu() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
}

function typeCommand(value: string) {
  const input = getCommandInput();
  if (!input) return;

  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function pressCommandEnter() {
  getCommandInput()?.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
}

function getLaunchTarget(name: string) {
  return document.querySelector(`[data-launch="${name}"]`);
}

function getFilterTrigger() {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>("[role=toolbar] button"),
  ).find((button) => button.textContent?.startsWith("Filter"));
}

function getFilterOperatorTrigger(label: string) {
  return Array.from(
    document.querySelectorAll(
      "[data-radix-popper-content-wrapper] [role=combobox]",
    ),
  ).find((element) =>
    element.textContent?.toLowerCase().includes(label.toLowerCase()),
  );
}

function getSelectOption(label: string) {
  return Array.from(
    document.querySelectorAll("[data-slot=select-content] [role=option]"),
  ).find(
    (element) => element.textContent?.toLowerCase() === label.toLowerCase(),
  );
}

function pressKey(target: Element | null | undefined, key: string) {
  target?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

function getCommandInput() {
  return document.querySelector<HTMLInputElement>("[cmdk-input]");
}

function getUrlFormat(search: string) {
  const params = new URLSearchParams(search);
  if (params.has("filters")) return "Filter list";
  if (FILTER_PARAM_KEYS.some((key) => params.has(key))) return "Plain params";
  return null;
}

function getRequestPath(request: string) {
  return request ? `/api/tasks?${request}` : "/api/tasks";
}

function getLatency(request: string) {
  let hash = 0;
  for (const char of request) hash = (hash + char.charCodeAt(0)) % 997;
  return 180 + (hash % 160);
}

interface LaunchPlayback {
  sceneIndex: number;
  cycle: number;
  isPaused: boolean;
  isChromeHidden: boolean;
}

type LaunchPlaybackAction =
  | { type: "scene"; sceneIndex: number; cycle: number }
  | { type: "pause"; isPaused: boolean }
  | { type: "chrome" };

function playbackReducer(
  state: LaunchPlayback,
  action: LaunchPlaybackAction,
): LaunchPlayback {
  switch (action.type) {
    case "scene":
      if (
        state.sceneIndex === action.sceneIndex &&
        state.cycle === action.cycle
      ) {
        return state;
      }
      return { ...state, sceneIndex: action.sceneIndex, cycle: action.cycle };
    case "pause":
      return { ...state, isPaused: action.isPaused };
    case "chrome":
      return { ...state, isChromeHidden: !state.isChromeHidden };
  }
}

const INITIAL_PLAYBACK: LaunchPlayback = {
  sceneIndex: 0,
  cycle: 0,
  isPaused: false,
  isChromeHidden: false,
};

/**
 * Drives the loop from one animation frame clock, so pausing freezes both the
 * scripted table steps and the scene animations.
 */
function useLaunchTimeline(onStep: (step: LaunchStep) => void) {
  const [playback, dispatch] = React.useReducer(
    playbackReducer,
    INITIAL_PLAYBACK,
  );
  const clockRef = React.useRef({
    elapsed: 0,
    stepIndex: 0,
    cycle: 0,
    isPaused: false,
  });
  const progressRef = React.useRef<HTMLDivElement>(null);
  const runStep = React.useEffectEvent(onStep);

  React.useEffect(() => {
    let frame = 0;
    let last = performance.now();

    function onFrame(now: number) {
      const clock = clockRef.current;
      const delta = Math.min(now - last, MAX_FRAME_MS);
      last = now;

      if (!clock.isPaused) {
        clock.elapsed += delta;

        if (clock.elapsed >= LAUNCH_DURATION) {
          clock.elapsed = 0;
          clock.stepIndex = 0;
          clock.cycle += 1;
        }

        let step = LAUNCH_STEPS[clock.stepIndex];
        while (step && step.at <= clock.elapsed) {
          runStep(step);
          clock.stepIndex += 1;
          step = LAUNCH_STEPS[clock.stepIndex];
        }

        dispatch({
          type: "scene",
          sceneIndex: getSceneIndex(clock.elapsed),
          cycle: clock.cycle,
        });
      }

      progressRef.current?.style.setProperty(
        "--launch-progress",
        String(clock.elapsed / LAUNCH_DURATION),
      );
      frame = requestAnimationFrame(onFrame);
    }

    frame = requestAnimationFrame(onFrame);
    return () => cancelAnimationFrame(frame);
  }, []);

  const onPauseToggle = React.useCallback(() => {
    const clock = clockRef.current;
    clock.isPaused = !clock.isPaused;
    dispatch({ type: "pause", isPaused: clock.isPaused });
  }, []);

  const onRestart = React.useCallback(() => {
    const clock = clockRef.current;
    clock.elapsed = 0;
    clock.stepIndex = 0;
    clock.cycle += 1;
    dispatch({ type: "scene", sceneIndex: 0, cycle: clock.cycle });
  }, []);

  const onSeek = React.useCallback((sceneIndex: number) => {
    const clock = clockRef.current;
    clock.elapsed = SCENES[sceneIndex]?.start ?? 0;
    clock.stepIndex = 0;
    clock.cycle += 1;
    dispatch({ type: "scene", sceneIndex, cycle: clock.cycle });
  }, []);

  const onChromeToggle = React.useCallback(() => {
    dispatch({ type: "chrome" });
  }, []);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.isTrusted || getIsEditableTarget(event.target)) return;

      if (event.key === " ") {
        event.preventDefault();
        onPauseToggle();
      } else if (event.key === "r") {
        onRestart();
      } else if (event.key === "h") {
        onChromeToggle();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onPauseToggle, onRestart, onChromeToggle]);

  return {
    playback,
    progressRef,
    onPauseToggle,
    onRestart,
    onSeek,
    onChromeToggle,
  };
}

function getSceneIndex(elapsed: number) {
  let index = 0;

  for (const [sceneIndex, scene] of SCENES.entries()) {
    if (scene.start <= elapsed) index = sceneIndex;
  }

  return index;
}

function subscribeToResize(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

function getStageScale() {
  return Math.min(
    window.innerWidth / STAGE_WIDTH,
    window.innerHeight / STAGE_HEIGHT,
  );
}

function getServerStageScale() {
  return 0.5;
}

/**
 * Scales the root font size instead of transforming the stage. Everything is
 * sized in rem, so popovers that portal to the body scale with the table and
 * measure the real viewport.
 */
function useStageScale() {
  const scale = React.useSyncExternalStore(
    subscribeToResize,
    getStageScale,
    getServerStageScale,
  );

  React.useEffect(() => {
    const root = document.documentElement;
    const previousFontSize = root.style.fontSize;
    root.style.fontSize = `${BASE_FONT_SIZE * scale}px`;
    return () => {
      root.style.fontSize = previousFontSize;
    };
  }, [scale]);

  return scale;
}
