"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { cn } from "cn";
import { useSearchParams } from "next/navigation";
import * as React from "react";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { DataTable } from "@/registry/bases/radix/components/data-table/data-table";
import { useDataTable } from "@/registry/bases/radix/hooks/use-data-table";

import { useLaunchServer } from "../hooks/use-launch-server";
import { useLaunchTimeline } from "../hooks/use-launch-timeline";
import { useStageScale } from "../hooks/use-stage-scale";
import { type LaunchTask, launchTasks } from "../lib/data";
import {
  COLUMN_SNIPPETS,
  FILTER_SHORTCUT_KEYS,
  LAUNCH_DURATION,
  type LaunchScene,
  type LaunchSceneId,
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
import { launchColumns } from "./launch-columns";
import { LaunchControls } from "./launch-controls";
import { LaunchCamera, useLaunchDirector } from "./launch-director";
import {
  LaunchBackdrop,
  LaunchIntroScene,
  LaunchKeystroke,
  LaunchOutroScene,
  LaunchStory,
  LaunchVariants,
} from "./launch-scenes";
import {
  LaunchControlBar,
  LaunchNetwork,
  LaunchToolbar,
  LaunchWindow,
} from "./launch-window";

const VISIBLE_WINDOW: React.CSSProperties = {
  opacity: 1,
  filter: "blur(0px)",
  transform: "none",
};

const WINDOW_SHOTS: Partial<Record<LaunchSceneId, React.CSSProperties>> = {
  intro: {
    opacity: 0,
    filter: "blur(12px)",
    transform: "translateX(10rem) scale(0.96)",
  },
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
    getRowId: (row: LaunchTask) => row.id,
    clearOnDefault: true,
  };
  const { table } = useDataTable(
    isServerMode
      ? { ...tableProps, data: server.rows, pageCount: server.pageCount }
      : { ...tableProps, data: launchTasks, mode: "client" },
  );

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
  if (!scene) return null;

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
        data-scene={scene.id}
        data-cycle={playback.cycle}
        data-duration={LAUNCH_DURATION}
        className="launch-stage relative h-270 w-480 shrink-0 overflow-hidden bg-[#09090b] font-sans"
      >
        <LaunchBackdrop />
        <LaunchCamera refs={refs}>
          <LaunchSceneFrame sceneKey={`${playback.cycle}-${scene.id}`}>
            <LaunchSceneContent scene={scene} columnCount={demo.columnCount} />
          </LaunchSceneFrame>
          <div
            className="absolute top-27 left-180 w-282 transition-[transform,opacity,filter] duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={WINDOW_SHOTS[scene.id] ?? VISIBLE_WINDOW}
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

interface LaunchSceneFrameProps {
  sceneKey: string;
  children: React.ReactNode;
}

function LaunchSceneFrame({ sceneKey, children }: LaunchSceneFrameProps) {
  const shownKey = React.useRef(sceneKey);
  const shownNode = React.useRef(children);
  const [leaving, setLeaving] = React.useState<{
    key: string;
    node: React.ReactNode;
  } | null>(null);

  if (shownKey.current !== sceneKey) {
    setLeaving({ key: shownKey.current, node: shownNode.current });
    shownKey.current = sceneKey;
  }

  shownNode.current = children;

  function onLeaveEnd(event: React.AnimationEvent<HTMLDivElement>) {
    if (event.animationName !== "launch-scene-exit") return;
    const key = event.currentTarget.dataset.sceneKey;
    setLeaving((current) => (current?.key === key ? null : current));
  }

  return (
    <>
      {leaving && (
        <div
          key={leaving.key}
          data-scene-key={leaving.key}
          className="launch-scene-exit pointer-events-none absolute inset-0"
          onAnimationEnd={onLeaveEnd}
        >
          {leaving.node}
        </div>
      )}
      <div key={sceneKey} className="absolute inset-0">
        {children}
      </div>
    </>
  );
}

interface LaunchSceneContentProps {
  scene: LaunchScene;
  columnCount: number;
}

function LaunchSceneContent({ scene, columnCount }: LaunchSceneContentProps) {
  if (scene.id === "intro") return <LaunchIntroScene />;
  if (scene.id === "outro") return <LaunchOutroScene />;
  if (scene.id === "columns") {
    return <LaunchColumnsStory columnCount={columnCount} />;
  }
  if (!scene.story) return null;

  return <LaunchStory {...scene.story} />;
}

interface LaunchColumnsStoryProps {
  columnCount: number;
}

function LaunchColumnsStory({ columnCount }: LaunchColumnsStoryProps) {
  const snippet = COLUMN_SNIPPETS[Math.max(columnCount - 1, 0)];
  if (!snippet) return null;

  return (
    <LaunchStory
      eyebrow="Columns"
      title="Define columns. Get filters."
      description="Set a variant in the column meta and the toolbar renders the matching filter."
      code={[
        "{",
        `  accessorKey: "${snippet.accessorKey}",`,
        "  meta: {",
        `    label: "${snippet.label}",`,
        `    variant: "${snippet.variant}",`,
        `    ${snippet.extra}`,
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

/**
 * A column with a filter still in the URL stays filterable, so the table can
 * clear that param on reset before the column hides its filter again.
 */
function getFilterableColumns(
  columnCount: number,
  urlFilterIds: string,
): ColumnDef<DataTableFeatures, LaunchTask>[] {
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
