"use client";

import { cn } from "cn";
import { useSearchParams } from "next/navigation";
import * as React from "react";

import { DataTable } from "@/registry/bases/radix/components/data-table/data-table";
import { useDataTable } from "@/registry/bases/radix/hooks/use-data-table";

import { useDataTableLaunchServer } from "../hooks/use-data-table-launch-server";
import { useDataTableLaunchTimeline } from "../hooks/use-data-table-launch-timeline";
import { useStageScale } from "../hooks/use-stage-scale";
import { type DataTableLaunchTask, launchTasks } from "../lib/data";
import {
  COLUMN_SNIPPETS,
  type DataTableLaunchScene,
  type DataTableLaunchSceneId,
  FILTER_SHORTCUT_KEYS,
  LAUNCH_DURATION,
  SCENES,
} from "../lib/script";
import {
  demoReducer,
  getInitialServer,
  INITIAL_DEMO,
  INITIAL_PAGINATION,
  INITIAL_SORTING,
  serverReducer,
} from "../lib/state";
import { launchColumns } from "./data-table-launch-columns";
import { DataTableLaunchControls } from "./data-table-launch-controls";
import {
  DataTableLaunchCamera,
  useDataTableLaunchDirector,
} from "./data-table-launch-director";
import {
  DataTableLaunchBackdrop,
  DataTableLaunchIntroScene,
  DataTableLaunchKeystroke,
  DataTableLaunchOutroScene,
  DataTableLaunchStory,
  DataTableLaunchVariants,
} from "./data-table-launch-scenes";
import {
  DataTableLaunchNetwork,
  DataTableLaunchToolbar,
  DataTableLaunchWindow,
} from "./data-table-launch-window";

const VISIBLE_WINDOW: React.CSSProperties = {
  opacity: 1,
  filter: "blur(0px)",
  transform: "none",
  transitionDelay: "180ms",
};

const WINDOW_SHOTS: Partial<
  Record<DataTableLaunchSceneId, React.CSSProperties>
> = {
  intro: {
    opacity: 0,
    filter: "blur(10px)",
    transform:
      "perspective(120rem) translateY(24rem) rotateX(28deg) scale(0.92)",
  },
  outro: {
    opacity: 0,
    filter: "blur(14px)",
    transform: "perspective(120rem) translateY(-4rem) scale(0.86)",
  },
};

