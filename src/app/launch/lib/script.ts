import type * as React from "react";

import type { FilterOperator } from "@/lib/data-table-types";
import type { DataMode, FilterMode } from "@/lib/flag";

import { coerceFilterValue } from "@/lib/data-table-utils";

import type { LaunchDirector } from "../components/launch-director";

import {
  closeAllMenus,
  closeFacetedList,
  flashToolbarFilter,
  getFilterOperatorTrigger,
  getFacetedOption,
  getFilterTrigger,
  getFilterValueTrigger,
  getIsPopoverOpen,
  getLaunchTarget,
  getSelectOption,
  pressCommandEnter,
  pressFilterShortcut,
  openPopover,
  pressKey,
  replaceUrl,
  typeCommand,
} from "./dom";
import {
  type LaunchDemoAction,
  type LaunchServerAction,
  type LaunchTable,
} from "./state";

export type LaunchSceneId =
  | "intro"
  | "columns"
  | "server"
  | "client"
  | "plain"
  | "advanced"
  | "command"
  | "outro";

export interface LaunchStoryContent {
  eyebrow: string;
  title: string;
  description: string;
  code: string[];
  highlightedLines: number[];
}

export interface LaunchStepContext {
  table: LaunchTable;
  director: LaunchDirector;
  dispatchDemo: React.Dispatch<LaunchDemoAction>;
  dispatchServer: React.Dispatch<LaunchServerAction>;
}

type LaunchStepRun = (context: LaunchStepContext) => void;

export interface LaunchStep {
  /** Milliseconds from the start of the scene. */
  at: number;
  run: LaunchStepRun;
}

interface LaunchSceneScript {
  id: LaunchSceneId;
  duration: number;
  story?: LaunchStoryContent;
  steps: LaunchStep[];
}

export const FILTER_SHORTCUT_KEYS = ["⌘", "⇧", "F"];
const TYPING_INTERVAL = 150;

export const COLUMN_SNIPPETS = [
  {
    columnIds: ["title"],
    filterLabels: ["Search titles..."],
    accessorKey: "title",
    label: "Title",
    variant: "text",
    extra: 'placeholder: "Search titles...",',
  },
  {
    columnIds: ["status", "priority"],
    filterLabels: ["Status", "Priority"],
    accessorKey: "status",
    label: "Status",
    variant: "multiSelect",
    extra: "options: statuses,",
  },
  {
    columnIds: ["estimatedHours"],
    filterLabels: ["Est. Hours"],
    accessorKey: "estimatedHours",
    label: "Est. Hours",
    variant: "range",
    extra: "range: [1, 24],",
  },
  {
    columnIds: ["createdAt"],
    filterLabels: ["Created At"],
    accessorKey: "createdAt",
    label: "Created At",
    variant: "dateRange",
    extra: "icon: CalendarIcon,",
  },
];

const FILTER_CODE = [
  "<DataTableToolbar />           // plain",
  "<DataTableFilterMenu />        // advanced",
  "<DataTableCommandFilterMenu /> // command",
];

/**
 * The scripted loop. Each scene owns the table actions that play while it is
 * on screen, so retiming a scene never shifts the ones after it. The filter
 * menus are driven through their real keyboard shortcut and inputs.
 */
