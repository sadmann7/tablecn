import type { SortingState } from "@tanstack/react-table";

import type { PasteResult } from "@/lib/data-grid-types";

type Assertiveness = "polite" | "assertive";

export interface AnnounceOptions {
  assertiveness?: Assertiveness;
  delay?: number;
}

interface LiveRegion {
  element: HTMLElement;
  pending: string | null;
  timer: ReturnType<typeof setTimeout> | null;
}

interface Announcer {
  root: HTMLElement;
  regions: Record<Assertiveness, LiveRegion>;
  clearTimers: Set<ReturnType<typeof setTimeout>>;
}

export interface SortDescription {
  label: string;
  desc: boolean;
}

export interface RowSelectionChange {
  selectedCount: number;
  isAllSelected: boolean;
  changedCount: number;
  changedRowNumber: number | null;
  isChangedRowSelected: boolean;
}

export interface DataGridMessages {
  sorted: (sorting: SortDescription[]) => string;
  rowSelected: (rowNumber: number) => string;
  rowDeselected: (rowNumber: number) => string;
  rowsSelected: (count: number) => string;
  allRowsSelected: (count: number) => string;
  cellsEdited: (count: number, columnLabel: string | null) => string;
  cellsPasted: (result: PasteResult) => string;
}

const ANNOUNCE_DELAY_MS = 150;
const CLEAR_DELAY_MS = 5000;

let announcer: Announcer | null = null;

export function announce(
  message: string,
  { assertiveness = "polite", delay = ANNOUNCE_DELAY_MS }: AnnounceOptions = {},
) {
  if (!message) return;
  const current = getAnnouncer();
  if (!current) return;

  const region = current.regions[assertiveness];
  region.pending = message;
  if (region.timer !== null) clearTimeout(region.timer);
  region.timer = setTimeout(() => flush(current, region), delay);
}

export function destroyAnnouncer() {
  if (!announcer) return;
  for (const region of Object.values(announcer.regions)) {
    if (region.timer !== null) clearTimeout(region.timer);
  }
  for (const timer of announcer.clearTimers) clearTimeout(timer);
  announcer.root.remove();
  announcer = null;
}

export const defaultDataGridMessages: DataGridMessages = {
  sorted: getSortedMessage,
  rowSelected: (rowNumber) => `Row ${rowNumber} selected`,
  rowDeselected: (rowNumber) => `Row ${rowNumber} deselected`,
  rowsSelected: (count) =>
    count === 0 ? "No rows selected" : `${pluralize(count, "row")} selected`,
  allRowsSelected: () => "All rows selected",
  cellsEdited: (count, columnLabel) =>
    count === 1 && columnLabel
      ? `${columnLabel} updated`
      : `${pluralize(count, "cell")} updated`,
  cellsPasted: ({ cellCount, addedRowCount, skippedCount }) =>
    [
      `${pluralize(cellCount, "cell")} pasted`,
      skippedCount > 0 ? `${skippedCount.toLocaleString()} skipped` : "",
      addedRowCount > 0 ? `${pluralize(addedRowCount, "row")} added` : "",
    ]
      .filter(Boolean)
      .join(", "),
};

export function getRowSelectionMessage(
  messages: DataGridMessages,
  {
    selectedCount,
    isAllSelected,
    changedCount,
    changedRowNumber,
    isChangedRowSelected,
  }: RowSelectionChange,
) {
  if (changedCount === 0) return null;
  if (isAllSelected) return messages.allRowsSelected(selectedCount);
  if (changedCount === 1 && changedRowNumber !== null) {
    return isChangedRowSelected
      ? messages.rowSelected(changedRowNumber)
      : messages.rowDeselected(changedRowNumber);
  }
  return messages.rowsSelected(selectedCount);
}

export function getIsSameCellValue(a: unknown, b: unknown) {
  if (Object.is(a, b)) return true;
  if (getIsEmptyCellValue(a) && getIsEmptyCellValue(b)) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  return (
    a.length === b.length && a.every((item, index) => Object.is(item, b[index]))
  );
}

export function getSortingKey(sorting: SortingState) {
  return sorting.map(({ id, desc }) => `${id}:${desc ? "d" : "a"}`).join(",");
}

const visuallyHiddenStyle: Partial<CSSStyleDeclaration> = {
  border: "0",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: "1px",
  margin: "-1px",
  overflow: "hidden",
  padding: "0",
  position: "absolute",
  width: "1px",
  whiteSpace: "nowrap",
};

function getAnnouncer() {
  if (typeof document === "undefined") return null;
  if (announcer?.root.isConnected) return announcer;

  const root = document.createElement("div");
  root.dataset.liveAnnouncer = "";
  Object.assign(root.style, visuallyHiddenStyle);
  document.body.prepend(root);

  announcer = {
    root,
    regions: {
      polite: createRegion(root, "polite"),
      assertive: createRegion(root, "assertive"),
    },
    clearTimers: new Set(),
  };
  return announcer;
}

function createRegion(root: HTMLElement, assertiveness: Assertiveness) {
  const element = document.createElement("div");
  element.setAttribute("role", "log");
  element.setAttribute("aria-live", assertiveness);
  element.setAttribute("aria-relevant", "additions");
  element.dataset.liveAnnouncer = assertiveness;
  root.appendChild(element);
  return { element, pending: null, timer: null };
}

function flush(current: Announcer, region: LiveRegion) {
  region.timer = null;
  const message = region.pending;
  region.pending = null;
  if (!message) return;

  const node = document.createElement("div");
  node.textContent = message;
  region.element.appendChild(node);

  const clearTimer = setTimeout(() => {
    current.clearTimers.delete(clearTimer);
    node.remove();
  }, CLEAR_DELAY_MS);
  current.clearTimers.add(clearTimer);
}

function getSortedMessage(sorting: SortDescription[]) {
  if (sorting.length === 0) return "Sorting cleared";
  return `Sorted by ${sorting
    .map(({ label, desc }) => `${label}, ${desc ? "descending" : "ascending"}`)
    .join(", then by ")}`;
}

function pluralize(count: number, noun: string) {
  return `${count.toLocaleString()} ${noun}${count === 1 ? "" : "s"}`;
}

function getIsEmptyCellValue(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}