export function DataTableLaunchDemo() {
  const [demo, dispatchDemo] = React.useReducer(demoReducer, INITIAL_DEMO);
  const [server, dispatchServer] = React.useReducer(
    serverReducer,
    undefined,
    getInitialServer,
  );
  const isServerMode = demo.dataMode === "server";

  const searchParams = useSearchParams();
  const request = decodeURIComponent(searchParams.toString());
  const urlFilterIds = launchColumns
    .flatMap((column) =>
      column.id && searchParams.has(column.id) ? [column.id] : [],
    )
    .join(",");
  const columns = React.useMemo(
    () => getFilterableColumns(demo.columnCount, urlFilterIds),
    [demo.columnCount, urlFilterIds],
  );
  const tableProps = {
    columns,
    initialState: {
      sorting: INITIAL_SORTING,
      pagination: INITIAL_PAGINATION,
    },
    getRowId: (row: DataTableLaunchTask) => row.id,
    clearOnDefault: true,
  };
  const { table } = useDataTable(
    isServerMode
      ? { ...tableProps, data: server.rows, pageCount: server.pageCount }
      : { ...tableProps, data: launchTasks, mode: "client" },
  );

  const isPending = isServerMode && server.request !== request;
  useDataTableLaunchServer({
    table,
    request,
    isEnabled: isServerMode,
    dispatchServer,
  });

  const { director, attach } = useDataTableLaunchDirector();
  const { stage } = attach;
  const {
    playback,
    progressRef,
    onPauseToggle,
    onRestart,
    onSeek,
    onChromeToggle,
  } = useDataTableLaunchTimeline((step) =>
    step.run({ table, director, dispatchDemo, dispatchServer }),
  );
  const scale = useStageScale();

  const scene = SCENES[playback.sceneIndex] ?? SCENES[0];
  if (!scene) return null;

  return (
    <div
      className={cn(
        "dark fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black text-foreground",
        playback.isChromeHidden && "cursor-none",
      )}
    >
      <div
        ref={stage}
        data-paused={playback.isPaused}
        data-scene={scene.id}
        data-cycle={playback.cycle}
        data-duration={LAUNCH_DURATION}
        className="launch-stage relative h-270 w-480 shrink-0 overflow-hidden bg-[#09090b] font-sans"
      >
        <DataTableLaunchBackdrop />
        <DataTableLaunchCamera attach={attach}>
          <div
            className="launch-window absolute top-27 left-180 w-282"
            style={WINDOW_SHOTS[scene.id] ?? VISIBLE_WINDOW}
          >
            <DataTableLaunchWindow
              search={request}
              sheenKey={`${playback.cycle}-${scene.id === "intro" ? "hidden" : "shown"}`}
              network={
                <DataTableLaunchNetwork
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
                  <DataTableLaunchToolbar
                    table={table}
                    filterMode={demo.filterMode}
                  />
                </DataTable>
              </div>
            </DataTableLaunchWindow>
          </div>
        </DataTableLaunchCamera>
        <DataTableLaunchSceneFrame
          sceneKey={`${playback.cycle}-${scene.id}`}
          scene={scene}
          columnCount={demo.columnCount}
        />
        {demo.keystroke > 0 && (
          <DataTableLaunchKeystroke
            key={`${playback.cycle}-${demo.keystroke}`}
            keys={FILTER_SHORTCUT_KEYS}
          />
        )}
      </div>
      {!playback.isChromeHidden && (
        <DataTableLaunchControls
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

interface DataTableLaunchSceneFrameProps extends DataTableLaunchSceneContentProps {
  sceneKey: string;
}

function DataTableLaunchSceneFrame(props: DataTableLaunchSceneFrameProps) {
  const [shown, setShown] = React.useState(props);
  const [leaving, setLeaving] =
    React.useState<DataTableLaunchSceneFrameProps | null>(null);

  if (shown.sceneKey !== props.sceneKey) {
    setLeaving(shown);
    setShown(props);
  } else if (shown.columnCount !== props.columnCount) {
    setShown(props);
  }

  function onLeaveEnd(event: React.AnimationEvent<HTMLDivElement>) {
    if (event.animationName !== "launch-scene-exit") return;
    const key = event.currentTarget.dataset.sceneKey;
    setLeaving((current) => (current?.sceneKey === key ? null : current));
  }

  return (
    <>
      {leaving && (
        <div
          key={leaving.sceneKey}
          data-scene-key={leaving.sceneKey}
          className="launch-scene-exit pointer-events-none absolute inset-0"
          onAnimationEnd={onLeaveEnd}
        >
          <DataTableLaunchSceneContent
            scene={leaving.scene}
            columnCount={leaving.columnCount}
          />
        </div>
      )}
      <div
        key={props.sceneKey}
        className="pointer-events-none absolute inset-0"
      >
        <DataTableLaunchSceneContent
          scene={props.scene}
          columnCount={props.columnCount}
        />
      </div>
    </>
  );
}

interface DataTableLaunchSceneContentProps {
  scene: DataTableLaunchScene;
  columnCount: number;
}

function DataTableLaunchSceneContent({
  scene,
  columnCount,
}: DataTableLaunchSceneContentProps) {
  if (scene.id === "intro") return <DataTableLaunchIntroScene />;
  if (scene.id === "outro") return <DataTableLaunchOutroScene />;
  if (scene.id === "columns") {
    return <DataTableLaunchColumnsStory columnCount={columnCount} />;
  }
  if (!scene.story) return null;

  return <DataTableLaunchStory {...scene.story} />;
}

interface DataTableLaunchColumnsStoryProps {
  columnCount: number;
}

function DataTableLaunchColumnsStory({
  columnCount,
}: DataTableLaunchColumnsStoryProps) {
  const snippet = COLUMN_SNIPPETS[Math.max(columnCount - 1, 0)];
  if (!snippet) return null;

  return (
    <DataTableLaunchStory
      eyebrow="Columns"
      title="Define columns. Get filters."
      description="Set a variant in the column meta and the toolbar renders the matching filter."
      code={[
        "{",
        `  accessorKey: "${snippet.accessorKey}",`,
        "  meta: {",
        `    label: "${snippet.label}",`,
        `    variant: "${snippet.variant}",`,
        ...("filter" in snippet ? [`    filter: "${snippet.filter}",`] : []),
        `    ${snippet.extra}`,
        "  },",
        "  enableColumnFilter: true,",
        "},",
      ]}
      highlightedLines={columnCount > 0 ? [4, 5] : []}
    >
      <DataTableLaunchVariants
        variants={[...new Set(COLUMN_SNIPPETS.map((item) => item.variant))]}
        activeCount={
          new Set(
            COLUMN_SNIPPETS.slice(0, columnCount).map((item) => item.variant),
          ).size
        }
      />
    </DataTableLaunchStory>
  );
}

/**
 * A column with a filter still in the URL stays filterable, so the table can
 * clear that param on reset before the column hides its filter again.
 */
function getFilterableColumns(columnCount: number, urlFilterIds: string) {
  const filterableIds = new Set([
    ...COLUMN_SNIPPETS.slice(0, columnCount).flatMap(
      (snippet) => snippet.columnIds,
    ),
    ...urlFilterIds.split(",").filter(Boolean),
  ]);

  return launchColumns.map((column) => ({
    ...column,
    enableColumnFilter: column.id ? filterableIds.has(column.id) : false,
  }));
}