const SCRIPT: LaunchSceneScript[] = [
  {
    id: "intro",
    duration: 2600,
    steps: [{ at: 0, run: resetDemo }],
  },
  {
    id: "columns",
    duration: 4400,
    steps: COLUMN_SNIPPETS.flatMap((snippet, index) => [
      { at: 600 + index * 1000, run: showColumns(index + 1) },
      {
        at: 700 + index * 1000,
        run: () => {
          for (const label of snippet.filterLabels) flashToolbarFilter(label);
        },
      },
    ]),
  },
  {
    id: "server",
    duration: 4400,
    story: {
      eyebrow: 'mode: "server"',
      title: "Query on the server.",
      description:
        "Paging, sorting, and filters go through the URL to your database.",
      code: [
        "const { table } = useDataTable({",
        "  data,",
        "  columns,",
        '  mode: "server",',
        "  pageCount,",
        "});",
      ],
      highlightedLines: [3, 4],
    },
    steps: [
      { at: 600, run: setUrl("?status=todo", "Status") },
      { at: 1200, run: setUrl("?status=todo,in-progress", "Status") },
      {
        at: 2200,
        run: setUrl("?status=todo,in-progress&sort=estimatedHours.desc"),
      },
      {
        at: 3200,
        run: setUrl("?status=todo,in-progress&sort=estimatedHours.desc&page=2"),
      },
    ],
  },
  {
    id: "client",
    duration: 4200,
    story: {
      eyebrow: 'mode: "client"',
      title: "Or keep it in the browser.",
      description:
        "Pass every row once. Sorting, filtering, and paging run locally.",
      code: [
        "const { table } = useDataTable({",
        "  data,",
        "  columns,",
        '  mode: "client",',
        "});",
      ],
      highlightedLines: [3],
    },
    steps: [
      {
        at: 0,
        run: (context) => {
          replaceUrl("");
          setDataMode("client")(context);
        },
      },
      { at: 700, run: setUrl("?status=in-progress", "Status") },
      {
        at: 1500,
        run: setUrl("?status=in-progress,canceled", "Status"),
      },
      {
        at: 2400,
        run: setUrl("?status=in-progress,canceled&sort=priority.desc"),
      },
      {
        at: 3200,
        run: setUrl("?status=in-progress,canceled&sort=priority.desc&page=2"),
      },
    ],
  },
  {
    id: "plain",
    duration: 1800,
    story: {
      eyebrow: "Plain filters",
      title: "Filter in the toolbar.",
      description: "One control per column, with every filter kept in the URL.",
      code: FILTER_CODE,
      highlightedLines: [0],
    },
    steps: [
      { at: 0, run: setUrl("") },
      { at: 400, run: setUrl("?status=todo", "Status") },
      { at: 1000, run: setUrl("?status=todo&priority=high", "Priority") },
      {
        at: 1200,
        run: ({ director }) =>
          director.moveCursor(getLaunchTarget("filter-advanced")),
      },
      {
        at: 1700,
        run: ({ director }) =>
          director.click(getLaunchTarget("filter-advanced")),
      },
    ],
  },
  {
    id: "advanced",
    duration: 6200,
    story: {
      eyebrow: "Advanced filters",
      title: "Build any query.",
      description:
        "Operators, and/or logic, and reordering. All in readable params like status=not.in.todo,done.",
      code: FILTER_CODE,
      highlightedLines: [1],
    },
    steps: [
      { at: 0, run: setFilterMode("advanced") },
      {
        at: 300,
        run: ({ director }) => {
          const trigger = getFilterTrigger();
          director.moveCursor(trigger);
          director.focus(trigger, { offsetX: 16, offsetY: 6 });
        },
      },
      {
        at: 900,
        run: ({ director }) => {
          const trigger = getFilterTrigger();
          director.click(trigger);
          openPopover(trigger);
        },
      },
      {
        at: 1400,
        run: ({ director }) =>
          director.moveCursor(getFilterOperatorTrigger("Status")),
      },
      {
        at: 1900,
        run: ({ director }) => {
          const trigger = getFilterOperatorTrigger("Status");
          director.click(trigger);
          pressKey(trigger, "Enter");
        },
      },
      {
        at: 2350,
        run: ({ director }) =>
          director.moveCursor(getSelectOption("has none of")),
      },
      {
        at: 2750,
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
        at: 3200,
        run: ({ director }) =>
          director.moveCursor(getFilterValueTrigger("Status")),
      },
      {
        at: 3600,
        run: ({ director }) => {
          const trigger = getFilterValueTrigger("Status");
          director.click(trigger);
          openPopover(trigger);
        },
      },
      {
        at: 4000,
        run: ({ director }) => director.moveCursor(getFacetedOption("Done")),
      },
      {
        at: 4400,
        run: ({ table, director }) => {
          const option = getFacetedOption("Done");
          if (!option) {
            setFilterValue(table, "status", ["todo", "done"]);
            return;
          }
          director.click(option);
          if (!option.hasAttribute("data-checked")) option.click();
        },
      },
      { at: 4900, run: closeFacetedList },
      {
        at: 6100,
        run: ({ director }) => {
          closeAllMenus();
          director.reset();
        },
      },
    ],
  },
  {
    id: "command",
    duration: 3000,
    story: {
      eyebrow: "Command filters",
      title: "Filter from the keyboard.",
      description: "Pick a field, type a value. Open it with ⌘⇧F.",
      code: FILTER_CODE,
      highlightedLines: [2],
    },
    steps: [
      { at: 0, run: setFilterMode("command") },
      { at: 600, run: openFilterMenu },
      ...typeSteps(1000, ["ti", "title"], typeCommandStep),
      { at: 1500, run: pressCommandEnter },
      ...typeSteps(1900, ["f", "fi", "fix"], typeCommandStep),
      { at: 2500, run: pressCommandEnter },
    ],
  },
  {
    id: "outro",
    duration: 3600,
    steps: [{ at: 0, run: () => closeAllMenus() }],
  },
];

