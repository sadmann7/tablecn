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
  getCommandTrigger,
  getFilterTrigger,
  getFilterValueTrigger,
  getIsPopoverOpen,
  getSelectOption,
  pressCommandArrow,
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
/** How long the cursor shows its press before the click lands. */
const PRESS_MS = 140;

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
    columnIds: ["status"],
    filterLabels: ["Status"],
    accessorKey: "status",
    label: "Status",
    variant: "multiSelect",
    extra: "options: statuses,",
  },
  {
    columnIds: ["priority"],
    filterLabels: ["Priority"],
    accessorKey: "priority",
    label: "Priority",
    variant: "multiSelect",
    extra: "options: priorities,",
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

/** The ring starts after the control has painted its new value. */
const FLASH_AFTER_MS = 100;

const SCRIPT: LaunchSceneScript[] = [
  {
    id: "intro",
    duration: 3200,
    steps: [{ at: 0, run: resetDemo }],
  },
  {
    id: "columns",
    duration: 5600,
    steps: COLUMN_SNIPPETS.flatMap((snippet, index) => {
      const at = 600 + index * 780;
      return [
        { at, run: showColumns(index + 1) },
        flashStep(at, snippet.filterLabels),
      ];
    }),
  },
  {
    id: "server",
    duration: 3600,
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
      ...urlSteps(700, "?status=todo"),
      ...urlSteps(1600, "?status=todo&sort=estimatedHours.desc"),
      ...urlSteps(2500, "?status=todo&sort=estimatedHours.desc&page=2"),
    ],
  },
  {
    id: "client",
    duration: 2600,
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
      ...urlSteps(700, "?status=in-progress"),
    ],
  },
  {
    id: "plain",
    duration: 1700,
    story: {
      eyebrow: "Plain filters",
      title: "Filter in the toolbar.",
      description: "One control per column, with every filter kept in the URL.",
      code: FILTER_CODE,
      highlightedLines: [0],
    },
    steps: [
      { at: 0, run: () => replaceUrl("") },
      ...urlSteps(500, "?priority=high"),
    ],
  },
  {
    id: "advanced",
    duration: 5300,
    story: {
      eyebrow: "Advanced filters",
      title: "Build any query.",
      description:
        "Operators, and/or logic, and reordering. All in readable params like status=not.in.todo,done.",
      code: FILTER_CODE,
      highlightedLines: [1],
    },
    steps: [
      {
        at: 0,
        run: (context) => {
          // The operator demo edits the Status row, so the row has to exist
          // before the menu opens. Plain itself only sets Priority.
          replaceUrl("?priority=high&status=todo");
          setFilterMode("advanced")(context);
        },
      },
      {
        at: 220,
        run: ({ director }) => {
          const trigger = getFilterTrigger();
          director.moveCursor(trigger);
          director.focus(trigger, { offsetX: 16, offsetY: 6 });
        },
      },
      ...clickSteps(600, getFilterTrigger, (trigger) => openPopover(trigger)),
      {
        at: 960,
        run: ({ director }) =>
          director.moveCursor(getFilterOperatorTrigger("Status")),
      },
      ...clickSteps(
        1280,
        () => getFilterOperatorTrigger("Status"),
        (trigger) => pressKey(trigger, "Enter"),
      ),
      {
        at: 1700,
        run: ({ director }) =>
          director.moveCursor(getSelectOption("has none of")),
      },
      ...clickSteps(
        2120,
        () => getSelectOption("has none of"),
        (option, { table }) => {
          if (!option) {
            setFilterOperator(table, "status", "notInArray");
            return;
          }
          pressKey(option, "Enter");
        },
      ),
      {
        at: 2600,
        run: ({ director }) =>
          director.moveCursor(getFilterValueTrigger("Status")),
      },
      ...clickSteps(
        2920,
        () => getFilterValueTrigger("Status"),
        (trigger) => openPopover(trigger),
      ),
      {
        at: 3300,
        run: ({ director }) => director.moveCursor(getFacetedOption("Done")),
      },
      ...clickSteps(
        3720,
        () => getFacetedOption("Done"),
        (option, { table }) => {
          if (!option) {
            setFilterValue(table, "status", ["todo", "done"]);
            return;
          }
          if (!option.hasAttribute("data-checked")) option.click();
        },
      ),
      // Holds on the new selection before the list closes
      { at: 4300, run: closeFacetedList },
      {
        at: 4640,
        run: ({ director }) => {
          closeAllMenus();
          director.zoomOut();
        },
      },
    ],
  },
  {
    id: "command",
    duration: 4400,
    story: {
      eyebrow: "Command filters",
      title: "Filter from the keyboard.",
      description: "Pick a field, then a value. Open it with ⌘⇧F.",
      code: FILTER_CODE,
      highlightedLines: [2],
    },
    steps: [
      { at: 0, run: setFilterMode("command") },
      {
        at: 1000,
        run: ({ director }) => {
          const trigger = getCommandTrigger();
          director.moveCursor(trigger);
          director.focus(trigger, { offsetX: 16, offsetY: 6 });
        },
      },
      { at: 1170, run: openFilterMenu },
      ...typeSteps(1520, ["st", "status"], typeCommandStep),
      { at: 1920, run: pressCommandEnter },
      { at: 2400, run: pressCommandArrow },
      {
        at: 2720,
        run: ({ director }) => {
          pressCommandEnter();
          director.reset(640);
        },
      },
    ],
  },
  {
    id: "outro",
    duration: 4200,
    steps: [{ at: 0, run: () => closeAllMenus() }],
  },
];

export interface LaunchScene extends LaunchSceneScript {
  start: number;
}

export const SCENES = getTimedScenes(SCRIPT);

export const LAUNCH_DURATION = SCRIPT.reduce(
  (total, scene) => total + scene.duration,
  0,
);

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

/**
 * A press, then the click's effect a beat later, so a menu doesn't open or
 * close on the same frame the cursor touches it.
 */
function clickSteps<TTarget extends Element>(
  at: number,
  getTarget: () => TTarget | null | undefined,
  act: (target: TTarget | null | undefined, context: LaunchStepContext) => void,
): LaunchStep[] {
  return [
    { at, run: ({ director }) => director.click(getTarget()) },
    { at: at + PRESS_MS, run: (context) => act(getTarget(), context) },
  ];
}

function urlSteps(at: number, search: string): LaunchStep[] {
  return [{ at, run: () => replaceUrl(search) }];
}

function flashStep(at: number, labels: string[]): LaunchStep {
  return {
    at: at + FLASH_AFTER_MS,
    run: () => {
      for (const label of labels) flashToolbarFilter(label);
    },
  };
}

function typeCommandStep(value: string): LaunchStepRun {
  return () => typeCommand(value);
}

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
