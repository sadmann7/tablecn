import type * as React from "react";

import type { FilterOperator } from "@/lib/data-table-types";
import type { DataMode, FilterMode } from "@/lib/flag";

import { coerceFilterValue } from "@/lib/data-table-utils";

import type { DataTableLaunchDirector } from "../components/data-table-launch-director";
import type {
  DataTableLaunchDemoAction,
  DataTableLaunchServerAction,
  DataTableLaunchTable,
} from "./state";

import {
  closeAllMenus,
  closeFacetedList,
  getCommandTrigger,
  getFacetedOption,
  getFilterOperatorTrigger,
  getFilterTrigger,
  getFilterValueTrigger,
  getIsPopoverOpen,
  getSelectOption,
  getToolbarFilter,
  openPopover,
  pressCommandArrow,
  pressCommandEnter,
  pressFilterShortcut,
  pressKey,
  replaceUrl,
  typeCommand,
} from "./dom";

export type DataTableLaunchSceneId =
  | "intro"
  | "columns"
  | "server"
  | "client"
  | "plain"
  | "advanced"
  | "command"
  | "outro";

export interface DataTableLaunchStoryContent {
  eyebrow: string;
  title: string;
  description: string;
  code: string[];
  highlightedLines: number[];
}

export interface DataTableLaunchStepContext {
  table: DataTableLaunchTable;
  director: DataTableLaunchDirector;
  dispatchDemo: React.Dispatch<DataTableLaunchDemoAction>;
  dispatchServer: React.Dispatch<DataTableLaunchServerAction>;
}

type DataTableLaunchStepRun = (context: DataTableLaunchStepContext) => void;

export interface DataTableLaunchStep {
  at: number;
  run: DataTableLaunchStepRun;
}

interface DataTableLaunchSceneScript {
  id: DataTableLaunchSceneId;
  duration: number;
  story?: DataTableLaunchStoryContent;
  steps: DataTableLaunchStep[];
}

export const FILTER_SHORTCUT_KEYS = ["⌘", "⇧", "F"];
const TYPING_INTERVAL = 150;
const PRESS_MS = 140;

export const COLUMN_SNIPPETS = [
  {
    columnIds: ["title"],
    accessorKey: "title",
    label: "Title",
    variant: "text",
    extra: 'placeholder: "Search titles...",',
  },
  {
    columnIds: ["status"],
    accessorKey: "status",
    label: "Status",
    variant: "multi-select",
    extra: "options: statuses,",
  },
  {
    columnIds: ["priority"],
    accessorKey: "priority",
    label: "Priority",
    variant: "multi-select",
    extra: "options: priorities,",
  },
  {
    columnIds: ["estimatedHours"],
    accessorKey: "estimatedHours",
    label: "Est. Hours",
    variant: "number",
    filter: "range",
    extra: "range: [1, 24],",
  },
  {
    columnIds: ["createdAt"],
    accessorKey: "createdAt",
    label: "Created At",
    variant: "date",
    filter: "date-range",
    extra: "icon: CalendarIcon,",
  },
];

const FILTER_CODE = [
  "<DataTableToolbar />           // plain",
  "<DataTableFilterMenu />        // advanced",
  "<DataTableCommandFilterMenu /> // command",
];