export interface LaunchScene extends LaunchSceneScript {
  /** Milliseconds from the start of the loop. */
  start: number;
}

export const SCENES = getTimedScenes(SCRIPT);

export const LAUNCH_DURATION = SCRIPT.reduce(
  (total, scene) => total + scene.duration,
  0,
);

/** Every step on the loop's clock, in the order they fire. */
export const LAUNCH_STEPS: LaunchStep[] = SCENES.flatMap((scene) =>
  scene.steps.map((step) => ({ at: scene.start + step.at, run: step.run })),
);

export function getSceneIndex(elapsed: number) {
  let index = 0;

  for (const [sceneIndex, scene] of SCENES.entries()) {
    if (scene.start <= elapsed) index = sceneIndex;
  }

  return index;
}

function getTimedScenes(script: LaunchSceneScript[]): LaunchScene[] {
  let start = 0;

  return script.map((scene) => {
    const timed = { ...scene, start };
    start += scene.duration;
    return timed;
  });
}

function resetDemo({
  director,
  dispatchDemo,
  dispatchServer,
}: LaunchStepContext) {
  closeAllMenus();
  director.reset();
  replaceUrl("");
  dispatchDemo({ type: "reset" });
  dispatchServer({ type: "reset" });
}

function openFilterMenu({ dispatchDemo }: LaunchStepContext) {
  if (getIsPopoverOpen()) return;

  dispatchDemo({ type: "keystroke" });
  pressFilterShortcut();
}

function showColumns(columnCount: number): LaunchStepRun {
  return ({ dispatchDemo }) =>
    dispatchDemo({ type: "columnCount", columnCount });
}

function setDataMode(dataMode: DataMode): LaunchStepRun {
  return ({ dispatchDemo }) => dispatchDemo({ type: "dataMode", dataMode });
}

function setFilterMode(filterMode: FilterMode): LaunchStepRun {
  return ({ dispatchDemo }) => dispatchDemo({ type: "filterMode", filterMode });
}

/** Edits the URL like an address bar would, flashing the filter it changes. */
function setUrl(search: string, filterLabel?: string): LaunchStepRun {
  return () => {
    replaceUrl(search);
    if (filterLabel) flashToolbarFilter(filterLabel);
  };
}

function typeCommandStep(value: string): LaunchStepRun {
  return () => typeCommand(value);
}

/** Types one value per keystroke tick, like someone typing a word. */
function typeSteps(
  at: number,
  values: string[],
  createRun: (value: string) => LaunchStepRun,
): LaunchStep[] {
  return values.map((value, index) => ({
    at: at + index * TYPING_INTERVAL,
    run: createRun(value),
  }));
}

function setFilterValue(
  table: LaunchTable,
  columnId: string,
  value: string | string[],
) {
  const filter = table
    .getColumnFilterItems()
    .find((item) => item.id === columnId);
  if (!filter) return;

  table.updateColumnFilter(filter.filterId, { value });
}

function setFilterOperator(
  table: LaunchTable,
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