const SCRIPT: DataTableLaunchSceneScript[] = [
  {
    id: "intro",
    duration: 3200,
    steps: [{ at: 0, run: resetDemo }],
  },
  {
    id: "columns",
    duration: 5600,
    steps: COLUMN_SNIPPETS.map((_, index) => ({
      at: 600 + index * 780,
      run: showColumns(index + 1),
    })),
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
    duration: 2600,
    story: {
      eyebrow: "Plain filters",
      title: "Filter in the toolbar.",
      description: "One control per column, with every filter kept in the URL.",
      code: FILTER_CODE,
      highlightedLines: [0],
    },
    steps: [
      { at: 0, run: () => replaceUrl("") },
      {
        at: 500,
        run: ({ director }) =>
          director.moveCursor(getToolbarFilter("Priority")),
      },
      ...clickSteps(
        900,
        () => getToolbarFilter("Priority"),
        (trigger) => openPopover(trigger),
      ),
      {
        at: 1240,
        run: ({ director }) => director.moveCursor(getFacetedOption("High")),
      },
      ...clickSteps(
        1540,
        () => getFacetedOption("High"),
        (option) => {
          if (!option) {
            replaceUrl("?priority=high");
            return;
          }
          if (!option.hasAttribute("data-checked")) option.click();
        },
      ),
      { at: 2100, run: closeFacetedList },
    ],
  },
  {
    id: "advanced",
    duration: 5860,
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
        at: 1000,
        run: ({ director }) => director.moveCursor(getFilterTrigger()),
      },
      {
        at: 1420,
        run: ({ director }) =>
          director.focus(getFilterTrigger(), { offsetX: 16, offsetY: 6 }),
      },
      ...clickSteps(1800, getFilterTrigger, (trigger) => openPopover(trigger)),
      {
        at: 2160,
        run: ({ director }) =>
          director.moveCursor(getFilterOperatorTrigger("Status")),
      },
      ...clickSteps(
        2480,
        () => getFilterOperatorTrigger("Status"),
        (trigger) => pressKey(trigger, "Enter"),
      ),
      {
        at: 2900,
        run: ({ director }) =>
          director.moveCursor(getSelectOption("has none of")),
      },
      ...clickSteps(
        3200,
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
        at: 3680,
        run: ({ director }) =>
          director.moveCursor(getFilterValueTrigger("Status")),
      },
      ...clickSteps(
        4000,
        () => getFilterValueTrigger("Status"),
        (trigger) => openPopover(trigger),
      ),
      {
        at: 4380,
        run: ({ director }) => director.moveCursor(getFacetedOption("Done")),
      },
      ...clickSteps(
        4680,
        () => getFacetedOption("Done"),
        (option, { table }) => {
          if (!option) {
            setFilterValue(table, "status", ["todo", "done"]);
            return;
          }
          if (!option.hasAttribute("data-checked")) option.click();
        },
      ),
      { at: 5260, run: closeFacetedList },
    ],
  },
  {
    id: "command",
    duration: 4420,
    story: {
      eyebrow: "Command filters",
      title: "Filter from the keyboard.",
      description: "Pick a field, then a value. Open it with ⌘⇧F.",
      code: FILTER_CODE,
      highlightedLines: [2],
    },
    steps: [
      {
        at: 0,
        run: ({ director }) => {
          closeAllMenus();
          director.zoomOut();
        },
      },
      { at: 280, run: setFilterMode("command") },
      {
        at: 1100,
        run: ({ director }) => {
          const trigger = getCommandTrigger();
          director.moveCursor(trigger);
          director.focus(trigger, { offsetX: 16, offsetY: 6 });
        },
      },
      { at: 1270, run: openFilterMenu },
      ...typeSteps(1620, ["st", "status"], typeCommandStep),
      { at: 2020, run: pressCommandEnter },
      { at: 2400, run: pressCommandArrow },
      { at: 2640, run: pressCommandEnter },
      { at: 3040, run: ({ director }) => director.reset() },
    ],
  },
  {
    id: "outro",
    duration: 4200,
    steps: [{ at: 0, run: () => closeAllMenus() }],
  },
];

export interface DataTableLaunchScene extends DataTableLaunchSceneScript {
  start: number;
}

export const SCENES = getTimedScenes(SCRIPT);

export const LAUNCH_DURATION = SCRIPT.reduce(
  (total, scene) => total + scene.duration,
  0,
);

export const LAUNCH_STEPS: DataTableLaunchStep[] = SCENES.flatMap((scene) =>
  scene.steps.map((step) => ({ at: scene.start + step.at, run: step.run })),
);

export function getSceneIndex(elapsed: number) {
  let index = 0;

  for (const [sceneIndex, scene] of SCENES.entries()) {
    if (scene.start <= elapsed) index = sceneIndex;
  }

  return index;
}

function getTimedScenes(
  script: DataTableLaunchSceneScript[],
): DataTableLaunchScene[] {
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
}: DataTableLaunchStepContext) {
  closeAllMenus();
  director.reset();
  replaceUrl("");
  dispatchDemo({ type: "reset" });
  dispatchServer({ type: "reset" });
}

function openFilterMenu({ dispatchDemo }: DataTableLaunchStepContext) {
  if (getIsPopoverOpen()) return;

  dispatchDemo({ type: "keystroke" });
  pressFilterShortcut();
}

function showColumns(columnCount: number): DataTableLaunchStepRun {
  return ({ dispatchDemo }) =>
    dispatchDemo({ type: "columnCount", columnCount });
}

function setDataMode(dataMode: DataMode): DataTableLaunchStepRun {
  return ({ dispatchDemo }) => dispatchDemo({ type: "dataMode", dataMode });
}

function setFilterMode(filterMode: FilterMode): DataTableLaunchStepRun {
  return ({ dispatchDemo }) => dispatchDemo({ type: "filterMode", filterMode });
}

function clickSteps<TTarget extends Element>(
  at: number,
  getTarget: () => TTarget | null | undefined,
  act: (
    target: TTarget | null | undefined,
    context: DataTableLaunchStepContext,
  ) => void,
): DataTableLaunchStep[] {
  return [
    { at, run: ({ director }) => director.click(getTarget()) },
    { at: at + PRESS_MS, run: (context) => act(getTarget(), context) },
  ];
}

function urlSteps(at: number, search: string): DataTableLaunchStep[] {
  return [{ at, run: () => replaceUrl(search) }];
}

function typeCommandStep(value: string): DataTableLaunchStepRun {
  return () => typeCommand(value);
}

function typeSteps(
  at: number,
  values: string[],
  createRun: (value: string) => DataTableLaunchStepRun,
): DataTableLaunchStep[] {
  return values.map((value, index) => ({
    at: at + index * TYPING_INTERVAL,
    run: createRun(value),
  }));
}

function setFilterValue(
  table: DataTableLaunchTable,
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
  table: DataTableLaunchTable,
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
